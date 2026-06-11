import { create } from 'zustand';
import { Session, User, Subscription } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile } from '../types/database';

// Guardamos la suscripción al cambio de estado de auth fuera del store para
// poder reutilizarla y evitar registrar listeners duplicados si `initialize`
// se llamara más de una vez.
let authSubscription: Subscription | null = null;

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isInitialized: boolean;


  // Actions
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: 'client' | 'business',
    birthDate?: string | null,
    referralCode?: string | null
  ) => Promise<{ error?: string; needsEmailConfirmation?: boolean }>;

  resendConfirmation: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    set({ isLoading: true });
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      // Si la sesión persistida no se puede recuperar (p. ej. el refresh token
      // ha caducado), getSession devuelve error y session = null; tratamos al
      // usuario como deslogueado de forma controlada.
      if (error) console.warn('getSession error (sesión expirada o inválida):', error.message);

      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        const synced = await syncBirthDate(session.user, profile);
        set({ session, user: session.user, profile: synced });
      }

      // Evitamos registrar listeners duplicados si initialize se llama de nuevo.

      if (authSubscription) authSubscription.unsubscribe();

      // Escuchar cambios de sesión.
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          switch (event) {
            case 'SIGNED_OUT':
              // Sesión cerrada o refresh token revocado/expirado.
              set({ session: null, user: null, profile: null });
              break;

            case 'TOKEN_REFRESHED':
              // El token se ha refrescado automáticamente: basta con actualizar
              // la sesión/usuario sin volver a pedir el perfil (ya lo tenemos).
              if (session?.user) {
                set({ session, user: session.user });
              }
              break;

            case 'USER_UPDATED':
              if (session?.user) set({ session, user: session.user });
              break;

            case 'SIGNED_IN':
            case 'INITIAL_SESSION':
            default:
              if (session?.user) {
                // Solo recargamos el perfil si cambia el usuario o aún no lo tenemos.
                const { user: currentUser, profile: currentProfile } = get();
                let profile =
                  currentUser?.id === session.user.id && currentProfile
                    ? currentProfile
                    : await fetchProfile(session.user.id);

                // Si el usuario se acaba de confirmar por email y tenía un código
                // de referido pendiente en sus metadatos, lo aplicamos ahora.
                const pendingCode = (session.user.user_metadata as {
                  pending_referral_code?: string | null
                } | undefined)?.pending_referral_code;

                if (pendingCode && profile && !profile.referred_by) {
                  await applyPendingReferralCode(pendingCode);
                  profile = await fetchProfile(session.user.id);
                }

                set({ session, user: session.user, profile });
              } else {
                set({ session: null, user: null, profile: null });
              }
              break;
          }
        }
      );
      authSubscription = subscription;
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      set({ isLoading: false, isInitialized: true });
    }
  },


  signIn: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };

      if (data.session?.user) {
        const profile = await fetchProfile(data.session.user.id);
        const synced = await syncBirthDate(data.session.user, profile);
        set({ session: data.session, user: data.session.user, profile: synced });
      }
      return {};
    } catch {
      return { error: 'Error inesperado al iniciar sesión' };

    } finally {
      set({ isLoading: false });
    }
  },

  signUp: async (email, password, fullName, role, birthDate, referralCode) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Guardamos birth_date y referral_code en los metadatos para poder
          // aplicarlos cuando exista sesión (inmediata o post-confirmación).
          data: {
            full_name: fullName,
            role,
            birth_date: birthDate ?? null,
            pending_referral_code: referralCode ?? null,
          },
        },
      });
      if (error) return { error: error.message };

      // Si hay sesión inmediata, la confirmación de correo está desactivada:
      // el usuario entra directamente.
      if (data.session?.user) {
        const profile = await fetchProfile(data.session.user.id);

        // Aplicamos el cumpleaños si el trigger de la BD no lo guardó.
        if (birthDate && profile && !profile.birth_date) {
          const client = supabase.from('profiles') as any;
          await client
            .update({ birth_date: birthDate })
            .eq('id', data.session.user.id);
        }

        // Aplicamos el código de referido si se proporcionó.
        if (referralCode) {
          await applyPendingReferralCode(referralCode);
        }

        const freshProfile = await fetchProfile(data.session.user.id);
        set({ session: data.session, user: data.session.user, profile: freshProfile });
        return {};
      }

      // Sin sesión pero con usuario creado => requiere confirmar el correo.
      // El código de referido queda en user_metadata y se aplica al hacer
      // login por primera vez (ver onAuthStateChange → SIGNED_IN).
      if (data.user) {
        return { needsEmailConfirmation: true };
      }

      return {};
    } catch {
      return { error: 'Error inesperado al registrarse' };
    } finally {
      set({ isLoading: false });
    }
  },

  resendConfirmation: async (email) => {
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) return { error: error.message };
      return {};
    } catch {
      return { error: 'Error inesperado al reenviar el correo' };
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();

    set({ session: null, user: null, profile: null });
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return { error: 'No hay sesión activa' };

    try {
      const client = supabase.from('profiles') as any;
      const { data, error } = await client
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) return { error: error.message };
      set({ profile: data as Profile });
      return {};
    } catch {
      return { error: 'Error actualizando perfil' };
    }
  },

  refreshProfile: async () => {
    const { user } = get();
    if (!user) return;
    const profile = await fetchProfile(user.id);
    if (profile) set({ profile });
  },
}));

// Helper para obtener el perfil
async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}

// Llama a la función RPC use_referral_code de forma silenciosa.
// Los errores no son fatales: si el código ya se usó o es inválido, simplemente se ignora.
async function applyPendingReferralCode(code: string): Promise<void> {
  try {
    await (supabase.rpc as any)('use_referral_code', { p_code: code });
  } catch {
    // Silenciamos el error: un código inválido o ya usado no debe romper el flujo.
  }
}

// Si el perfil aún no tiene fecha de cumpleaños pero sí está en los metadatos
// del usuario (guardada en el registro), la sincronizamos en la tabla profiles.
// Esto cubre el caso en el que el trigger de la BD no copie birth_date.
async function syncBirthDate(user: User, profile: Profile | null): Promise<Profile | null> {
  if (!profile) return profile;
  const metaBirth = (user.user_metadata as { birth_date?: string | null } | undefined)?.birth_date;
  if (!metaBirth || profile.birth_date) return profile;
  try {
    const client = supabase.from('profiles') as any;
    const { data } = await client
      .update({ birth_date: metaBirth })
      .eq('id', user.id)
      .select()
      .single();
    return (data as Profile) ?? profile;
  } catch {
    return profile;
  }
}

