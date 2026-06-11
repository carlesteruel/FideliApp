import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity,
  ActivityIndicator, Modal, Alert, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { useAuthStore } from '../../src/store/useAuthStore';
import { supabase } from '../../src/lib/supabase';
import { RewardWithDetails, CreateRewardTokenResult } from '../../src/types/database';
import { colors, fonts } from '../../src/theme';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { ConfettiOverlay } from '../../src/components/ui/ConfettiOverlay';
import { feedbackRedeemed } from '../../src/lib/feedback';

export default function RewardsScreen() {
  const { user } = useAuthStore();
  const [rewards,    setRewards]    = useState<RewardWithDetails[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(false);
  const [activeTab,  setActiveTab]  = useState<'pending' | 'redeemed' | 'expired'>('pending');
  const firstLoad = useRef(true);

  // Modal de canje
  const [redeemTarget,     setRedeemTarget]     = useState<RewardWithDetails | null>(null);
  const [redeemToken,      setRedeemToken]      = useState<string | null>(null);
  const [redeemExpiresAt,  setRedeemExpiresAt]  = useState<Date | null>(null);
  const [redeemSecondsLeft,setRedeemSecondsLeft]= useState(0);
  const [redeemLoading,    setRedeemLoading]    = useState(false);
  const [redeemDone,       setRedeemDone]       = useState(false);
  const redeemTargetRef = useRef<RewardWithDetails | null>(null);

  const fetchRewards = async () => {
    if (!user) return;
    try {
      const { data, error: err } = await supabase
        .from('rewards')
        .select('*, campaigns (id, name, type), businesses (id, name, logo_url)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setRewards((data ?? []) as RewardWithDetails[]);
      setError(false);
    } catch (e) {
      console.error(e);
      if (firstLoad.current) setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
      firstLoad.current = false;
    }
  };

  useFocusEffect(useCallback(() => { fetchRewards(); }, [user]));
  const onRefresh = () => { setRefreshing(true); fetchRewards(); };

  // Realtime — cuando el negocio canjea el premio
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`rewards-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rewards', filter: `customer_id=eq.${user.id}` },
        (payload) => {
          fetchRewards();
          const updated = payload.new as { id?: string; status?: string } | null;
          const target  = redeemTargetRef.current;
          if (target && updated?.id === target.id && updated.status === 'redeemed') {
            setRedeemDone(true);
            setRedeemToken(null);
            setRedeemExpiresAt(null);
            feedbackRedeemed(); // 🎉 Haptico de celebración
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Cuenta atrás del QR de canje
  useEffect(() => {
    if (!redeemExpiresAt) return;
    const interval = setInterval(() => {
      const r = Math.max(0, Math.floor((redeemExpiresAt.getTime() - Date.now()) / 1000));
      setRedeemSecondsLeft(r);
      if (r === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [redeemExpiresAt]);

  const openRedeem = async (reward: RewardWithDetails) => {
    setRedeemTarget(reward);
    redeemTargetRef.current = reward;
    setRedeemDone(false);
    setRedeemToken(null);
    setRedeemExpiresAt(null);
    await generateRedeemToken(reward);
  };

  const generateRedeemToken = async (reward: RewardWithDetails) => {
    setRedeemLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_reward_token', { p_reward_id: reward.id });
      if (error) throw error;
      const result = data as CreateRewardTokenResult | null;
      if (!result?.success || !result.token || !result.expires_at) {
        const reason = result?.error;
        Alert.alert(
          'No se pudo generar el código',
          reason === 'already_redeemed' ? 'Este premio ya ha sido canjeado.' :
          reason === 'expired'          ? 'Este premio ha expirado.' :
          'Inténtalo de nuevo.',
        );
        closeRedeem();
        return;
      }
      const exp = new Date(result.expires_at);
      setRedeemToken(result.token);
      setRedeemExpiresAt(exp);
      setRedeemSecondsLeft(Math.max(0, Math.floor((exp.getTime() - Date.now()) / 1000)));
    } catch (e) {
      Alert.alert('Error', 'No se pudo generar el código de canje');
      closeRedeem();
    } finally {
      setRedeemLoading(false);
    }
  };

  const closeRedeem = () => {
    setRedeemTarget(null);
    redeemTargetRef.current = null;
    setRedeemToken(null);
    setRedeemExpiresAt(null);
    setRedeemDone(false);
    fetchRewards();
  };

  const filtered     = rewards.filter((r) => r.status === activeTab);
  const pendingCount = rewards.filter((r) => r.status === 'pending').length;

  if (loading) return <SafeAreaView style={s.center}><ActivityIndicator size="large" color={colors.primary500} /></SafeAreaView>;

  if (error) return (
    <SafeAreaView style={s.center}>
      <Text style={{ fontSize: 56, marginBottom: 16 }}>⚠️</Text>
      <Text style={s.errorTitle}>No se pudieron cargar tus premios</Text>
      <Text style={s.errorSub}>Comprueba tu conexión e inténtalo de nuevo</Text>
      <TouchableOpacity style={s.retryBtn} onPress={() => { setLoading(true); firstLoad.current = true; fetchRewards(); }}>
        <Text style={s.retryText}>Reintentar</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );

  const TABS = [
    { key: 'pending'  as const, label: 'Por canjear' },
    { key: 'redeemed' as const, label: 'Canjeados' },
    { key: 'expired'  as const, label: 'Expirados' },
  ];

  const fmt        = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
  const redeemQrValue = redeemToken ? `fideliapp://reward/${redeemToken}` : '';
  const redeemExpired = redeemSecondsLeft === 0 && !redeemLoading && !redeemDone && !!redeemExpiresAt;

  const emptyMessages = {
    pending:  { title: '¡Nada por aquí! 👻', subtitle: 'Completa una tarjeta para ganar tu primer premio', variant: 'ghost' as const },
    redeemed: { title: 'Aún no has canjeado nada', subtitle: '¡Pero tu primer premio está más cerca de lo que crees!', variant: 'trophy' as const },
    expired:  { title: 'Sin premios expirados', subtitle: '¡Qué bien! Significa que los has canjeado a tiempo', variant: 'trophy' as const },
  };

  const emptyMsg = emptyMessages[activeTab];

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary500} />}
      >
        <View style={s.header}>
          <Text style={s.title}>Mis premios 🎁</Text>
          {pendingCount > 0 && (
            <View style={s.pendingBadge}>
              <Text style={s.pendingText}>
                🎉 {pendingCount} premio{pendingCount > 1 ? 's' : ''} por canjear
              </Text>
            </View>
          )}
        </View>

        {/* Tabs */}
        <View style={s.tabBar}>
          {TABS.map((tab) => {
            const count  = rewards.filter((r) => r.status === tab.key).length;
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[s.tab, active && s.tabActive]}
              >
                <Text style={[s.tabText, active ? s.tabTextActive : s.tabTextInactive]}>
                  {tab.label}{count > 0 ? ` (${count})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ paddingTop: 16 }}>
          {filtered.length === 0 ? (
            <EmptyState
              variant={emptyMsg.variant}
              title={emptyMsg.title}
              subtitle={emptyMsg.subtitle}
            />
          ) : (
            filtered.map((r) => <RewardCard key={r.id} reward={r} onRedeem={openRedeem} />)
          )}
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Modal de canje con QR */}
      <Modal visible={!!redeemTarget} animationType="slide" transparent onRequestClose={closeRedeem}>
        <View style={s.modalBg}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />

            {redeemDone ? (
              // ── Estado canjeado ─────────────────────────────
              <View style={s.redeemDoneBlock}>
                <View style={s.redeemDoneIcon}>
                  <Text style={{ fontSize: 44 }}>🎉</Text>
                </View>
                <Text style={s.redeemDoneTitle}>¡Premio canjeado!</Text>
                <Text style={s.redeemDoneSub}>Disfruta de tu recompensa</Text>
                <TouchableOpacity style={s.redeemPrimaryBtn} onPress={closeRedeem}>
                  <Text style={s.redeemPrimaryText}>Hecho</Text>
                </TouchableOpacity>

                {/* Confeti sobre el modal */}
                <ConfettiOverlay visible={redeemDone} />
              </View>
            ) : (
              <>
                <Text style={s.redeemTitle}>Canjear premio</Text>
                {redeemTarget && (
                  <Text style={s.redeemBiz}>
                    {redeemTarget.businesses?.name ?? '—'} · {redeemTarget.campaigns?.name ?? '—'}
                  </Text>
                )}
                <View style={s.redeemRewardBox}>
                  <Text style={s.redeemRewardLabel}>🎁 Tu premio</Text>
                  <Text style={s.redeemRewardText}>{redeemTarget?.description}</Text>
                </View>

                <View style={s.qrWrap}>
                  {redeemLoading ? (
                    <ActivityIndicator size="large" color={colors.primary500} />
                  ) : redeemExpired ? (
                    <View style={s.expiredBox}>
                      <Text style={{ fontSize: 44, marginBottom: 8 }}>⏰</Text>
                      <Text style={s.expiredText}>Código expirado</Text>
                    </View>
                  ) : redeemQrValue ? (
                    <View style={s.qrBox}>
                      <QRCode
                        value={redeemQrValue}
                        size={200}
                        color={colors.accent}
                        backgroundColor={colors.white}
                        quietZone={10}
                      />
                    </View>
                  ) : null}
                </View>

                {!redeemLoading && !redeemExpired && redeemToken && (
                  <Text style={[s.redeemTimer, { color: redeemSecondsLeft < 60 ? colors.red500 : colors.gray600 }]}>
                    ⏱ Válido {fmt(redeemSecondsLeft)} · un solo uso
                  </Text>
                )}

                <Text style={s.redeemHint}>💡 Muestra este código al negocio para canjear tu premio</Text>

                {redeemExpired && redeemTarget && (
                  <TouchableOpacity style={s.redeemPrimaryBtn} onPress={() => generateRedeemToken(redeemTarget)}>
                    <Text style={s.redeemPrimaryText}>🔄 Generar nuevo código</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.redeemCancelBtn} onPress={closeRedeem}>
                  <Text style={s.redeemCancelText}>Cerrar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Tarjeta de premio ──────────────────────────────────────────────────
function RewardCard({ reward, onRedeem }: { reward: RewardWithDetails; onRedeem: (r: RewardWithDetails) => void }) {
  const expiresAt    = reward.expires_at ? new Date(reward.expires_at) : null;
  const daysLeft     = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / 86400000) : null;
  const expiringSoon = daysLeft !== null && daysLeft <= 3 && daysLeft > 0;

  const stripeColor = reward.status === 'pending'  ? colors.primary500 :
                      reward.status === 'redeemed' ? colors.green500 : colors.gray300;
  const badgeBg     = reward.status === 'pending'  ? colors.primary100 :
                      reward.status === 'redeemed' ? colors.green100 : colors.gray100;
  const badgeText   = reward.status === 'pending'  ? colors.primary600 :
                      reward.status === 'redeemed' ? colors.green600 : colors.gray400;
  const badgeLabel  = reward.status === 'pending'  ? '⏳ Pendiente' :
                      reward.status === 'redeemed' ? '✅ Canjeado' : '❌ Expirado';

  return (
    <View style={[s.card, { elevation: 4 }]}>
      <View style={[s.cardStripe, { backgroundColor: stripeColor }]} />
      <View style={s.cardBody}>
        <View style={s.cardRow}>
          <View style={s.cardIcon}>
            <Text style={{ fontSize: 20 }}>🏪</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardBiz}>{reward.businesses?.name ?? '—'}</Text>
            <Text style={s.cardCampaign}>{reward.campaigns?.name ?? '—'}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: badgeBg }]}>
            <Text style={[s.badgeText, { color: badgeText }]}>{badgeLabel}</Text>
          </View>
        </View>

        <View style={s.rewardBox}>
          <Text style={s.rewardBoxLabel}>🎁 Tu premio</Text>
          <Text style={s.rewardBoxText}>{reward.description}</Text>
        </View>

        {reward.status === 'pending' && expiresAt && (
          <View style={[s.dateRow, { backgroundColor: expiringSoon ? colors.red50 : colors.primary50 }]}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>{expiringSoon ? '⚠️' : '📅'}</Text>
            <Text style={[s.dateText, { color: expiringSoon ? colors.red600 : colors.primary600 }]}>
              {expiringSoon
                ? `¡Expira en ${daysLeft} día${daysLeft > 1 ? 's' : ''}!`
                : `Válido hasta ${expiresAt.toLocaleDateString('es-ES')}`}
            </Text>
          </View>
        )}
        {reward.status === 'redeemed' && reward.redeemed_at && (
          <Text style={s.redeemedDate}>
            Canjeado el {new Date(reward.redeemed_at).toLocaleDateString('es-ES')}
          </Text>
        )}

        {reward.status === 'pending' && (
          <TouchableOpacity style={s.redeemBtn} onPress={() => onRedeem(reward)} activeOpacity={0.8}>
            <Text style={s.redeemBtnText}>🎟 Canjear premio</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.background },
  center:  { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  header:  { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, backgroundColor: colors.surface },
  title:   { color: colors.accent, fontSize: 24, fontWeight: '800', fontFamily: fonts.extrabold },

  pendingBadge:{ marginTop: 8, backgroundColor: colors.primary100, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start' },
  pendingText: { color: colors.primary600, fontSize: 14, fontWeight: '700', fontFamily: fonts.bold },

  tabBar:        { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.gray100, paddingHorizontal: 20 },
  tab:           { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:     { borderBottomColor: colors.primary500 },
  tabText:       { fontSize: 14, fontFamily: fonts.semibold },
  tabTextActive: { color: colors.primary500, fontFamily: fonts.bold },
  tabTextInactive:{ color: colors.gray400 },

  errorTitle:{ color: colors.accent, fontWeight: '700', fontFamily: fonts.bold, fontSize: 18, textAlign: 'center' },
  errorSub:  { color: colors.gray400, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', marginTop: 8 },
  retryBtn:  { marginTop: 24, backgroundColor: colors.primary500, borderRadius: 999, paddingHorizontal: 32, paddingVertical: 14 },
  retryText: { color: colors.white, fontWeight: '700', fontFamily: fonts.bold, fontSize: 15 },

  // ── Reward card ──────────────────────────────────────────────
  card:       { marginHorizontal: 20, marginBottom: 16, backgroundColor: colors.surface, borderRadius: 20, overflow: 'hidden', shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
  cardStripe: { height: 6 },
  cardBody:   { padding: 16 },
  cardRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardIcon:   { width: 40, height: 40, backgroundColor: colors.primary100, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardBiz:    { color: colors.gray500, fontFamily: fonts.regular, fontSize: 12 },
  cardCampaign:{ color: colors.accent, fontWeight: '600', fontFamily: fonts.semibold, fontSize: 14 },
  badge:      { borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4 },
  badgeText:  { fontSize: 12, fontWeight: '700', fontFamily: fonts.bold },

  rewardBox:      { backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 },
  rewardBoxLabel: { color: colors.gray500, fontFamily: fonts.regular, fontSize: 12, marginBottom: 2 },
  rewardBoxText:  { color: colors.accent, fontWeight: '700', fontFamily: fonts.bold },

  dateRow:      { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  dateText:     { fontSize: 12, fontWeight: '600', fontFamily: fonts.semibold },
  redeemedDate: { color: colors.gray400, fontFamily: fonts.regular, fontSize: 12, marginTop: 4 },
  redeemBtn:    { marginTop: 12, backgroundColor: colors.primary500, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  redeemBtnText:{ color: colors.white, fontWeight: '700', fontFamily: fonts.bold, fontSize: 15 },

  // ── Modal ────────────────────────────────────────────────────
  modalBg:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, maxHeight: '90%', overflow: 'hidden' },
  modalHandle:{ width: 48, height: 6, backgroundColor: colors.gray200, borderRadius: 99, alignSelf: 'center', marginBottom: 16 },

  redeemTitle:      { color: colors.accent, fontSize: 20, fontWeight: '700', fontFamily: fonts.bold, textAlign: 'center' },
  redeemBiz:        { color: colors.gray500, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', marginTop: 4 },
  redeemRewardBox:  { backgroundColor: colors.primary50, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, marginTop: 16 },
  redeemRewardLabel:{ color: colors.primary600, fontSize: 12, fontWeight: '600', fontFamily: fonts.semibold, marginBottom: 2 },
  redeemRewardText: { color: colors.accent, fontWeight: '700', fontFamily: fonts.bold, fontSize: 15 },

  qrWrap:      { alignItems: 'center', justifyContent: 'center', minHeight: 240, marginTop: 16 },
  qrBox:       { padding: 16, borderRadius: 24, borderWidth: 3, borderColor: colors.primary500 },
  expiredBox:  { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  expiredText: { color: colors.gray500, fontFamily: fonts.regular, fontWeight: '500' },
  redeemTimer: { textAlign: 'center', fontWeight: '700', fontFamily: fonts.bold, fontSize: 16, marginTop: 8 },
  redeemHint:  { color: colors.gray400, fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', marginTop: 12 },

  redeemPrimaryBtn:  { backgroundColor: colors.primary500, borderRadius: 999, paddingVertical: 16, marginTop: 16 },
  redeemPrimaryText: { color: colors.white, fontWeight: '700', fontFamily: fonts.bold, fontSize: 16, textAlign: 'center' },
  redeemCancelBtn:   { paddingVertical: 14, marginTop: 4 },
  redeemCancelText:  { color: colors.gray400, fontFamily: fonts.regular, textAlign: 'center', fontWeight: '500' },

  redeemDoneBlock: { alignItems: 'center', paddingVertical: 16 },
  redeemDoneIcon:  { width: 88, height: 88, backgroundColor: colors.green100, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  redeemDoneTitle: { color: colors.accent, fontSize: 26, fontWeight: '800', fontFamily: fonts.extrabold },
  redeemDoneSub:   { color: colors.gray500, fontFamily: fonts.regular, fontSize: 15, marginTop: 8 },

  // Colores extra
  primary50:  colors.primary50,
});
