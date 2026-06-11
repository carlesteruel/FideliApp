import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore } from '../../src/store/useAuthStore';
import { supabase } from '../../src/lib/supabase';
import { Business, Campaign } from '../../src/types/database';
import { colors, fonts } from '../../src/theme';

interface Stats { totalClients: number; totalStampsToday: number; totalStampsMonth: number; totalRewardsRedeemed: number; activeCampaigns: number; }

export default function BusinessDashboard() {
  const { profile } = useAuthStore();
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats>({ totalClients: 0, totalStampsToday: 0, totalStampsMonth: 0, totalRewardsRedeemed: 0, activeCampaigns: 0 });
  const [recentStamps, setRecentStamps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    if (!profile) return;
    try {
      const { data: biz } = await supabase.from('businesses').select('*').eq('owner_id', profile.id).single();
      if (!biz) { setLoading(false); setRefreshing(false); return; }
      setBusiness(biz);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const [{ data: camp }, { count: todayStamps }, { count: monthStamps }, { count: clients }, { count: redeemed }, { data: stamps }] = await Promise.all([
        supabase.from('campaigns').select('*').eq('business_id', biz.id).order('created_at', { ascending: false }),
        supabase.from('stamps').select('*', { count: 'exact', head: true }).eq('business_id', biz.id).gte('created_at', today.toISOString()),
        supabase.from('stamps').select('*', { count: 'exact', head: true }).eq('business_id', biz.id).gte('created_at', monthStart.toISOString()),
        supabase.from('loyalty_cards').select('customer_id', { count: 'exact', head: true }).eq('business_id', biz.id),
        supabase.from('rewards').select('*', { count: 'exact', head: true }).eq('business_id', biz.id).eq('status', 'redeemed'),
        supabase.from('stamps').select('id, created_at, points_added, profiles!stamps_customer_id_fkey (full_name), campaigns (name)').eq('business_id', biz.id).order('created_at', { ascending: false }).limit(8),
      ]);
      if (camp) setCampaigns(camp);
      if (stamps) setRecentStamps(stamps);
      setStats({ totalClients: clients ?? 0, totalStampsToday: todayStamps ?? 0, totalStampsMonth: monthStamps ?? 0, totalRewardsRedeemed: redeemed ?? 0, activeCampaigns: camp?.filter((c) => c.is_active).length ?? 0 });
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchDashboard(); }, [profile]));
  const onRefresh = () => { setRefreshing(true); fetchDashboard(); };

  if (loading) return <SafeAreaView style={s.center}><ActivityIndicator size="large" color={colors.primary500} /></SafeAreaView>;

  if (!business) return (
    <SafeAreaView style={s.screen}>
      <View style={s.center}>
        <View style={s.onboardIconWrap}>
          <Ionicons name="storefront" size={48} color={colors.primary500} />
        </View>
        <Text style={s.onboardTitle}>Registra tu negocio</Text>
        <Text style={s.onboardSub}>Para empezar a crear campañas y fidelizar clientes, primero configura los datos de tu negocio</Text>
        <TouchableOpacity style={s.onboardBtn} onPress={() => router.push('/(business)/profile')}>
          <Text style={s.onboardBtnText}>Configurar mi negocio</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  };

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary500} />}>

        {/* ── Header premium con gradiente ── */}
        <LinearGradient
          colors={[colors.primary500, '#E5501A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.header}
        >
          {/* Círculos decorativos */}
          <View style={s.headerCircle1} />
          <View style={s.headerCircle2} />
          <View style={s.headerCircle3} />

          <View style={s.headerInner}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={s.headerGreeting}>{greeting()}, {profile?.full_name?.split(' ')[0] ?? 'jefe'} 👋</Text>
              <Text style={s.headerTitle} numberOfLines={1}>{business.name}</Text>
              <View style={s.headerPill}>
                <Ionicons name="people" size={13} color={colors.white} style={{ marginRight: 4, opacity: 0.85 }} />
                <Text style={s.headerPillText}>{stats.totalClients} clientes · {stats.activeCampaigns} campañas activas</Text>
              </View>
            </View>
            <View style={s.headerBadge}>
              <Ionicons name="storefront" size={28} color="rgba(255,255,255,0.9)" />
            </View>
          </View>
        </LinearGradient>

        {/* ── Stats grid ── */}
        <View style={s.statsGrid}>
          <View style={s.statsRow}>
            <StatCard
              icon="people"
              value={stats.totalClients}
              label="Clientes"
              color={colors.primary500}
              bg={colors.primary50}
            />
            <StatCard
              icon="checkmark-circle"
              value={stats.totalStampsToday}
              label="Sellos hoy"
              color={colors.green600}
              bg={colors.green100}
            />
          </View>
          <View style={s.statsRow}>
            <StatCard
              icon="calendar"
              value={stats.totalStampsMonth}
              label="Sellos este mes"
              color="#7C3AED"
              bg="#EDE9FE"
            />
            <StatCard
              icon="gift"
              value={stats.totalRewardsRedeemed}
              label="Premios canjeados"
              color="#DB2777"
              bg="#FCE7F3"
            />
          </View>
        </View>

        {/* ── Botón escanear rápido ── */}
        <View style={s.scannerSection}>
          <TouchableOpacity style={s.scannerBtn} onPress={() => router.push('/(business)/scanner')} activeOpacity={0.85}>
            <LinearGradient
              colors={[colors.primary500, '#E5501A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.scannerGradient}
            >
              <View style={s.scannerIconWrap}>
                <Ionicons name="scan" size={28} color="rgba(255,255,255,0.95)" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.scannerTitle}>Escanear cliente</Text>
                <Text style={s.scannerSub}>Escanea el QR y añade un sello al instante</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.8)" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Campañas activas ── */}
        <View style={s.section}>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>Mis campañas</Text>
            <TouchableOpacity onPress={() => router.push('/(business)/campaigns')} style={s.seeAllBtn}>
              <Text style={s.seeAll}>Ver todas</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary500} />
            </TouchableOpacity>
          </View>

          {campaigns.filter((c) => c.is_active).length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="megaphone-outline" size={32} color={colors.gray300} />
              <Text style={s.emptyCardText}>No tienes campañas activas</Text>
              <TouchableOpacity onPress={() => router.push('/(business)/campaigns')}>
                <Text style={s.emptyCardCta}>Crear campaña →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            campaigns.filter((c) => c.is_active).slice(0, 3).map((c) => (
              <TouchableOpacity
                key={c.id}
                style={s.campaignItem}
                activeOpacity={0.75}
                onPress={() => router.push({ pathname: '/(business)/campaigns', params: { editId: c.id } })}
              >
                <View style={s.campaignIcon}>
                  <Text style={{ fontSize: 20 }}>
                    {c.type === 'punch_card' ? '☕' : c.type === 'points' ? '⭐' : c.type === 'birthday' ? '🎂' : '🎯'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.campaignName} numberOfLines={1}>{c.name}</Text>
                  <Text style={s.campaignMeta}>{c.total_redemptions} canjes</Text>
                </View>
                <View style={s.editBadge}>
                  <Ionicons name="pencil" size={12} color={colors.primary600} />
                  <Text style={s.editBadgeText}>Editar</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* ── Actividad reciente ── */}
        {recentStamps.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Actividad reciente</Text>
            <View style={s.activityCard}>
              {recentStamps.map((stamp, idx) => (
                <View key={stamp.id} style={[s.stampRow, idx < recentStamps.length - 1 && s.stampRowBorder]}>
                  <View style={s.stampDot}>
                    <Ionicons name="checkmark" size={13} color={colors.primary500} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.stampName}>{stamp.profiles?.full_name ?? 'Cliente'}</Text>
                    <Text style={s.stampCampaign}>{stamp.campaigns?.name ?? 'Campaña'}</Text>
                  </View>
                  <Text style={s.stampTime}>
                    {new Date(stamp.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Tarjeta de estadística ──────────────────────────────────
function StatCard({ icon, value, label, color, bg }: { icon: any; value: number; label: string; color: string; bg: string }) {
  return (
    <View style={[s.statCard, { elevation: 2 }]}>
      <View style={[s.statIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[s.statNum, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: colors.background },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.background },

  // ── Onboarding ─────────────────────────────────────────────
  onboardIconWrap: { width: 96, height: 96, backgroundColor: colors.primary50, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  onboardTitle: { color: colors.accent, fontSize: 24, fontWeight: '700', fontFamily: fonts.bold, textAlign: 'center', marginBottom: 8 },
  onboardSub:   { color: colors.gray500, fontSize: 15, fontFamily: fonts.regular, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  onboardBtn:   { backgroundColor: colors.primary500, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 18 },
  onboardBtnText: { color: colors.white, fontWeight: '700', fontFamily: fonts.bold, fontSize: 17 },

  // ── Header ─────────────────────────────────────────────────
  header:        { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 28, overflow: 'hidden', position: 'relative' },
  headerCircle1: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -50 },
  headerCircle2: { position: 'absolute', width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -40, left: 40 },
  headerCircle3: { position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.06)', top: 20, right: 80 },
  headerInner:   { flexDirection: 'row', alignItems: 'center' },
  headerGreeting:{ color: 'rgba(255,255,255,0.78)', fontSize: 13, fontFamily: fonts.regular, marginBottom: 4 },
  headerTitle:   { color: colors.white, fontSize: 24, fontFamily: fonts.bold, fontWeight: '700', marginBottom: 10 },
  headerPill:    { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  headerPillText:{ color: colors.white, fontSize: 12, fontFamily: fonts.semibold },
  headerBadge:   { width: 58, height: 58, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)' },

  // ── Stats ─────────────────────────────────────────────────
  statsGrid:   { paddingHorizontal: 20, paddingVertical: 18 },
  statsRow:    { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard:    { flex: 1, backgroundColor: colors.surface, borderRadius: 18, padding: 16, shadowColor: colors.accent, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8 },
  statIcon:    { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statNum:     { fontSize: 26, fontWeight: '800', fontFamily: fonts.extrabold },
  statLabel:   { color: colors.gray500, fontSize: 12, fontFamily: fonts.regular, marginTop: 2 },

  // ── Scanner CTA ────────────────────────────────────────────
  scannerSection: { paddingHorizontal: 20, marginBottom: 20 },
  scannerBtn:     { borderRadius: 18, overflow: 'hidden', shadowColor: colors.primary500, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  scannerGradient:{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18 },
  scannerIconWrap:{ width: 52, height: 52, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  scannerTitle:   { color: colors.white, fontWeight: '700', fontFamily: fonts.bold, fontSize: 17 },
  scannerSub:     { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },

  // ── Secciones ──────────────────────────────────────────────
  section:      { paddingHorizontal: 20, marginBottom: 24 },
  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { color: colors.accent, fontWeight: '700', fontFamily: fonts.bold, fontSize: 17 },
  seeAllBtn:    { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAll:       { color: colors.primary500, fontSize: 14, fontFamily: fonts.semibold },

  // ── Empty card ─────────────────────────────────────────────
  emptyCard:     { backgroundColor: colors.surface, borderRadius: 16, padding: 28, alignItems: 'center', gap: 8 },
  emptyCardText: { color: colors.gray400, fontSize: 14, fontFamily: fonts.regular },
  emptyCardCta:  { color: colors.primary500, fontFamily: fonts.semibold, fontSize: 14 },

  // ── Campaña item ───────────────────────────────────────────
  campaignItem: { backgroundColor: colors.surface, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', shadowColor: colors.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  campaignIcon: { width: 44, height: 44, backgroundColor: colors.primary50, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  campaignName: { color: colors.accent, fontWeight: '600', fontFamily: fonts.semibold, fontSize: 14 },
  campaignMeta: { color: colors.gray400, fontSize: 12, fontFamily: fonts.regular, marginTop: 2 },
  editBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary50, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  editBadgeText:{ color: colors.primary600, fontSize: 12, fontFamily: fonts.semibold },

  // ── Actividad reciente ─────────────────────────────────────
  activityCard: { backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden', shadowColor: colors.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  stampRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  stampRowBorder:{ borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  stampDot:     { width: 30, height: 30, backgroundColor: colors.primary50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  stampName:    { color: colors.accent, fontWeight: '600', fontFamily: fonts.semibold, fontSize: 14 },
  stampCampaign:{ color: colors.gray400, fontSize: 12, fontFamily: fonts.regular, marginTop: 1 },
  stampTime:    { color: colors.gray300, fontSize: 12, fontFamily: fonts.regular },
});
