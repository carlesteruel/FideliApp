import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/useAuthStore';

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleSignOut = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: () => signOut() },
      ]
    );
  };

  const MenuItem = ({
    emoji,
    label,
    subtitle,
    onPress,
    rightComponent,
    danger,
  }: {
    emoji: string;
    label: string;
    subtitle?: string;
    onPress?: () => void;
    rightComponent?: React.ReactNode;
    danger?: boolean;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center px-5 py-4 border-b border-gray-50"
      activeOpacity={0.7}
    >
      <View className="w-10 h-10 bg-gray-100 rounded-2xl items-center justify-center mr-3">
        <Text className="text-xl">{emoji}</Text>
      </View>
      <View className="flex-1">
        <Text className={`font-semibold text-base ${danger ? 'text-red-500' : 'text-gray-800'}`}>
          {label}
        </Text>
        {subtitle && (
          <Text className="text-gray-400 text-xs mt-0.5">{subtitle}</Text>
        )}
      </View>
      {rightComponent ?? <Text className="text-gray-300 text-lg">›</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header con avatar */}
        <View className="bg-white px-5 pt-6 pb-8 items-center">
          <View className="w-24 h-24 bg-primary-500 rounded-full items-center justify-center mb-4 shadow-lg" style={{ elevation: 6 }}>
            <Text className="text-4xl font-bold text-white">
              {profile?.full_name?.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text className="text-gray-900 text-xl font-bold">{profile?.full_name}</Text>
          <Text className="text-gray-400 text-sm mt-1">{profile?.email}</Text>
          <View className="mt-3 bg-primary-100 rounded-full px-4 py-1.5">
            <Text className="text-primary-600 text-xs font-bold uppercase tracking-wider">
              {profile?.role === 'client' ? '👤 Cliente' : '🏪 Negocio'}
            </Text>
          </View>
        </View>

        {/* Sección: Mi cuenta */}
        <View className="mt-4 bg-white rounded-2xl mx-4 overflow-hidden shadow-sm" style={{ elevation: 2 }}>
          <View className="px-5 py-3 border-b border-gray-50">
            <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider">
              Mi cuenta
            </Text>
          </View>
          <MenuItem
            emoji="👤"
            label="Editar perfil"
            subtitle="Nombre, email, teléfono"
          />
          <MenuItem
            emoji="🎂"
            label="Fecha de cumpleaños"
            subtitle={profile?.birth_date
              ? new Date(profile.birth_date).toLocaleDateString('es-ES')
              : 'No configurada — ¡actívala para premios!'}
          />
          <MenuItem
            emoji="🔒"
            label="Cambiar contraseña"
          />
        </View>

        {/* Sección: Preferencias */}
        <View className="mt-4 bg-white rounded-2xl mx-4 overflow-hidden shadow-sm" style={{ elevation: 2 }}>
          <View className="px-5 py-3 border-b border-gray-50">
            <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider">
              Preferencias
            </Text>
          </View>
          <MenuItem
            emoji="🔔"
            label="Notificaciones"
            subtitle="Recibe alertas de sellos y premios"
            rightComponent={
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#E5E7EB', true: '#DDD6FE' }}
                thumbColor={notificationsEnabled ? '#6C3DF4' : '#9CA3AF'}
              />
            }
          />
          <MenuItem
            emoji="🌍"
            label="Idioma"
            subtitle="Español"
          />
        </View>

        {/* Sección: Soporte */}
        <View className="mt-4 bg-white rounded-2xl mx-4 overflow-hidden shadow-sm" style={{ elevation: 2 }}>
          <View className="px-5 py-3 border-b border-gray-50">
            <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider">
              Soporte
            </Text>
          </View>
          <MenuItem
            emoji="❓"
            label="Ayuda y FAQ"
          />
          <MenuItem
            emoji="📧"
            label="Contactar soporte"
            subtitle="soporte@fideliapp.com"
          />
          <MenuItem
            emoji="⭐"
            label="Valorar la app"
          />
          <MenuItem
            emoji="📄"
            label="Términos y privacidad"
          />
        </View>

        {/* Cerrar sesión */}
        <View className="mt-4 bg-white rounded-2xl mx-4 overflow-hidden shadow-sm mb-6" style={{ elevation: 2 }}>
          <MenuItem
            emoji="🚪"
            label="Cerrar sesión"
            onPress={handleSignOut}
            danger
          />
        </View>

        {/* Versión */}
        <Text className="text-gray-300 text-xs text-center pb-6">
          FideliApp v1.0.0 · Hecho con ❤️
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
