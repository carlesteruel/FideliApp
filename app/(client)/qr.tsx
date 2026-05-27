import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { useAuthStore } from '../../src/store/useAuthStore';
import { supabase } from '../../src/lib/supabase';

const QR_VALIDITY_MINUTES = 5;

export default function QRScreen() {
  const { user, profile } = useAuthStore();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);

  const generateToken = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Invalidar tokens anteriores no usados
      await supabase
        .from('customer_qr_tokens')
        .update({ used: true })
        .eq('customer_id', user.id)
        .eq('used', false);

      // Crear nuevo token
      const { data, error } = await supabase
        .from('customer_qr_tokens')
        .insert({ customer_id: user.id })
        .select()
        .single();

      if (error || !data) throw error;

      const tokenData = data as any;
      setToken(tokenData.token);
      setExpiresAt(new Date(tokenData.expires_at));
      setSecondsLeft(QR_VALIDITY_MINUTES * 60);
    } catch (e) {
      Alert.alert('Error', 'No se pudo generar el código QR');
    } finally {
      setLoading(false);
    }
  };

  // Generar token al entrar a la pantalla
  useFocusEffect(useCallback(() => {
    generateToken();
    return () => {};
  }, [user]));

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const qrValue = token ? `fideliapp://qr/${token}` : '';
  const isExpired = secondsLeft === 0 && !loading;
  const progressPct = (secondsLeft / (QR_VALIDITY_MINUTES * 60)) * 100;

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3"
        >
          <Text className="text-xl">←</Text>
        </TouchableOpacity>
        <Text className="text-gray-900 text-xl font-bold">Mi código QR</Text>
      </View>

      <View className="flex-1 items-center justify-center px-8">
        {loading ? (
          <ActivityIndicator size="large" color="#6C3DF4" />
        ) : (
          <>
            {/* Nombre del cliente */}
            <Text className="text-gray-500 text-sm text-center mb-1">
              Muestra este código al negocio
            </Text>
            <Text className="text-gray-900 text-2xl font-bold text-center mb-6">
              {profile?.full_name}
            </Text>

            {/* QR Code */}
            <View className={`p-5 rounded-3xl shadow-xl border-4 ${isExpired ? 'border-red-200 opacity-40' : 'border-primary-500'}`} style={{ elevation: 8 }}>
              {!isExpired && qrValue ? (
                <QRCode
                  value={qrValue}
                  size={220}
                  color="#1F2937"
                  backgroundColor="#FFFFFF"
                  logo={undefined}
                  quietZone={10}
                />
              ) : (
                <View className="w-[220px] h-[220px] items-center justify-center">
                  <Text className="text-5xl mb-2">⏰</Text>
                  <Text className="text-gray-500 text-center font-medium">QR Expirado</Text>
                </View>
              )}
            </View>

            {/* Timer */}
            {!isExpired && (
              <View className="items-center mt-6 w-full">
                {/* Barra de progreso */}
                <View className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <View
                    className={`h-full rounded-full ${secondsLeft < 60 ? 'bg-red-400' : secondsLeft < 120 ? 'bg-yellow-400' : 'bg-primary-500'}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </View>
                <Text className={`font-bold text-lg ${secondsLeft < 60 ? 'text-red-500' : 'text-gray-700'}`}>
                  ⏱ Válido {formatTime(secondsLeft)}
                </Text>
                <Text className="text-gray-400 text-xs mt-1">
                  Solo puede usarse una vez
                </Text>
              </View>
            )}

            {/* Botón regenerar */}
            <TouchableOpacity
              className={`mt-6 px-8 py-4 rounded-2xl ${isExpired ? 'bg-primary-500' : 'bg-gray-100'}`}
              onPress={generateToken}
            >
              <Text className={`font-bold text-base text-center ${isExpired ? 'text-white' : 'text-gray-600'}`}>
                🔄 {isExpired ? 'Generar nuevo QR' : 'Regenerar QR'}
              </Text>
            </TouchableOpacity>

            {/* Info */}
            <View className="mt-6 bg-primary-50 rounded-2xl px-5 py-4 w-full">
              <Text className="text-primary-700 text-sm text-center leading-5">
                💡 El negocio escaneará este QR para añadir un sello a tu tarjeta de fidelización
              </Text>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
