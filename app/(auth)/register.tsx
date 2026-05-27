import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/useAuthStore';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';

type Role = 'client' | 'business';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, isLoading } = useAuthStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<Role>('client');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep1 = () => {
    return true; // El rol siempre tiene valor
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = 'El nombre es obligatorio';
    if (!email.trim()) newErrors.email = 'El email es obligatorio';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Email inválido';
    if (!password) newErrors.password = 'La contraseña es obligatoria';
    else if (password.length < 6) newErrors.password = 'Mínimo 6 caracteres';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Las contraseñas no coinciden';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateStep2()) return;
    const { error } = await signUp(email.trim().toLowerCase(), password, fullName.trim(), role);
    if (error) {
      Alert.alert('Error al registrarse', error);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header con botón atrás */}
          <View className="px-6 pt-4 pb-2">
            <TouchableOpacity
              onPress={() => step === 2 ? setStep(1) : router.back()}
              className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
            >
              <Text className="text-xl">←</Text>
            </TouchableOpacity>
          </View>

          <View className="px-6">
            <Text className="text-2xl font-bold text-gray-900 mb-1">
              {step === 1 ? 'Crear cuenta' : 'Tus datos'}
            </Text>
            <Text className="text-gray-500 mb-6">
              {step === 1
                ? '¿Cómo vas a usar FideliApp?'
                : 'Completa tu información personal'}
            </Text>

            {/* Indicador de pasos */}
            <View className="flex-row gap-2 mb-8">
              <View className={`flex-1 h-1.5 rounded-full ${step >= 1 ? 'bg-primary-500' : 'bg-gray-200'}`} />
              <View className={`flex-1 h-1.5 rounded-full ${step >= 2 ? 'bg-primary-500' : 'bg-gray-200'}`} />
            </View>

            {/* PASO 1: Selección de rol */}
            {step === 1 && (
              <View>
                <TouchableOpacity
                  onPress={() => setRole('client')}
                  className={`
                    p-5 rounded-2xl border-2 mb-4
                    ${role === 'client' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-gray-50'}
                  `}
                >
                  <View className="flex-row items-center">
                    <View className={`
                      w-12 h-12 rounded-2xl items-center justify-center mr-4
                      ${role === 'client' ? 'bg-primary-500' : 'bg-gray-200'}
                    `}>
                      <Text className="text-2xl">👤</Text>
                    </View>
                    <View className="flex-1">
                      <Text className={`font-bold text-lg ${role === 'client' ? 'text-primary-600' : 'text-gray-800'}`}>
                        Soy cliente
                      </Text>
                      <Text className="text-gray-500 text-sm">
                        Quiero acumular sellos y ganar premios
                      </Text>
                    </View>
                    {role === 'client' && (
                      <View className="w-6 h-6 rounded-full bg-primary-500 items-center justify-center">
                        <Text className="text-white text-xs font-bold">✓</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setRole('business')}
                  className={`
                    p-5 rounded-2xl border-2 mb-8
                    ${role === 'business' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-gray-50'}
                  `}
                >
                  <View className="flex-row items-center">
                    <View className={`
                      w-12 h-12 rounded-2xl items-center justify-center mr-4
                      ${role === 'business' ? 'bg-primary-500' : 'bg-gray-200'}
                    `}>
                      <Text className="text-2xl">🏪</Text>
                    </View>
                    <View className="flex-1">
                      <Text className={`font-bold text-lg ${role === 'business' ? 'text-primary-600' : 'text-gray-800'}`}>
                        Tengo un negocio
                      </Text>
                      <Text className="text-gray-500 text-sm">
                        Quiero crear campañas y fidelizar clientes
                      </Text>
                    </View>
                    {role === 'business' && (
                      <View className="w-6 h-6 rounded-full bg-primary-500 items-center justify-center">
                        <Text className="text-white text-xs font-bold">✓</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                <Button
                  title="Continuar"
                  onPress={() => setStep(2)}
                  size="lg"
                />
              </View>
            )}

            {/* PASO 2: Datos personales */}
            {step === 2 && (
              <View>
                <Input
                  label="Nombre completo"
                  placeholder="Juan García"
                  autoCapitalize="words"
                  autoComplete="name"
                  value={fullName}
                  onChangeText={(t) => { setFullName(t); setErrors((e) => ({ ...e, fullName: '' })); }}
                  error={errors.fullName}
                />

                <Input
                  label="Email"
                  placeholder="tu@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={email}
                  onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: '' })); }}
                  error={errors.email}
                />

                <Input
                  label="Contraseña"
                  placeholder="••••••••"
                  secureTextEntry
                  value={password}
                  onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: '' })); }}
                  error={errors.password}
                />

                <Input
                  label="Confirmar contraseña"
                  placeholder="••••••••"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={(t) => { setConfirmPassword(t); setErrors((e) => ({ ...e, confirmPassword: '' })); }}
                  error={errors.confirmPassword}
                />

                <Button
                  title="Crear cuenta"
                  onPress={handleRegister}
                  loading={isLoading}
                  size="lg"
                />

                <Text className="text-gray-400 text-xs text-center mt-4 mb-2">
                  Al registrarte aceptas nuestros{' '}
                  <Text className="text-primary-500">Términos de uso</Text> y{' '}
                  <Text className="text-primary-500">Política de privacidad</Text>
                </Text>
              </View>
            )}

            {/* Link a login */}
            <View className="flex-row justify-center items-center py-6">
              <Text className="text-gray-500 text-base">¿Ya tienes cuenta? </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity>
                  <Text className="text-primary-500 font-bold text-base">
                    Inicia sesión
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
