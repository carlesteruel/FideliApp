import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile } from '../types/database';

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
    role: 'client' | 'business'
  ) => Promise<{ error?: string }>;
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
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        set({ session, user: session.user, profile });
      }

      // Escuchar cambios de sesión
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          set({ session, user: session.user, profile });
        } else {
          set({ session: null, user: null, profile: null });
        }
      });
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
        set({ session: data.session, user: data.session.user, profile });
      }
      return {};
    } catch {
      return { error: 'Error inesperado al iniciar sesión' };
    } finally {
      set({ isLoading: false });
    }
  },

  signUp: async (email, password, fullName, role) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role },
        },
      });
      if (error) return { error: error.message };

      if (data.session?.user) {
        const profile = await fetchProfile(data.session.user.id);
        set({ session: data.session, user: data.session.user, profile });
      }
      return {};
    } catch {
      return { error: 'Error inesperado al registrarse' };
    } finally {
      set({ isLoading: false });
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
