import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { useAuthStore } from '../../src/store/useAuthStore';
import { supabase } from '../../src/lib/supabase';
import { colors } from '../../src/theme';

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
      // 1) Insertamos el nuevo token (su expires_at lo pone el DEFAULT del servidor)
      const { data, error } = await supabase
        .from('customer_qr_tokens')
        .insert({ customer_id: user.id })
        .select()
        .single();
      if (error || !data) throw error;
      const d = data as any;

      // 2) Solo cuando el nuevo existe, invalidamos los anteriores (sin tocar este)
      await supabase
        .from('customer_qr_tokens')
        .update({ used: true })
        .eq('customer_id', user.id)
        .eq('used', false)
        .neq('id', d.id);

      const exp = new Date(d.expires_at);
      setToken(d.token);
      setExpiresAt(exp);
      // Calculamos los segundos restantes con el tiempo real del servidor,
      // no asumimos QR_VALIDITY_MINUTES fijo (evita desfases de reloj).
      setSecondsLeft(Math.max(0, Math.floor((exp.getTime() - Date.now()) / 1000)));
    } catch (e) {
      Alert.alert('Error', 'No se pudo generar el código QR');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { generateToken(); return () => {}; }, [user]));

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const r = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setSecondsLeft(r);
      if (r === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const qrValue = token ? `fideliapp://qr/${token}` : '';
  const isExpired = secondsLeft === 0 && !loading;
  const pct = (secondsLeft / (QR_VALIDITY_MINUTES * 60)) * 100;
  const timerColor = secondsLeft < 60 ? colors.red400 : secondsLeft < 120 ? colors.yellow400 : colors.primary500;

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={{ fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Mi código QR</Text>
      </View>

      <View style={s.body}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary500} />
        ) : (
          <>
            <Text style={s.subtext}>Muestra este código al negocio</Text>
            <Text style={s.nameText}>{profile?.full_name}</Text>

            <View style={[s.qrBox, { borderColor: isExpired ? colors.red100 : colors.primary500, opacity: isExpired ? 0.4 : 1, elevation: 8 }]}>
              {!isExpired && qrValue ? (
                <QRCode value={qrValue} size={220} color={colors.gray900} backgroundColor={colors.white} quietZone={10} />
              ) : (
                <View style={s.expiredBox}>
                  <Text style={{ fontSize: 48, marginBottom: 8 }}>⏰</Text>
                  <Text style={s.expiredText}>QR Expirado</Text>
                </View>
              )}
            </View>

            {!isExpired && (
              <View style={s.timerBlock}>
                <View style={s.progressBg}>
                  <View style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: timerColor }]} />
                </View>
                <Text style={[s.timerText, { color: secondsLeft < 60 ? colors.red500 : colors.gray700 }]}>
                  ⏱ Válido {fmt(secondsLeft)}
                </Text>
                <Text style={s.timerSub}>Solo puede usarse una vez</Text>
              </View>
            )}

            <TouchableOpacity onPress={generateToken} style={[s.regenBtn, { backgroundColor: isExpired ? colors.primary500 : colors.gray100 }]}>
              <Text style={[s.regenText, { color: isExpired ? colors.white : colors.gray600 }]}>
                🔄 {isExpired ? 'Generar nuevo QR' : 'Regenerar QR'}
              </Text>
            </TouchableOpacity>

            <View style={s.infoBox}>
              <Text style={s.infoText}>💡 El negocio escaneará este QR para añadir un sello a tu tarjeta de fidelización</Text>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: colors.white },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  backBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitle: { color: colors.gray900, fontSize: 20, fontWeight: '700' },
  body:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  subtext:     { color: colors.gray500, fontSize: 14, textAlign: 'center', marginBottom: 4 },
  nameText:    { color: colors.gray900, fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
  qrBox:       { padding: 20, borderRadius: 24, borderWidth: 4 },
  expiredBox:  { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  expiredText: { color: colors.gray500, fontWeight: '500', textAlign: 'center' },
  timerBlock:  { alignItems: 'center', marginTop: 24, width: '100%' },
  progressBg:  { width: '100%', height: 8, backgroundColor: colors.gray100, borderRadius: 99, overflow: 'hidden', marginBottom: 8 },
  progressFill:{ height: '100%', borderRadius: 99 },
  timerText:   { fontWeight: '700', fontSize: 18 },
  timerSub:    { color: colors.gray400, fontSize: 12, marginTop: 4 },
  regenBtn:    { marginTop: 24, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16 },
  regenText:   { fontWeight: '700', fontSize: 16, textAlign: 'center' },
  infoBox:     { marginTop: 24, backgroundColor: colors.primary50, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, width: '100%' },
  infoText:    { color: colors.primary600, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
