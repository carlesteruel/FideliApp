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
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/useAuthStore';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const { signIn, isLoading } = useAuthStore();

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!email.trim()) newErrors.email = 'El email es obligatorio';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Email inválido';
    if (!password) newErrors.password = 'La contraseña es obligatoria';
    else if (password.length < 6) newErrors.password = 'Mínimo 6 caracteres';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    const { error } = await signIn(email.trim().toLowerCase(), password);
    if (error) {
      Alert.alert('Error al iniciar sesión', error);
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
          {/* Header */}
          <View className="items-center pt-12 pb-8 px-6">
            <View className="w-20 h-20 bg-primary-500 rounded-3xl items-center justify-center mb-4">
              <Text className="text-4xl">🏆</Text>
            </View>
            <Text className="text-3xl font-bold text-gray-900">FideliApp</Text>
            <Text className="text-gray-500 text-base mt-1">
              Tu app de fidelización favorita
            </Text>
          </View>

          {/* Form */}
          <View className="flex-1 px-6">
            <Text className="text-2xl font-bold text-gray-900 mb-1">
              Bienvenido 👋
            </Text>
            <Text className="text-gray-500 mb-6">
              Inicia sesión para continuar
            </Text>

            <Input
              label="Email"
              placeholder="tu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
              }}
              error={errors.email}
            />

            <Input
              label="Contraseña"
              placeholder="••••••••"
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
              }}
              error={errors.password}
            />

            <TouchableOpacity className="self-end mb-6">
              <Text className="text-primary-500 font-semibold text-sm">
                ¿Olvidaste tu contraseña?
              </Text>
            </TouchableOpacity>

            <Button
              title="Iniciar sesión"
              onPress={handleLogin}
              loading={isLoading}
              size="lg"
            />

            {/* Divider */}
            <View className="flex-row items-center my-6">
              <View className="flex-1 h-px bg-gray-200" />
              <Text className="mx-3 text-gray-400 text-sm">o</Text>
              <View className="flex-1 h-px bg-gray-200" />
            </View>

            {/* Register link */}
            <View className="flex-row justify-center items-center pb-8">
              <Text className="text-gray-500 text-base">
                ¿No tienes cuenta?{' '}
              </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text className="text-primary-500 font-bold text-base">
                    Regístrate
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
