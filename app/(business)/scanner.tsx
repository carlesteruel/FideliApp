import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal, ScrollView, ActivityIndicator, TextInput, StyleSheet } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuthStore } from '../../src/store/useAuthStore';
import { supabase } from '../../src/lib/supabase';
import { Campaign, LoyaltyCard, Profile, Reward, AddStampResult, ValidateRewardTokenResult, RedeemRewardResult } from '../../src/types/database';
import { colors } from '../../src/theme';
import { feedbackScan, feedbackSuccess, feedbackError } from '../../src/lib/feedback';


type ScanState = 'scanning' | 'loading' | 'select_campaign' | 'enter_amount' | 'success' | 'error' | 'redeem_confirm' | 'redeem_success';
interface ScannedCustomer { profile: Profile; token: string; }
interface ScannedReward { reward: Reward; campaign: Campaign | null; profile: Profile; token: string; }
interface ValidateQrTokenResult {
  success: boolean;
  error?: 'unauthorized' | 'not_found' | 'used' | 'expired';
  customer_id?: string;
  profile?: Profile;
}

export default function ScannerScreen() {
  const { profile } = useAuthStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [scannedCustomer, setScannedCustomer] = useState<ScannedCustomer | null>(null);
  const [scannedReward, setScannedReward] = useState<ScannedReward | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [stampResult, setStampResult] = useState<AddStampResult | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('El código no es válido o ha expirado. Pide al cliente que regenere su QR.');
  const [amountSpent, setAmountSpent] = useState('');
  const [customerCards, setCustomerCards] = useState<LoyaltyCard[]>([]);
  const scannedRef = useRef(false);

  // Puntos que se van a otorgar según el importe introducido (campañas de puntos).
  const pointsPreview = (() => {
    if (!selectedCampaign || selectedCampaign.type !== 'points') return 0;
    const perEuro = (selectedCampaign.config as any)?.points_per_euro ?? 0;
    const amount = parseFloat(amountSpent.replace(',', '.'));
    if (!amount || amount <= 0) return 0;
    return Math.floor(amount * perEuro);
  })();

  // Para min_spend: compara importe con el mínimo de la campaña seleccionada.
  const minSpendMet = (() => {
    if (!selectedCampaign || selectedCampaign.type !== 'min_spend') return false;
    const min = (selectedCampaign.config as any)?.min_amount ?? 20;
    const amount = parseFloat(amountSpent.replace(',', '.'));
    return amount >= min;
  })();

  // Tarjeta del cliente para la campaña seleccionada (para mostrar progreso de racha, etc.)
  const cardForCampaign = (campaignId: string) =>
    customerCards.find((c) => c.campaign_id === campaignId) ?? null;


  useEffect(() => {
    if (!profile) return;
    supabase.from('businesses').select('id').eq('owner_id', profile.id).single().then(({ data }) => { if (data) setBusinessId((data as any).id); });
  }, [profile]);

  const fetchCampaigns = useCallback(async () => {
    if (!businessId) return;
    // Traemos las campañas que no están archivadas. Las "activas" deben estar
    // is_active = true; las "terminadas" (ended) se muestran igualmente para
    // que los clientes con cartón en curso puedan terminarlo.
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .eq('business_id', businessId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false });
    if (data) {
      const usable = (data as Campaign[]).filter((c) => c.status === 'ended' || c.is_active);
      setCampaigns(usable);
    }

  }, [businessId]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  // Realtime: si se crea/edita/desactiva una campaña en otra pestaña,
  // refrescamos la lista inmediatamente.
  useEffect(() => {
    if (!businessId) return;
    const channel = supabase
      .channel(`scanner-campaigns-${businessId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaigns', filter: `business_id=eq.${businessId}` },
        () => { fetchCampaigns(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [businessId, fetchCampaigns]);

  useFocusEffect(useCallback(() => {
    setIsActive(true); scannedRef.current = false; setScanState('scanning');
    // Refrescamos campañas al volver al escáner por si se han creado/modificado.
    fetchCampaigns();
    return () => setIsActive(false);
  }, [fetchCampaigns]));

  const failWithMessage = (msg: string) => {
    setErrorMessage(msg);
    setScanState('error');
    feedbackError();
    setTimeout(() => resetScanner(), 3000);
  };


  const handleBarCodeScanned = async ({ data: qrData }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setScanState('loading');
    feedbackScan();

    try {
      // Si es un QR de canje de premio, lo gestionamos en su propio flujo.
      if (qrData.startsWith('fideliapp://reward/')) {
        await handleRewardScan(qrData.replace('fideliapp://reward/', ''));
        return;
      }
      const token = qrData.startsWith('fideliapp://qr/') ? qrData.replace('fideliapp://qr/', '') : qrData;
      const { data, error } = await supabase.rpc('validate_qr_token', { p_token: token });
      if (error) {
        console.error('validate_qr_token error', error);
        failWithMessage('No se pudo validar el QR. Inténtalo de nuevo.');
        return;
      }
      const result = data as ValidateQrTokenResult | null;
      if (!result?.success || !result.profile) {
        const reason = result?.error;
        failWithMessage(
          reason === 'expired'   ? 'El QR ha expirado. Pide al cliente que lo regenere.' :
          reason === 'used'      ? 'Este QR ya ha sido usado.' :
          reason === 'not_found' ? 'QR no reconocido.' :
          reason === 'unauthorized' ? 'Sesión no válida. Vuelve a iniciar sesión.' :
          'El código no es válido o ha expirado. Pide al cliente que regenere su QR.'
        );
        return;
      }
      setScannedCustomer({ profile: result.profile, token });
      // Cargar tarjetas del cliente para mostrar progreso (racha, visitas mensuales, etc.)
      supabase
        .from('loyalty_cards')
        .select('*')
        .eq('customer_id', result.profile.id)
        .eq('business_id', businessId)
        .then(({ data: cards }) => { if (cards) setCustomerCards(cards as LoyaltyCard[]); });
      setScanState('select_campaign');
    } catch (e) {
      console.error(e);
      failWithMessage('No se pudo validar el QR. Inténtalo de nuevo.');
    }
  };

  // Al seleccionar una campaña: puntos y gasto_mínimo piden importe; el resto sella directo.
  const handleSelectCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    if (campaign.type === 'points' || campaign.type === 'min_spend') {
      setAmountSpent('');
      setScanState('enter_amount');
    } else {
      handleAddStamp(campaign);
    }
  };

  // Traduce los errores de los triggers de ciclo de vida a mensajes claros.
  const lifecycleMessage = (raw?: string): string | null => {
    if (!raw) return null;
    if (raw.includes('campaign_not_accepting_new_cards')) return 'Esta campaña está terminada y no admite nuevos clientes. Solo quienes ya tienen una tarjeta pueden completarla.';
    if (raw.includes('campaign_ended_card_completed')) return 'La tarjeta de este cliente para esta campaña ya está completada. La campaña está terminada y no admite más sellos.';
    if (raw.includes('campaign_archived')) return 'Esta campaña está archivada y no admite sellos ni puntos.';
    return null;
  };

  const handleAddStamp = async (campaign: Campaign, amount?: number) => {
    if (!scannedCustomer || !profile) return;
    setScanState('loading');
    try {
      const args: Record<string, any> = { p_customer_id: scannedCustomer.profile.id, p_campaign_id: campaign.id, p_stamped_by: profile.id };
      if (typeof amount === 'number' && amount > 0) args.p_amount_spent = amount;
      const { data, error } = await supabase.rpc('add_stamp', args);
      if (error) throw error;
      await supabase.rpc('consume_qr_token', { p_token: scannedCustomer.token });
      setStampResult(data as AddStampResult);
      setSelectedCampaign(campaign);
      setScanState('success');
      feedbackSuccess();
    } catch (e: any) {
      const friendly = lifecycleMessage(e?.message);
      feedbackError();
      if (friendly) {
        failWithMessage(friendly);
      } else {
        Alert.alert('Error', e.message ?? 'Error al añadir el sello');
        setScanState('error'); setTimeout(() => resetScanner(), 3000);
      }
    }

  };

  const handleConfirmAmount = () => {
    if (!selectedCampaign) return;
    const amount = parseFloat(amountSpent.replace(',', '.'));
    if (!amount || amount <= 0) {
      Alert.alert('Importe no válido', 'Introduce el importe de la compra en €.');
      return;
    }
    handleAddStamp(selectedCampaign, amount);
  };

  // Etiquetas de info de campaña en la lista del escáner
  const campaignInfoLine = (c: Campaign): string => {
    const card = cardForCampaign(c.id);
    const cfg = c.config as any;
    if (c.type === 'streak') {
      const req = cfg?.visits_required ?? 5;
      const days = cfg?.period_days ?? 7;
      const streak = card?.current_streak ?? 0;
      return `🔥 Racha: ${streak}/${req} visitas en ${days} días`;
    }
    if (c.type === 'monthly_visits') {
      const req = cfg?.visits_required ?? 4;
      const cur = card?.current_stamps ?? 0;
      return `📅 Este mes: ${cur}/${req} visitas`;
    }
    if (c.type === 'min_spend') return `💶 Premio a partir de ${cfg?.min_amount ?? 20}€`;
    if (c.type === 'first_visit') {
      const isFirst = !card || card.total_stamps_ever === 0;
      return isFirst ? '👋 Primera visita — el cliente recibirá premio' : '👋 Primera visita (ya recibida)';
    }
    if (c.type === 'punch_card') {
      const total = cfg?.total_stamps ?? 10;
      const cur = card?.current_stamps ?? 0;
      return `${cur}/${total} sellos`;
    }
    if (c.type === 'birthday') {
      if (!scannedCustomer?.profile?.birth_date) {
        return '⚠️ Sin fecha de nacimiento — el premio no se generará';
      }
      return '🎂 Registra al cliente en campaña cumpleaños';
    }
    if (c.type === 'referral') return '👥 Sella para confirmar referido';
    if (c.type === 'points') return `⭐ ${cfg?.points_per_euro ?? 10} pts/€`;
    return '';
  };


  const handleRewardScan = async (token: string) => {
    try {
      const { data, error } = await supabase.rpc('validate_reward_token', { p_token: token });
      if (error) {
        console.error('validate_reward_token error', error);
        failWithMessage('No se pudo validar el código de canje. Inténtalo de nuevo.');
        return;
      }
      const result = data as ValidateRewardTokenResult | null;
      if (!result?.success || !result.reward || !result.profile) {
        const reason = result?.error;
        failWithMessage(
          reason === 'expired'          ? 'El código de canje ha expirado. Pide al cliente que lo regenere.' :
          reason === 'used'             ? 'Este código de canje ya se ha usado.' :
          reason === 'already_redeemed' ? 'Este premio ya ha sido canjeado.' :
          reason === 'not_found'        ? 'Código de canje no reconocido.' :
          reason === 'unauthorized'     ? 'Este premio no pertenece a tu negocio.' :
          'El código no es válido o ha expirado.'
        );
        return;
      }
      setScannedReward({ reward: result.reward, campaign: result.campaign ?? null, profile: result.profile, token });
      setScanState('redeem_confirm');
    } catch (e) {
      console.error(e);
      failWithMessage('No se pudo validar el código de canje. Inténtalo de nuevo.');
    }
  };

  const handleConfirmRedeem = async () => {
    if (!scannedReward) return;
    setScanState('loading');
    try {
      const { data, error } = await supabase.rpc('redeem_reward_token', { p_token: scannedReward.token });
      if (error) throw error;
      const result = data as RedeemRewardResult | null;
      if (!result?.success) {
        const reason = result?.error;
        failWithMessage(
          reason === 'already_redeemed' ? 'Este premio ya ha sido canjeado.' :
          reason === 'expired'          ? 'El código de canje ha expirado.' :
          reason === 'used'             ? 'Este código de canje ya se ha usado.' :
          reason === 'unauthorized'     ? 'Este premio no pertenece a tu negocio.' :
          'No se pudo canjear el premio.'
        );
        return;
      }
      setScanState('redeem_success');
      feedbackSuccess();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Error al canjear el premio');
      feedbackError();
      setScanState('error'); setTimeout(() => resetScanner(), 3000);
    }

  };

  const resetScanner = () => { scannedRef.current = false; setScannedCustomer(null); setScannedReward(null); setSelectedCampaign(null); setStampResult(null); setCustomerCards([]); setScanState('scanning'); };

  if (!permission) return <SafeAreaView style={s.dark}><ActivityIndicator color={colors.white} /></SafeAreaView>;

  if (!permission.granted) return (
    <SafeAreaView style={[s.dark, s.center]}>
      <Text style={{ fontSize: 60, marginBottom: 16 }}>📷</Text>
      <Text style={s.permTitle}>Permiso de cámara necesario</Text>
      <Text style={s.permSub}>Necesitamos acceso a la cámara para escanear los códigos QR de los clientes</Text>
      <TouchableOpacity style={s.permBtn} onPress={requestPermission}><Text style={s.permBtnText}>Permitir cámara</Text></TouchableOpacity>
    </SafeAreaView>
  );

  if (!businessId) return (
    <SafeAreaView style={[s.dark, s.center]}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>🏪</Text>
      <Text style={s.permTitle}>Primero configura tu negocio</Text>
    </SafeAreaView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      {isActive && scanState === 'scanning' && (
        <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={handleBarCodeScanned}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={s.cameraOverlay}>
              <View style={s.cameraHeader}>
                <Text style={s.cameraTitle}>📷 Escanear cliente</Text>
                <Text style={s.cameraSub}>Apunta al código QR del cliente</Text>
              </View>
              <View style={s.qrFrame}>
                {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
                  <View key={corner} style={[s.corner, {
                    top: corner.startsWith('t') ? -2 : undefined, bottom: corner.startsWith('b') ? -2 : undefined,
                    left: corner.endsWith('l') ? -2 : undefined, right: corner.endsWith('r') ? -2 : undefined,
                    borderTopWidth: corner.startsWith('t') ? 4 : 0, borderBottomWidth: corner.startsWith('b') ? 4 : 0,
                    borderLeftWidth: corner.endsWith('l') ? 4 : 0, borderRightWidth: corner.endsWith('r') ? 4 : 0,
                  }]} />
                ))}
              </View>
              <View style={s.cameraHint}><Text style={s.cameraHintText}>Pide al cliente que abra su QR en la app</Text></View>
            </View>
          </SafeAreaView>
        </CameraView>
      )}

      {scanState === 'loading' && <SafeAreaView style={[s.dark, s.center]}><ActivityIndicator size="large" color={colors.primary500} /><Text style={s.loadingText}>Procesando...</Text></SafeAreaView>}
      {scanState === 'error' && (
        <SafeAreaView style={[s.dark, s.center]}>
          <Text style={{ fontSize: 60, marginBottom: 16 }}>❌</Text>
          <Text style={s.permTitle}>QR inválido o expirado</Text>
          <Text style={s.permSub}>{errorMessage}</Text>
        </SafeAreaView>
      )}

      <Modal visible={scanState === 'select_campaign' || scanState === 'enter_amount' || scanState === 'success'} animationType="slide" transparent>
        <View style={s.modalBg}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />

            {scanState === 'success' && stampResult && scannedCustomer && (
              <View style={s.successBlock}>
                <View style={s.successIcon}><Text style={{ fontSize: 40 }}>{stampResult.reward_earned ? '🎉' : selectedCampaign?.type === 'points' ? '⭐' : '✅'}</Text></View>
                <Text style={s.successTitle}>{stampResult.reward_earned ? '¡Premio ganado!' : selectedCampaign?.type === 'points' ? '¡Puntos añadidos!' : '¡Sello añadido!'}</Text>
                <Text style={s.successName}>{scannedCustomer.profile.full_name}</Text>
                {selectedCampaign?.type === 'points' && pointsPreview > 0 && (
                  <View style={s.pointsAlert}>
                    <Text style={s.pointsAlertText}>+{pointsPreview} puntos</Text>
                  </View>
                )}
                {stampResult.reward_earned && (
                  <View style={s.rewardAlert}>
                    <Text style={s.rewardAlertTitle}>🎁 ¡El cliente ha ganado un premio!</Text>
                    <Text style={s.rewardAlertSub}>{selectedCampaign?.reward_description}</Text>
                  </View>
                )}
                <TouchableOpacity style={s.nextBtn} onPress={resetScanner}>
                  <Text style={s.nextBtnText}>Escanear otro cliente</Text>
                </TouchableOpacity>
              </View>
            )}

            {scanState === 'enter_amount' && scannedCustomer && selectedCampaign && (
              <>
                <View style={s.customerBox}>
                  <View style={s.customerAvatar}><Text style={s.customerAvatarText}>{scannedCustomer.profile.full_name?.charAt(0).toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.customerName}>{scannedCustomer.profile.full_name}</Text>
                    <Text style={s.customerVerified}>⭐ {selectedCampaign.name}</Text>
                  </View>
                </View>
                <Text style={s.selectTitle}>Importe de la compra</Text>
                <Text style={s.selectSub}>
                  {selectedCampaign.type === 'min_spend'
                    ? `Premio si supera ${(selectedCampaign.config as any)?.min_amount ?? 20}€ en esta compra.`
                    : `Se sumarán ${(selectedCampaign.config as any)?.points_per_euro ?? 0} pts por cada €.`}
                </Text>
                <View style={s.amountInputWrap}>
                  <TextInput
                    style={s.amountInput}
                    value={amountSpent}
                    onChangeText={setAmountSpent}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.gray300}
                    autoFocus
                  />
                  <Text style={s.amountCurrency}>€</Text>
                </View>
                {(() => {
                  const isMinSpend = selectedCampaign.type === 'min_spend';
                  const minAmount = (selectedCampaign.config as any)?.min_amount ?? 20;
                  const parsedAmt = parseFloat(amountSpent.replace(',', '.'));
                  const amtValid = parsedAmt > 0;
                  const previewText = isMinSpend
                    ? (amtValid ? (minSpendMet ? `✅ Supera ${minAmount}€ — ¡el cliente ganará un premio!` : `⚠️ Aún no supera ${minAmount}€ (faltan ${(minAmount - parsedAmt).toFixed(2)}€)`) : `Mínimo para ganar el premio: ${minAmount}€`)
                    : (pointsPreview > 0 ? `El cliente ganará ${pointsPreview} puntos` : 'Introduce un importe para calcular los puntos');
                  const previewColor = isMinSpend && amtValid && minSpendMet ? colors.green600 : isMinSpend && amtValid && !minSpendMet ? colors.secondary500 : colors.primary600;
                  const bgColor = isMinSpend && amtValid && minSpendMet ? '#DCFCE7' : isMinSpend && amtValid && !minSpendMet ? '#FEF3E2' : colors.primary50;
                  return (
                    <>
                      <View style={[s.pointsPreviewBox, { backgroundColor: bgColor }]}>
                        <Text style={[s.pointsPreviewText, { color: previewColor }]}>{previewText}</Text>
                      </View>
                      <TouchableOpacity style={[s.nextBtn, !amtValid && { opacity: 0.5 }]} onPress={handleConfirmAmount} disabled={!amtValid} activeOpacity={0.8}>
                        <Text style={s.nextBtnText}>{isMinSpend ? 'Registrar compra' : 'Añadir puntos'}</Text>
                      </TouchableOpacity>
                    </>
                  );
                })()}
                <TouchableOpacity style={s.cancelBtn} onPress={() => setScanState('select_campaign')}><Text style={s.cancelText}>Atrás</Text></TouchableOpacity>
              </>
            )}

            {scanState === 'select_campaign' && scannedCustomer && (
              <>
                <View style={s.customerBox}>
                  <View style={s.customerAvatar}><Text style={s.customerAvatarText}>{scannedCustomer.profile.full_name?.charAt(0).toUpperCase()}</Text></View>
                  <View>
                    <Text style={s.customerName}>{scannedCustomer.profile.full_name}</Text>
                    <Text style={s.customerVerified}>✅ Cliente verificado</Text>
                  </View>
                </View>
                <Text style={s.selectTitle}>Selecciona la campaña</Text>
                <Text style={s.selectSub}>¿En qué campaña quieres registrar la visita?</Text>
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
                  {campaigns.map((c) => {
                    const EMOJI: Record<string, string> = { punch_card: '☕', points: '⭐', birthday: '🎂', streak: '🔥', first_visit: '👋', min_spend: '💶', monthly_visits: '📅', referral: '👥' };
                    return (
                      <TouchableOpacity key={c.id} style={s.campaignRow} onPress={() => handleSelectCampaign(c)} activeOpacity={0.7}>
                        <View style={s.campaignIcon}><Text style={{ fontSize: 24 }}>{EMOJI[c.type] ?? '🎯'}</Text></View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.campaignName}>{c.name}</Text>
                          <Text style={s.campaignReward} numberOfLines={1}>{campaignInfoLine(c)}</Text>
                          {c.status === 'ended' && <Text style={s.endedTag}>🏁 Terminada · solo finaliza cartones</Text>}
                        </View>
                        <Text style={{ color: colors.primary500, fontSize: 20 }}>›</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {campaigns.length === 0 && <View style={{ paddingVertical: 32 }}><Text style={{ color: colors.gray400, textAlign: 'center' }}>No tienes campañas activas.{'\n'}Crea una desde la pestaña Campañas.</Text></View>}
                </ScrollView>
                <TouchableOpacity style={s.cancelBtn} onPress={resetScanner}><Text style={s.cancelText}>Cancelar</Text></TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>


      {/* Modal de canje de premio */}
      <Modal visible={scanState === 'redeem_confirm' || scanState === 'redeem_success'} animationType="slide" transparent>
        <View style={s.modalBg}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />

            {scanState === 'redeem_success' && scannedReward && (
              <View style={s.successBlock}>
                <View style={s.successIcon}><Text style={{ fontSize: 40 }}>🎁</Text></View>
                <Text style={s.successTitle}>¡Premio canjeado!</Text>
                <Text style={s.successName}>{scannedReward.profile.full_name}</Text>
                <View style={s.rewardAlert}>
                  <Text style={s.rewardAlertTitle}>🎉 Entrega el premio al cliente</Text>
                  <Text style={s.rewardAlertSub}>{scannedReward.reward.description}</Text>
                </View>
                <TouchableOpacity style={s.nextBtn} onPress={resetScanner}>
                  <Text style={s.nextBtnText}>Escanear otro código</Text>
                </TouchableOpacity>
              </View>
            )}

            {scanState === 'redeem_confirm' && scannedReward && (
              <>
                <View style={s.customerBox}>
                  <View style={s.customerAvatar}><Text style={s.customerAvatarText}>{scannedReward.profile.full_name?.charAt(0).toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.customerName}>{scannedReward.profile.full_name}</Text>
                    <Text style={s.customerVerified}>🎁 Premio por canjear</Text>
                  </View>
                </View>
                {scannedReward.campaign && <Text style={s.selectSub}>{scannedReward.campaign.name}</Text>}
                <View style={s.redeemRewardBox}>
                  <Text style={s.redeemRewardLabel}>🎁 Premio a entregar</Text>
                  <Text style={s.redeemRewardText}>{scannedReward.reward.description}</Text>
                </View>
                <TouchableOpacity style={s.nextBtn} onPress={handleConfirmRedeem} activeOpacity={0.8}>
                  <Text style={s.nextBtnText}>Confirmar canje</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.cancelBtn} onPress={resetScanner}><Text style={s.cancelText}>Cancelar</Text></TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  dark:       { flex: 1, backgroundColor: '#111827' },
  center:     { alignItems: 'center', justifyContent: 'center', padding: 32 },
  permTitle:  { color: colors.white, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  permSub:    { color: colors.gray400, textAlign: 'center', marginBottom: 32 },
  permBtn:    { backgroundColor: colors.primary500, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16 },
  permBtnText:{ color: colors.white, fontWeight: '700', fontSize: 16 },
  loadingText:{ color: colors.white, fontSize: 16, marginTop: 16 },
  cameraOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cameraHeader:{ position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, backgroundColor: 'rgba(0,0,0,0.6)' },
  cameraTitle: { color: colors.white, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  cameraSub:   { color: colors.gray300, fontSize: 14, textAlign: 'center', marginTop: 4 },
  qrFrame:     { width: 256, height: 256, borderWidth: 3, borderColor: colors.primary500, borderRadius: 24, position: 'relative' },
  corner:      { position: 'absolute', width: 32, height: 32, borderColor: colors.secondary500, borderRadius: 4 },
  cameraHint:  { marginTop: 32, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12 },
  cameraHintText: { color: colors.white, fontSize: 14, textAlign: 'center' },
  modalBg:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:  { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, maxHeight: '85%' },
  modalHandle: { width: 48, height: 6, backgroundColor: colors.gray200, borderRadius: 99, alignSelf: 'center', marginBottom: 16 },
  successBlock:{ alignItems: 'center', paddingVertical: 16 },
  successIcon: { width: 80, height: 80, backgroundColor: colors.green100, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successTitle:{ color: colors.gray900, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  successName: { color: colors.gray500, fontSize: 16, textAlign: 'center', marginTop: 8 },
  rewardAlert: { marginTop: 16, backgroundColor: '#FEF3E2', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 16, width: '100%' },
  rewardAlertTitle: { color: colors.secondary500, fontWeight: '700', textAlign: 'center', fontSize: 18 },
  rewardAlertSub:   { color: colors.secondary500, textAlign: 'center', fontSize: 14, marginTop: 4, opacity: 0.7 },
  nextBtn:     { backgroundColor: colors.primary500, borderRadius: 16, paddingHorizontal: 32, paddingVertical: 16, marginTop: 24, width: '100%' },
  nextBtnText: { color: colors.white, fontWeight: '700', fontSize: 16, textAlign: 'center' },
  customerBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary50, borderRadius: 16, padding: 16, marginBottom: 20 },
  customerAvatar: { width: 48, height: 48, backgroundColor: colors.primary500, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  customerAvatarText: { color: colors.white, fontWeight: '700', fontSize: 20 },
  customerName:  { color: colors.gray900, fontWeight: '700', fontSize: 16 },
  customerVerified: { color: colors.primary500, fontSize: 14, fontWeight: '500' },
  selectTitle:   { color: colors.gray900, fontWeight: '700', fontSize: 18, marginBottom: 4 },
  selectSub:     { color: colors.gray400, fontSize: 14, marginBottom: 16 },
  campaignRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray50, borderRadius: 16, padding: 16, marginBottom: 12 },
  campaignIcon:  { width: 48, height: 48, backgroundColor: colors.primary100, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  campaignName:  { color: colors.gray900, fontWeight: '600' },
  campaignReward:{ color: colors.gray400, fontSize: 12, marginTop: 2 },
  cancelBtn:     { paddingVertical: 12, marginTop: 8 },
  cancelText:    { color: colors.gray400, textAlign: 'center', fontWeight: '500' },
  redeemRewardBox:   { backgroundColor: colors.primary50, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginTop: 8, marginBottom: 4 },
  redeemRewardLabel: { color: colors.primary600, fontSize: 12, fontWeight: '600', marginBottom: 4 },
  redeemRewardText:  { color: colors.gray900, fontWeight: '700', fontSize: 16 },
  endedTag:      { color: colors.secondary500, fontSize: 11, fontWeight: '700', marginTop: 4 },
  amountInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray50, borderRadius: 16, borderWidth: 2, borderColor: colors.primary100, paddingHorizontal: 16, marginBottom: 12 },
  amountInput:   { flex: 1, fontSize: 32, fontWeight: '700', color: colors.gray900, paddingVertical: 12 },
  amountCurrency:{ fontSize: 28, fontWeight: '700', color: colors.gray400, marginLeft: 8 },
  pointsPreviewBox: { backgroundColor: colors.primary50, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 4 },
  pointsPreviewText:{ color: colors.primary600, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  pointsAlert:   { marginTop: 16, backgroundColor: colors.primary50, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 12 },
  pointsAlertText:{ color: colors.primary600, fontWeight: '700', textAlign: 'center', fontSize: 20 },
});

