import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  Vibration,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuthStore } from '../../src/store/useAuthStore';
import { supabase } from '../../src/lib/supabase';
import { Campaign, Profile, AddStampResult } from '../../src/types/database';

type ScanState = 'scanning' | 'loading' | 'select_campaign' | 'success' | 'error';

interface ScannedCustomer {
  profile: Profile;
  token: string;
}

export default function ScannerScreen() {
  const { profile } = useAuthStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [scannedCustomer, setScannedCustomer] = useState<ScannedCustomer | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [stampResult, setStampResult] = useState<AddStampResult | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const scannedRef = useRef(false);

  // Obtener ID del negocio
  useEffect(() => {
    const fetchBusiness = async () => {
      if (!profile) return;
      const { data } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', profile.id)
        .single();
      if (data) setBusinessId((data as any).id);
    };
    fetchBusiness();
  }, [profile]);

  // Cargar campañas activas del negocio
  const fetchCampaigns = async () => {
    if (!businessId) return;
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (data) setCampaigns(data as Campaign[]);
  };

  useEffect(() => { fetchCampaigns(); }, [businessId]);

  // Activar cámara solo cuando la pestaña está enfocada
  useFocusEffect(
    useCallback(() => {
      setIsActive(true);
      scannedRef.current = false;
      setScanState('scanning');
      return () => setIsActive(false);
    }, [])
  );

  const handleBarCodeScanned = async ({ data: qrData }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setScanState('loading');
    Vibration.vibrate(100);

    try {
      // El QR contiene el token del cliente: fideliapp://qr/{token}
      let token = qrData;
      if (qrData.startsWith('fideliapp://qr/')) {
        token = qrData.replace('fideliapp://qr/', '');
      }

      // Verificar que el token existe y no ha expirado
      const { data: tokenData, error: tokenError } = await supabase
        .from('customer_qr_tokens')
        .select('*, profiles!customer_qr_tokens_customer_id_fkey (*)')
        .eq('token', token)
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (tokenError || !tokenData) {
        setScanState('error');
        setTimeout(() => resetScanner(), 3000);
        return;
      }

      const customerData = tokenData as any;
      setScannedCustomer({
        profile: customerData.profiles,
        token: token,
      });

      if (campaigns.length === 1) {
        // Solo una campaña → seleccionar automáticamente
        setSelectedCampaign(campaigns[0]);
        setScanState('select_campaign');
      } else {
        setScanState('select_campaign');
      }
    } catch (error) {
      console.error(error);
      setScanState('error');
      setTimeout(() => resetScanner(), 3000);
    }
  };

  const handleAddStamp = async (campaign: Campaign) => {
    if (!scannedCustomer || !profile) return;
    setScanState('loading');

    try {
      // Añadir el sello usando la función RPC
      const { data, error } = await supabase.rpc('add_stamp', {
        p_customer_id: scannedCustomer.profile.id,
        p_campaign_id: campaign.id,
        p_stamped_by: profile.id,
      });

      if (error) throw error;

      const result = data as AddStampResult;

      // Marcar el token como usado
      await supabase
        .from('customer_qr_tokens')
        .update({ used: true })
        .eq('token', scannedCustomer.token);

      setStampResult(result);
      setSelectedCampaign(campaign);
      setScanState('success');
      Vibration.vibrate([0, 100, 100, 100]);
    } catch (error: any) {
      Alert.alert('Error', error.message ?? 'Error al añadir el sello');
      setScanState('error');
      setTimeout(() => resetScanner(), 3000);
    }
  };

  const resetScanner = () => {
    scannedRef.current = false;
    setScannedCustomer(null);
    setSelectedCampaign(null);
    setStampResult(null);
    setScanState('scanning');
  };

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-gray-900 items-center justify-center">
        <ActivityIndicator color="white" />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-gray-900 items-center justify-center px-8">
        <Text className="text-6xl mb-4">📷</Text>
        <Text className="text-white text-xl font-bold text-center mb-3">
          Permiso de cámara necesario
        </Text>
        <Text className="text-gray-400 text-center mb-8">
          Necesitamos acceso a la cámara para escanear los códigos QR de los clientes
        </Text>
        <TouchableOpacity
          className="bg-primary-500 px-8 py-4 rounded-2xl"
          onPress={requestPermission}
        >
          <Text className="text-white font-bold text-base">Permitir cámara</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!businessId) {
    return (
      <SafeAreaView className="flex-1 bg-gray-900 items-center justify-center px-8">
        <Text className="text-5xl mb-4">🏪</Text>
        <Text className="text-white text-lg font-bold text-center">
          Primero configura tu negocio
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* Cámara */}
      {isActive && scanState === 'scanning' && (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarCodeScanned}
        >
          {/* Overlay oscuro con hueco central */}
          <SafeAreaView className="flex-1">
            <View className="flex-1 items-center justify-center">
              {/* Header */}
              <View className="absolute top-0 left-0 right-0 px-5 pt-4 pb-6 bg-black/60">
                <Text className="text-white text-xl font-bold text-center">
                  📷 Escanear cliente
                </Text>
                <Text className="text-gray-300 text-sm text-center mt-1">
                  Apunta al código QR del cliente
                </Text>
              </View>

              {/* Marco del escáner */}
              <View className="relative">
                <View
                  className="w-64 h-64 rounded-3xl"
                  style={{
                    borderWidth: 3,
                    borderColor: '#6C3DF4',
                    backgroundColor: 'transparent',
                  }}
                />
                {/* Esquinas decorativas */}
                {['tl', 'tr', 'bl', 'br'].map((corner) => (
                  <View
                    key={corner}
                    className="absolute w-8 h-8"
                    style={{
                      top: corner.startsWith('t') ? -2 : undefined,
                      bottom: corner.startsWith('b') ? -2 : undefined,
                      left: corner.endsWith('l') ? -2 : undefined,
                      right: corner.endsWith('r') ? -2 : undefined,
                      borderTopWidth: corner.startsWith('t') ? 4 : 0,
                      borderBottomWidth: corner.startsWith('b') ? 4 : 0,
                      borderLeftWidth: corner.endsWith('l') ? 4 : 0,
                      borderRightWidth: corner.endsWith('r') ? 4 : 0,
                      borderColor: '#F4A33D',
                      borderRadius: 4,
                    }}
                  />
                ))}
              </View>

              <View className="mt-8 bg-black/60 rounded-2xl px-6 py-3">
                <Text className="text-white text-sm text-center">
                  Pide al cliente que abra su QR en la app
                </Text>
              </View>
            </View>
          </SafeAreaView>
        </CameraView>
      )}

      {/* Estado: Cargando */}
      {scanState === 'loading' && (
        <SafeAreaView className="flex-1 bg-gray-900 items-center justify-center">
          <ActivityIndicator size="large" color="#6C3DF4" />
          <Text className="text-white text-base mt-4">Procesando...</Text>
        </SafeAreaView>
      )}

      {/* Estado: Error */}
      {scanState === 'error' && (
        <SafeAreaView className="flex-1 bg-gray-900 items-center justify-center px-8">
          <Text className="text-6xl mb-4">❌</Text>
          <Text className="text-white text-xl font-bold text-center">
            QR inválido o expirado
          </Text>
          <Text className="text-gray-400 text-center mt-2">
            El código no es válido o ha expirado. Pide al cliente que regenere su QR.
          </Text>
        </SafeAreaView>
      )}

      {/* Modal: Seleccionar campaña y confirmar */}
      <Modal
        visible={scanState === 'select_campaign' || scanState === 'success'}
        animationType="slide"
        transparent={true}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl px-5 pt-5 pb-10 max-h-4/5">
            {/* Handle */}
            <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center mb-4" />

            {/* SUCCESS */}
            {scanState === 'success' && stampResult && scannedCustomer && (
              <View className="items-center py-4">
                <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-4">
                  <Text className="text-4xl">
                    {stampResult.reward_earned ? '🎉' : '✅'}
                  </Text>
                </View>
                <Text className="text-gray-900 text-2xl font-bold text-center">
                  {stampResult.reward_earned ? '¡Premio ganado!' : '¡Sello añadido!'}
                </Text>
                <Text className="text-gray-500 text-base text-center mt-2">
                  {scannedCustomer.profile.full_name}
                </Text>

                {stampResult.reward_earned && (
                  <View className="mt-4 bg-secondary-500/10 rounded-2xl px-6 py-4 w-full">
                    <Text className="text-secondary-500 font-bold text-center text-lg">
                      🎁 ¡El cliente ha ganado un premio!
                    </Text>
                    <Text className="text-secondary-500/70 text-center text-sm mt-1">
                      {selectedCampaign?.reward_description}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  className="bg-primary-500 rounded-2xl px-8 py-4 mt-6 w-full"
                  onPress={resetScanner}
                >
                  <Text className="text-white font-bold text-base text-center">
                    Escanear otro cliente
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* SELECCIONAR CAMPAÑA */}
            {scanState === 'select_campaign' && scannedCustomer && (
              <>
                {/* Info del cliente */}
                <View className="flex-row items-center bg-primary-50 rounded-2xl p-4 mb-5">
                  <View className="w-12 h-12 bg-primary-500 rounded-full items-center justify-center mr-3">
                    <Text className="text-white font-bold text-xl">
                      {scannedCustomer.profile.full_name?.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text className="text-gray-900 font-bold text-base">
                      {scannedCustomer.profile.full_name}
                    </Text>
                    <Text className="text-primary-500 text-sm font-medium">
                      ✅ Cliente verificado
                    </Text>
                  </View>
                </View>

                <Text className="text-gray-900 font-bold text-lg mb-1">
                  Selecciona la campaña
                </Text>
                <Text className="text-gray-400 text-sm mb-4">
                  ¿Para qué campaña quieres añadir el sello?
                </Text>

                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
                  {campaigns.map((campaign) => (
                    <TouchableOpacity
                      key={campaign.id}
                      className="flex-row items-center bg-gray-50 rounded-2xl p-4 mb-3 border-2 border-transparent active:border-primary-300"
                      onPress={() => handleAddStamp(campaign)}
                      activeOpacity={0.7}
                    >
                      <View className="w-12 h-12 bg-primary-100 rounded-xl items-center justify-center mr-3">
                        <Text className="text-2xl">
                          {campaign.type === 'punch_card' ? '☕' :
                           campaign.type === 'points' ? '⭐' :
                           campaign.type === 'birthday' ? '🎂' : '🎯'}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-gray-900 font-semibold">{campaign.name}</Text>
                        <Text className="text-gray-400 text-xs mt-0.5" numberOfLines={1}>
                          🎁 {campaign.reward_description}
                        </Text>
                      </View>
                      <Text className="text-primary-500 text-xl">›</Text>
                    </TouchableOpacity>
                  ))}

                  {campaigns.length === 0 && (
                    <View className="items-center py-8">
                      <Text className="text-gray-400 text-center">
                        No tienes campañas activas.{'\n'}Crea una desde la pestaña Campañas.
                      </Text>
                    </View>
                  )}
                </ScrollView>

                <TouchableOpacity
                  className="mt-3 py-3"
                  onPress={resetScanner}
                >
                  <Text className="text-gray-400 text-center font-medium">Cancelar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
