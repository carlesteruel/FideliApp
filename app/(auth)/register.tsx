import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/useAuthStore';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { DatePickerModal } from '../../src/components/ui/DatePickerModal';
import { colors } from '../../src/theme';


type Role = 'client' | 'business';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, resendConfirmation, isLoading } = useAuthStore();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [resending, setResending] = useState(false);

  const [role, setRole] = useState<Role>('client');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState('');
  const [birthdayPickerVisible, setBirthdayPickerVisible] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const formatBirthDate = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };


  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = 'El nombre es obligatorio';
    if (!email.trim()) e.email = 'El email es obligatorio';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Email inválido';
    if (!password) e.password = 'La contraseña es obligatoria';
    else if (password.length < 6) e.password = 'Mínimo 6 caracteres';
    if (password !== confirmPassword) e.confirmPassword = 'Las contraseñas no coinciden';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validateStep2()) return;
    const { error, needsEmailConfirmation } = await signUp(
      email.trim().toLowerCase(),
      password,
      fullName.trim(),
      role,
      birthDate,
      referralCode.trim() || null
    );

    if (error) {
      Alert.alert('Error al registrarse', error);
      return;
    }
    if (needsEmailConfirmation) {
      setStep(3);
    }
    // Si no requiere confirmación, el cambio de sesión redirige automáticamente.
  };

  const handleResend = async () => {
    setResending(true);
    const { error } = await resendConfirmation(email.trim().toLowerCase());
    setResending(false);
    if (error) Alert.alert('No se pudo reenviar', error);
    else Alert.alert('Correo reenviado', 'Te hemos enviado de nuevo el correo de confirmación.');
  };


  const RoleCard = ({ r, emoji, title, subtitle }: { r: Role; emoji: string; title: string; subtitle: string }) => {
    const active = role === r;
    return (
      <TouchableOpacity onPress={() => setRole(r)} style={[s.roleCard, active ? s.roleCardActive : s.roleCardInactive]}>
        <View style={[s.roleIcon, { backgroundColor: active ? colors.primary500 : colors.gray200 }]}>
          <Text style={{ fontSize: 22 }}>{emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.roleTitle, { color: active ? colors.primary600 : colors.gray800 }]}>{title}</Text>
          <Text style={s.roleSubtitle}>{subtitle}</Text>
        </View>
        {active && (
          <View style={s.checkCircle}>
            <Text style={s.checkText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Botón atrás (oculto en el paso de confirmación) */}
          {step !== 3 && (
            <View style={s.backRow}>
              <TouchableOpacity onPress={() => step === 2 ? setStep(1) : router.back()} style={s.backBtn}>
                <Text style={{ fontSize: 20 }}>←</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={s.content}>
            <Text style={s.title}>
              {step === 1 ? 'Crear cuenta' : step === 2 ? 'Tus datos' : 'Revisa tu correo'}
            </Text>
            <Text style={s.subtitle}>
              {step === 1
                ? '¿Cómo vas a usar FideliApp?'
                : step === 2
                  ? 'Completa tu información personal'
                  : 'Solo falta un último paso para activar tu cuenta'}
            </Text>

            {/* Indicador de pasos */}
            <View style={s.stepsRow}>
              <View style={[s.step, step >= 1 ? s.stepActive : s.stepInactive]} />
              <View style={[s.step, step >= 2 ? s.stepActive : s.stepInactive]} />
              <View style={[s.step, step >= 3 ? s.stepActive : s.stepInactive]} />
            </View>


            {step === 1 && (
              <View>
                <RoleCard r="client" emoji="👤" title="Soy cliente" subtitle="Quiero acumular sellos y ganar premios" />
                <RoleCard r="business" emoji="🏪" title="Tengo un negocio" subtitle="Quiero crear campañas y fidelizar clientes" />
                <View style={{ height: 32 }} />
                <Button title="Continuar" onPress={() => setStep(2)} size="lg" />
              </View>
            )}

            {step === 2 && (
              <View>
                <Input label="Nombre completo" placeholder="Juan García" autoCapitalize="words" autoComplete="name"
                  value={fullName} onChangeText={(t) => { setFullName(t); setErrors((e) => ({ ...e, fullName: '' })); }} error={errors.fullName} />
                <Input label="Email" placeholder="tu@email.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email"
                  value={email} onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: '' })); }} error={errors.email} />
                <Input label="Contraseña" placeholder="••••••••" secureTextEntry
                  value={password} onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: '' })); }} error={errors.password} />
                <Input label="Confirmar contraseña" placeholder="••••••••" secureTextEntry
                  value={confirmPassword} onChangeText={(t) => { setConfirmPassword(t); setErrors((e) => ({ ...e, confirmPassword: '' })); }} error={errors.confirmPassword} />

                {/* Fecha de cumpleaños (opcional) */}
                <Text style={s.fieldLabel}>Fecha de cumpleaños <Text style={s.optional}>(opcional)</Text></Text>
                <TouchableOpacity style={s.dateField} onPress={() => setBirthdayPickerVisible(true)} activeOpacity={0.7}>
                  <Text style={{ fontSize: 18, marginRight: 10 }}>🎂</Text>
                  <Text style={[s.dateValue, !birthDate && s.datePlaceholder]}>
                    {birthDate ? formatBirthDate(birthDate) : 'Selecciona tu fecha'}
                  </Text>
                  {birthDate && (
                    <TouchableOpacity onPress={() => setBirthDate(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Text style={s.dateClear}>✕</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
                <Text style={s.birthdayHint}>Te avisaremos de premios especiales en tu cumpleaños 🎉</Text>

                {/* Código de referido (solo para clientes) */}
                {role === 'client' && (
                  <>
                    <Text style={s.fieldLabel}>
                      Código de amigo <Text style={s.optional}>(opcional)</Text>
                    </Text>
                    <View style={s.referralField}>
                      <Text style={{ fontSize: 18, marginRight: 10 }}>👥</Text>
                      <Input
                        placeholder="Ej: A3F7C2E1"
                        value={referralCode}
                        onChangeText={(t) => setReferralCode(t.toUpperCase().trim())}
                        autoCapitalize="characters"
                        style={s.referralInput}
                      />
                    </View>
                    <Text style={s.referralHint}>
                      Si un amigo te invitó, introduce su código para que ambos recibáis premios 🎁
                    </Text>
                  </>
                )}

                <Button title="Crear cuenta" onPress={handleRegister} loading={isLoading} size="lg" />

                <Text style={s.terms}>
                  Al registrarte aceptas nuestros{' '}
                  <Text style={{ color: colors.primary500 }}>Términos de uso</Text> y{' '}
                  <Text style={{ color: colors.primary500 }}>Política de privacidad</Text>
                </Text>
              </View>
            )}

            {step === 3 && (
              <View>
                <View style={s.successIcon}>
                  <Text style={{ fontSize: 40 }}>✉️</Text>
                </View>
                <Text style={s.successTitle}>¡Registro completado!</Text>
                <Text style={s.successText}>
                  Te hemos enviado un correo de confirmación a{'\n'}
                  <Text style={s.successEmail}>{email.trim().toLowerCase()}</Text>
                </Text>
                <Text style={s.successHint}>
                  Ábrelo y pulsa el enlace para activar tu cuenta. Si no lo ves, revisa tu carpeta de spam.
                </Text>
                <View style={{ height: 24 }} />
                <Button title="Ir a iniciar sesión" onPress={() => router.replace('/(auth)/login')} size="lg" />
                <TouchableOpacity onPress={handleResend} disabled={resending} style={s.resendBtn}>
                  <Text style={s.resendText}>
                    {resending ? 'Reenviando…' : '¿No te ha llegado? Reenviar correo'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {step !== 3 && (
              <View style={s.loginRow}>
                <Text style={s.loginLabel}>¿Ya tienes cuenta? </Text>
                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity><Text style={s.loginLink}>Inicia sesión</Text></TouchableOpacity>
                </Link>
              </View>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={birthdayPickerVisible}
        value={birthDate}
        title="🎂 Tu fecha de cumpleaños"
        onClose={() => setBirthdayPickerVisible(false)}
        onConfirm={(iso) => { setBirthDate(iso); setBirthdayPickerVisible(false); }}
      />
    </SafeAreaView>
  );
}


const s = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: colors.white },
  backRow:       { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  backBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center' },
  content:       { paddingHorizontal: 24 },
  title:         { fontSize: 24, fontWeight: '700', color: colors.gray900, marginBottom: 4 },
  subtitle:      { color: colors.gray500, marginBottom: 24 },
  stepsRow:      { flexDirection: 'row', gap: 8, marginBottom: 32 },
  step:          { flex: 1, height: 6, borderRadius: 99 },
  stepActive:    { backgroundColor: colors.primary500 },
  stepInactive:  { backgroundColor: colors.gray200 },
  roleCard:      { padding: 20, borderRadius: 16, borderWidth: 2, marginBottom: 16, flexDirection: 'row', alignItems: 'center' },
  roleCardActive:{ borderColor: colors.primary500, backgroundColor: colors.primary50 },
  roleCardInactive: { borderColor: colors.gray200, backgroundColor: colors.gray50 },
  roleIcon:      { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  roleTitle:     { fontWeight: '700', fontSize: 18 },
  roleSubtitle:  { color: colors.gray500, fontSize: 14 },
  checkCircle:   { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary500, alignItems: 'center', justifyContent: 'center' },
  checkText:     { color: colors.white, fontSize: 12, fontWeight: '700' },
  fieldLabel:    { color: colors.gray700, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  optional:      { color: colors.gray400, fontWeight: '400' },
  dateField:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.gray200, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 14 },
  dateValue:     { flex: 1, color: colors.gray800, fontSize: 16 },
  datePlaceholder: { color: colors.gray400 },
  dateClear:     { color: colors.gray400, fontSize: 16, paddingHorizontal: 4 },
  birthdayHint:  { color: colors.gray400, fontSize: 12, marginTop: 6, marginBottom: 16 },
  terms:         { color: colors.gray400, fontSize: 12, textAlign: 'center', marginTop: 16, marginBottom: 8 },

  loginRow:      { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 24 },
  loginLabel:    { color: colors.gray500, fontSize: 16 },
  loginLink:     { color: colors.primary500, fontWeight: '700', fontSize: 16 },
  successIcon:   { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primary50, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 24 },
  successTitle:  { fontSize: 22, fontWeight: '700', color: colors.gray900, textAlign: 'center', marginBottom: 12 },
  successText:   { color: colors.gray600, fontSize: 16, textAlign: 'center', lineHeight: 24 },
  successEmail:  { color: colors.gray900, fontWeight: '700' },
  successHint:   { color: colors.gray400, fontSize: 14, textAlign: 'center', marginTop: 16, lineHeight: 20 },
  resendBtn:     { alignSelf: 'center', paddingVertical: 16 },
  resendText:    { color: colors.primary500, fontWeight: '700', fontSize: 16 },

  // ── Código de referido ────────────────────────────────────
  referralField:   { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  referralInput:   { flex: 1 },
  referralHint:    { color: colors.gray400, fontSize: 12, marginTop: 4, marginBottom: 16, lineHeight: 18 },
});

