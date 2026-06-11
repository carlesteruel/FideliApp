import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, Switch,
  StyleSheet, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
  Share, Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/useAuthStore';
import { supabase } from '../../src/lib/supabase';
import { DatePickerModal } from '../../src/components/ui/DatePickerModal';
import { colors } from '../../src/theme';

// ─── Helpers ────────────────────────────────────────────────
function Field({
  label, value, onChangeText, placeholder, keyboardType, secureTextEntry, autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
}) {
  return (
    <View style={fs.fieldWrap}>
      <Text style={fs.fieldLabel}>{label}</Text>
      <TextInput
        style={fs.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.gray300}
        keyboardType={keyboardType ?? 'default'}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        autoCorrect={false}
      />
    </View>
  );
}

// ─── Pantalla principal ─────────────────────────────────────
export default function ProfileScreen() {
  const { profile, signOut, updateProfile } = useAuthStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [birthdayPickerVisible, setBirthdayPickerVisible] = useState(false);
  const [savingBirthday, setSavingBirthday] = useState(false);

  // ── Editar perfil ──────────────────────────────
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const openEditProfile = () => {
    setEditName(profile?.full_name ?? '');
    setEditPhone(profile?.phone ?? '');
    setEditVisible(true);
  };

  const handleSaveProfile = async () => {
    const name = editName.trim();
    if (!name) {
      Alert.alert('Campo requerido', 'El nombre no puede estar vacío.');
      return;
    }
    setEditSaving(true);
    const { error } = await updateProfile({ full_name: name, phone: editPhone.trim() || null });
    setEditSaving(false);
    if (error) {
      Alert.alert('Error', error);
    } else {
      setEditVisible(false);
    }
  };

  // ── Cambiar contraseña ─────────────────────────
  const [pwVisible, setPwVisible] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const openChangePassword = () => {
    setPwCurrent('');
    setPwNew('');
    setPwConfirm('');
    setPwVisible(true);
  };

  const handleChangePassword = async () => {
    if (!pwCurrent) { Alert.alert('Campo requerido', 'Introduce tu contraseña actual.'); return; }
    if (pwNew.length < 8) { Alert.alert('Contraseña demasiado corta', 'La nueva contraseña debe tener al menos 8 caracteres.'); return; }
    if (pwNew !== pwConfirm) { Alert.alert('No coinciden', 'La nueva contraseña y su confirmación no coinciden.'); return; }

    setPwSaving(true);
    try {
      // Verificamos la contraseña actual intentando iniciar sesión
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: profile?.email ?? '',
        password: pwCurrent,
      });
      if (signInErr) {
        Alert.alert('Contraseña incorrecta', 'La contraseña actual no es correcta.');
        return;
      }
      // Actualizamos la contraseña
      const { error: updateErr } = await supabase.auth.updateUser({ password: pwNew });
      if (updateErr) {
        Alert.alert('Error', updateErr.message);
        return;
      }
      setPwVisible(false);
      Alert.alert('¡Listo!', 'Tu contraseña ha sido actualizada correctamente.');
    } catch {
      Alert.alert('Error', 'No se pudo cambiar la contraseña. Inténtalo de nuevo.');
    } finally {
      setPwSaving(false);
    }
  };

  // ── Cumpleaños ─────────────────────────────────
  const handleSaveBirthday = async (isoDate: string) => {
    setBirthdayPickerVisible(false);
    setSavingBirthday(true);
    const { error } = await updateProfile({ birth_date: isoDate });
    setSavingBirthday(false);
    if (error) Alert.alert('No se pudo guardar', error);
  };

  // ── Cerrar sesión ──────────────────────────────
  const handleSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro de que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  // ── Componente MenuItem ────────────────────────
  const MenuItem = ({ emoji, label, subtitle, onPress, rightComponent, danger }: {
    emoji: string; label: string; subtitle?: string; onPress?: () => void; rightComponent?: React.ReactNode; danger?: boolean;
  }) => (
    <TouchableOpacity onPress={onPress} style={s.menuItem} activeOpacity={0.7}>
      <View style={s.menuIcon}><Text style={{ fontSize: 20 }}>{emoji}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={[s.menuLabel, danger && { color: colors.red500 }]}>{label}</Text>
        {subtitle && <Text style={s.menuSub}>{subtitle}</Text>}
      </View>
      {rightComponent ?? <Text style={s.menuArrow}>›</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={s.avatarBlock}>
          <View style={[s.avatar, { elevation: 6 }]}>
            <Text style={s.avatarLetter}>{profile?.full_name?.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={s.name}>{profile?.full_name}</Text>
          <Text style={s.email}>{profile?.email}</Text>
          <View style={s.roleBadge}>
            <Text style={s.roleText}>{profile?.role === 'client' ? '👤 Cliente' : '🏪 Negocio'}</Text>
          </View>
        </View>

        {/* ── Banner: completar fecha de cumpleaños ── */}
        {profile?.role === 'client' && !profile?.birth_date && (
          <TouchableOpacity
            style={s.birthdayBanner}
            onPress={() => setBirthdayPickerVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 28 }}>🎂</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.birthdayBannerTitle}>Activa tu premio de cumpleaños</Text>
              <Text style={s.birthdayBannerSub}>
                Añade tu fecha y recibirás premios especiales de los negocios que visitas
              </Text>
            </View>
            <Text style={{ color: colors.primary600, fontSize: 18 }}>›</Text>
          </TouchableOpacity>
        )}

        <View style={s.section}>
          <View style={s.sectionHeader}><Text style={s.sectionLabel}>MI CUENTA</Text></View>
          <MenuItem emoji="👤" label="Editar perfil" subtitle="Nombre y teléfono" onPress={openEditProfile} />
          <MenuItem emoji="🎂" label="Fecha de cumpleaños"
            onPress={() => setBirthdayPickerVisible(true)}
            subtitle={savingBirthday ? 'Guardando…'
              : profile?.birth_date ? new Date(profile.birth_date).toLocaleDateString('es-ES') : 'No configurada — ¡actívala para premios!'} />
          <MenuItem emoji="🔒" label="Cambiar contraseña" onPress={openChangePassword} />
        </View>

        <View style={s.section}>
          <View style={s.sectionHeader}><Text style={s.sectionLabel}>PREFERENCIAS</Text></View>
          <MenuItem emoji="🔔" label="Notificaciones" subtitle="Recibe alertas de sellos y premios"
            rightComponent={<Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled}
              trackColor={{ false: colors.gray200, true: colors.primary100 }} thumbColor={notificationsEnabled ? colors.primary500 : colors.gray400} />} />
          <MenuItem emoji="🌍" label="Idioma" subtitle="Español" />
        </View>

        <View style={s.section}>
          <View style={s.sectionHeader}><Text style={s.sectionLabel}>SOPORTE</Text></View>
          <MenuItem emoji="❓" label="Ayuda y FAQ" />
          <MenuItem emoji="📧" label="Contactar soporte" subtitle="soporte@fideliapp.com" />
          <MenuItem emoji="⭐" label="Valorar la app" />
          <MenuItem emoji="📄" label="Términos y privacidad" />
        </View>

        {/* ── Sección referidos (solo clientes) ── */}
        {profile?.role === 'client' && profile?.referral_code && (
          <View style={s.referralCard}>
            <View style={s.referralHeader}>
              <Text style={s.referralTitle}>👥 Invita a amigos</Text>
              <Text style={s.referralSub}>
                Comparte tu código y gana premios cuando tus amigos se unan
              </Text>
            </View>
            <View style={s.referralCodeRow}>
              <Text style={s.referralCode}>{profile.referral_code}</Text>
              <View style={s.referralBtns}>
                <TouchableOpacity
                  style={s.referralCopyBtn}
                  activeOpacity={0.7}
                  onPress={() => {
                    Clipboard.setString(profile.referral_code ?? '');
                    Alert.alert('¡Copiado!', 'Tu código de referido está en el portapapeles.');
                  }}
                >
                  <Text style={s.referralCopyText}>📋 Copiar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.referralShareBtn}
                  activeOpacity={0.7}
                  onPress={() =>
                    Share.share({
                      message: `¡Únete a FideliApp con mi código ${profile.referral_code} y recibe premios exclusivos! 🎁`,
                      title: 'Mi código de referido',
                    })
                  }
                >
                  <Text style={s.referralShareText}>📤 Compartir</Text>
                </TouchableOpacity>
              </View>
            </View>
            {profile.referred_by && (
              <View style={s.referredBadge}>
                <Text style={s.referredBadgeText}>✅ Te uniste con un código de amigo</Text>
              </View>
            )}
          </View>
        )}

        <View style={[s.section, { marginBottom: 24 }]}>
          <MenuItem emoji="🚪" label="Cerrar sesión" onPress={handleSignOut} danger />
        </View>

        <Text style={s.version}>FideliApp v1.0.0 · Hecho con ❤️</Text>
      </ScrollView>

      {/* ── Modal: Fecha de cumpleaños ── */}
      <DatePickerModal
        visible={birthdayPickerVisible}
        value={profile?.birth_date ?? null}
        title="🎂 Tu fecha de cumpleaños"
        onClose={() => setBirthdayPickerVisible(false)}
        onConfirm={handleSaveBirthday}
      />

      {/* ── Modal: Editar perfil ── */}
      <Modal visible={editVisible} animationType="slide" transparent onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalBg}>
            <View style={s.modalSheet}>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>✏️ Editar perfil</Text>

              <Field
                label="Nombre completo"
                value={editName}
                onChangeText={setEditName}
                placeholder="Tu nombre"
                autoCapitalize="words"
              />
              <Field
                label="Teléfono (opcional)"
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="+34 600 000 000"
                keyboardType="phone-pad"
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[s.primaryBtn, editSaving && { opacity: 0.6 }]}
                onPress={handleSaveProfile}
                disabled={editSaving}
                activeOpacity={0.8}
              >
                {editSaving
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={s.primaryBtnText}>Guardar cambios</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setEditVisible(false)}>
                <Text style={s.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: Cambiar contraseña ── */}
      <Modal visible={pwVisible} animationType="slide" transparent onRequestClose={() => setPwVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalBg}>
            <View style={s.modalSheet}>
              <View style={s.modalHandle} />
              <Text style={s.modalTitle}>🔒 Cambiar contraseña</Text>

              <Field
                label="Contraseña actual"
                value={pwCurrent}
                onChangeText={setPwCurrent}
                placeholder="••••••••"
                secureTextEntry
                autoCapitalize="none"
              />
              <Field
                label="Nueva contraseña"
                value={pwNew}
                onChangeText={setPwNew}
                placeholder="Mínimo 8 caracteres"
                secureTextEntry
                autoCapitalize="none"
              />
              <Field
                label="Confirmar nueva contraseña"
                value={pwConfirm}
                onChangeText={setPwConfirm}
                placeholder="Repite la nueva contraseña"
                secureTextEntry
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[s.primaryBtn, pwSaving && { opacity: 0.6 }]}
                onPress={handleChangePassword}
                disabled={pwSaving}
                activeOpacity={0.8}
              >
                {pwSaving
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={s.primaryBtnText}>Cambiar contraseña</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setPwVisible(false)}>
                <Text style={s.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Estilos del campo de texto ──────────────────────────────
const fs = StyleSheet.create({
  fieldWrap:  { marginBottom: 16 },
  fieldLabel: { color: colors.gray500, fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: {
    backgroundColor: colors.gray50, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: colors.gray900, borderWidth: 1, borderColor: colors.gray200,
  },
});

// ─── Estilos principales ─────────────────────────────────────
const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: colors.gray50 },
  avatarBlock:  { backgroundColor: colors.white, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32, alignItems: 'center' },
  avatar:       { width: 96, height: 96, backgroundColor: colors.primary500, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarLetter: { fontSize: 36, fontWeight: '700', color: colors.white },
  name:         { color: colors.gray900, fontSize: 20, fontWeight: '700' },
  email:        { color: colors.gray400, fontSize: 14, marginTop: 4 },
  roleBadge:    { marginTop: 12, backgroundColor: colors.primary100, borderRadius: 99, paddingHorizontal: 16, paddingVertical: 6 },
  roleText:     { color: colors.primary600, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  section:      { marginTop: 16, marginHorizontal: 16, backgroundColor: colors.white, borderRadius: 16, overflow: 'hidden', elevation: 2 },
  sectionHeader:{ paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.gray50 },
  sectionLabel: { color: colors.gray400, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  menuItem:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.gray50 },
  menuIcon:     { width: 40, height: 40, backgroundColor: colors.gray100, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  menuLabel:    { fontWeight: '600', fontSize: 16, color: colors.gray800 },
  menuSub:      { color: colors.gray400, fontSize: 12, marginTop: 2 },
  menuArrow:    { color: colors.gray300, fontSize: 20 },
  version:      { color: colors.gray300, fontSize: 12, textAlign: 'center', paddingBottom: 24 },

  // Modales
  modalBg:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  modalHandle:  { width: 48, height: 6, backgroundColor: colors.gray200, borderRadius: 99, alignSelf: 'center', marginBottom: 20 },
  modalTitle:   { color: colors.gray900, fontSize: 20, fontWeight: '700', marginBottom: 24 },
  primaryBtn:   { backgroundColor: colors.primary500, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  cancelBtn:    { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  cancelBtnText:{ color: colors.gray400, fontWeight: '500', fontSize: 15 },

  // ── Banner cumpleaños ─────────────────────────────────────
  birthdayBanner:      { marginTop: 16, marginHorizontal: 16, backgroundColor: colors.primary50, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.primary100, elevation: 2 },
  birthdayBannerTitle: { color: colors.primary600, fontWeight: '700', fontSize: 14 },
  birthdayBannerSub:   { color: colors.primary500, fontSize: 12, marginTop: 2, lineHeight: 16, opacity: 0.75 },

  // ── Referidos ─────────────────────────────────────────────
  referralCard:    { marginTop: 16, marginHorizontal: 16, backgroundColor: colors.primary500, borderRadius: 20, padding: 20, elevation: 4 },
  referralHeader:  { marginBottom: 16 },
  referralTitle:   { color: colors.white, fontSize: 18, fontWeight: '700' },
  referralSub:     { color: 'rgba(255,255,255,0.80)', fontSize: 13, marginTop: 4, lineHeight: 18 },
  referralCodeRow: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 14, gap: 12 },
  referralCode:    { color: colors.white, fontSize: 28, fontWeight: '800', letterSpacing: 4, textAlign: 'center', marginBottom: 10 },
  referralBtns:    { flexDirection: 'row', gap: 10 },
  referralCopyBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.20)', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  referralCopyText:{ color: colors.white, fontWeight: '700', fontSize: 13 },
  referralShareBtn:{ flex: 1, backgroundColor: colors.white, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  referralShareText:{ color: colors.primary600, fontWeight: '700', fontSize: 13 },
  referredBadge:   { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6, alignSelf: 'flex-start' },
  referredBadgeText:{ color: colors.white, fontSize: 12, fontWeight: '600' },
});
