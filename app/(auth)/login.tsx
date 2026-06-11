import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/useAuthStore';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { colors } from '../../src/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const { signIn, isLoading } = useAuthStore();

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'El email es obligatorio';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Email inválido';
    if (!password) e.password = 'La contraseña es obligatoria';
    else if (password.length < 6) e.password = 'Mínimo 6 caracteres';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    const { error } = await signIn(email.trim().toLowerCase(), password);
    if (error) Alert.alert('Error al iniciar sesión', error);
  };

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={s.headerBlock}>
            <View style={s.logoBox}><Text style={{ fontSize: 36 }}>🏆</Text></View>
            <Text style={s.appName}>FideliApp</Text>
            <Text style={s.tagline}>Tu app de fidelización favorita</Text>
          </View>

          {/* Form */}
          <View style={s.form}>
            <Text style={s.title}>Bienvenido 👋</Text>
            <Text style={s.subtitle}>Inicia sesión para continuar</Text>

            <Input label="Email" placeholder="tu@email.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email}
              onChangeText={(t) => { setEmail(t); if (errors.email) setErrors((e) => ({ ...e, email: undefined })); }} error={errors.email} />

            <Input label="Contraseña" placeholder="••••••••" secureTextEntry autoComplete="password" value={password}
              onChangeText={(t) => { setPassword(t); if (errors.password) setErrors((e) => ({ ...e, password: undefined })); }} error={errors.password} />

            <TouchableOpacity style={s.forgotBtn}>
              <Text style={s.forgotText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>

            <Button title="Iniciar sesión" onPress={handleLogin} loading={isLoading} size="lg" />

            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>o</Text>
              <View style={s.dividerLine} />
            </View>

            <View style={s.registerRow}>
              <Text style={s.registerLabel}>¿No tienes cuenta? </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity><Text style={s.registerLink}>Regístrate</Text></TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: colors.white },
  headerBlock:  { alignItems: 'center', paddingTop: 48, paddingBottom: 32, paddingHorizontal: 24 },
  logoBox:      { width: 80, height: 80, backgroundColor: colors.primary500, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  appName:      { fontSize: 28, fontWeight: '700', color: colors.gray900 },
  tagline:      { color: colors.gray500, fontSize: 16, marginTop: 4 },
  form:         { flex: 1, paddingHorizontal: 24 },
  title:        { fontSize: 24, fontWeight: '700', color: colors.gray900, marginBottom: 4 },
  subtitle:     { color: colors.gray500, marginBottom: 24 },
  forgotBtn:    { alignSelf: 'flex-end', marginBottom: 24 },
  forgotText:   { color: colors.primary500, fontWeight: '600', fontSize: 14 },
  divider:      { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  dividerLine:  { flex: 1, height: 1, backgroundColor: colors.gray200 },
  dividerText:  { marginHorizontal: 12, color: colors.gray400, fontSize: 14 },
  registerRow:  { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingBottom: 32 },
  registerLabel:{ color: colors.gray500, fontSize: 16 },
  registerLink: { color: colors.primary500, fontWeight: '700', fontSize: 16 },
});
