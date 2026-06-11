import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, StyleSheet, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore } from '../../src/store/useAuthStore';
import { supabase } from '../../src/lib/supabase';
import { colors, fonts } from '../../src/theme';
import { Campaign, LoyaltyCard, Stamp, CampaignType } from '../../src/types/database';

// ─── Tipos ────────────────────────────────────────────────────
interface CustomerStat {
  customer_id: string;
  full_name: string;
  total_stamps: number;
  last_visit: string;
  times_completed: number;
}

interface CardWithCampaign extends LoyaltyCard {
  campaigns: Campaign;
}

type DetailTab = 'campaigns' | 'stamps';

// ─── Helpers ──────────────────────────────────────────────────
const typeEmoji = (t: CampaignType) =>
  t === 'punch_card' ? '☕' : t === 'points' ? '⭐' : t === 'birthday' ? '🎂' : t === 'streak' ? '🔥' : '🎯';

const typeLabel = (t: CampaignType) =>
  t === 'punch_card' ? 'Tarjeta de sellos' : t === 'points' ? 'Puntos' : t === 'birthday' ? 'Cumpleaños' : t === 'streak' ? 'Racha' : t;

function formatDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Pantalla principal ───────────────────────────────────────
export default function CustomersScreen() {
  const { profile } = useAuthStore();
  const [customers, setCustomers] = useState<CustomerStat[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Modal detalle ────────────────────────────────────────────
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerStat | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('campaigns');
  const [customerCards, setCustomerCards] = useState<CardWithCampaign[]>([]);
  const [customerStamps, setCustomerStamps] = useState<Stamp[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Fetch lista de clientes ──────────────────────────────────
  const fetchCustomers = async () => {
    if (!profile) return;
    try {
      const { data: biz } = await supabase
        .from('businesses').select('id').eq('owner_id', profile.id).single();
      if (!biz) { setLoading(false); setRefreshing(false); return; }
      const bId = (biz as any).id;
      setBusinessId(bId);

      const { data } = await supabase
        .from('loyalty_cards')
        .select('customer_id, total_stamps_ever, times_completed, last_visit_at, profiles!loyalty_cards_customer_id_fkey (full_name, email)')
        .eq('business_id', bId)
        .order('last_visit_at', { ascending: false });

      if (data) {
        const map = new Map<string, CustomerStat>();
        data.forEach((card: any) => {
          const ex = map.get(card.customer_id);
          if (ex) {
            ex.total_stamps += card.total_stamps_ever;
            ex.times_completed += card.times_completed;
            if (card.last_visit_at > ex.last_visit) ex.last_visit = card.last_visit_at;
          } else {
            map.set(card.customer_id, {
              customer_id: card.customer_id,
              full_name: card.profiles?.full_name ?? 'Cliente',
              total_stamps: card.total_stamps_ever,
              last_visit: card.last_visit_at ?? '',
              times_completed: card.times_completed,
            });
          }
        });
        setCustomers(Array.from(map.values()));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchCustomers(); }, [profile]));
  const onRefresh = () => { setRefreshing(true); fetchCustomers(); };

  // ── Abrir detalle de cliente ─────────────────────────────────
  const openDetail = async (customer: CustomerStat) => {
    if (!businessId) return;
    setSelectedCustomer(customer);
    setDetailTab('campaigns');
    setCustomerCards([]);
    setCustomerStamps([]);
    setDetailLoading(true);

    try {
      const [cardsRes, stampsRes] = await Promise.all([
        supabase
          .from('loyalty_cards')
          .select('*, campaigns(*)')
          .eq('customer_id', customer.customer_id)
          .eq('business_id', businessId)
          .order('updated_at', { ascending: false }),
        supabase
          .from('stamps')
          .select('*')
          .eq('customer_id', customer.customer_id)
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);
      if (cardsRes.data) setCustomerCards(cardsRes.data as CardWithCampaign[]);
      if (stampsRes.data) setCustomerStamps(stampsRes.data as Stamp[]);
    } catch (e) { console.error(e); }
    finally { setDetailLoading(false); }
  };

  const closeDetail = () => setSelectedCustomer(null);

  // ─── Loading principal ───────────────────────────────────────
  if (loading) return (
    <SafeAreaView style={s.loadingScreen}>
      <ActivityIndicator size="large" color={colors.primary500} />
    </SafeAreaView>
  );

  const sorted = [...customers].sort((a, b) => b.total_stamps - a.total_stamps);

  // ─── Render tarjeta de campaña (en el modal) ─────────────────
  const renderCampaignCard = (card: CardWithCampaign) => {
    const c = card.campaigns;
    if (!c) return null;
    const isActive = c.is_active && c.status === 'active';
    const config = c.config as any;

    let progressNode: React.ReactNode = null;
    if (c.type === 'punch_card') {
      const total = config?.total_stamps ?? 10;
      const current = card.current_stamps;
      const pct = Math.min((current / total) * 100, 100);
      progressNode = (
        <>
          <View style={s.detailProgressBg}>
            <View style={[s.detailProgressFill, { width: `${pct}%` as any }]} />
          </View>
          <Text style={s.detailProgressText}>{current} / {total} sellos</Text>
        </>
      );
    } else if (c.type === 'points') {
      progressNode = (
        <Text style={s.detailProgressText}>
          {card.current_points} puntos acumulados
        </Text>
      );
    } else if (c.type === 'streak') {
      progressNode = (
        <Text style={s.detailProgressText}>
          Racha actual: {card.current_streak} visitas
        </Text>
      );
    }

    return (
      <View key={card.id} style={s.campaignCard}>
        <View style={s.campaignCardHeader}>
          <View style={s.campaignIcon}>
            <Text style={{ fontSize: 20 }}>{typeEmoji(c.type)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.campaignCardName}>{c.name}</Text>
            <Text style={s.campaignCardMeta}>{typeLabel(c.type)}</Text>
          </View>
          <View style={[s.statusBadge, { backgroundColor: isActive ? colors.green100 : colors.gray100 }]}>
            <Text style={[s.statusBadgeText, { color: isActive ? colors.green600 : colors.gray500 }]}>
              {isActive ? '✅ Activa' : c.status === 'ended' ? '🏁 Terminada' : c.status === 'archived' ? '📦 Archivada' : '⏸ Pausada'}
            </Text>
          </View>
        </View>

        {progressNode}

        <View style={s.campaignCardReward}>
          <Text style={{ fontSize: 14, marginRight: 8 }}>🎁</Text>
          <Text style={s.campaignCardRewardText}>{c.reward_description}</Text>
          {card.times_completed > 0 && (
            <View style={s.completedBadge}>
              <Text style={s.completedBadgeText}>×{card.times_completed} canjeado</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // ─── Render sello (registro) ─────────────────────────────────
  const renderStamp = (stamp: Stamp, idx: number) => (
    <View key={stamp.id} style={s.stampRow}>
      <View style={s.stampDot} />
      <View style={{ flex: 1 }}>
        <Text style={s.stampDate}>{formatDate(stamp.created_at)}</Text>
        {stamp.points_added > 0 && (
          <Text style={s.stampPoints}>+{stamp.points_added} {stamp.points_added === 1 ? 'sello' : 'puntos'}</Text>
        )}
        {stamp.amount_spent != null && stamp.amount_spent > 0 && (
          <Text style={s.stampMeta}>Gasto: {stamp.amount_spent.toFixed(2)} €</Text>
        )}
        {!!stamp.notes && <Text style={s.stampMeta}>{stamp.notes}</Text>}
      </View>
    </View>
  );

  // ─── Render principal ────────────────────────────────────────
  return (
    <SafeAreaView style={s.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary500} />}
      >
        {/* Header premium con gradiente */}
        <LinearGradient
          colors={[colors.primary500, '#E5501A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.header}
        >
          <View style={s.headerCircle1} />
          <View style={s.headerCircle2} />
          <View style={s.headerInner}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={s.headerSup}>Mis</Text>
              <Text style={s.headerTitle}>Clientes</Text>
              <View style={s.headerPill}>
                <Ionicons name="people" size={13} color={colors.white} style={{ marginRight: 4, opacity: 0.85 }} />
                <Text style={s.headerPillText}>{customers.length} cliente{customers.length !== 1 ? 's' : ''} fidelizados</Text>
              </View>
            </View>
            <View style={s.headerIcon}>
              <Ionicons name="people" size={28} color="rgba(255,255,255,0.9)" />
            </View>
          </View>
        </LinearGradient>

        {customers.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIconWrap}>
              <Ionicons name="people-outline" size={48} color={colors.primary500} />
            </View>
            <Text style={s.emptyTitle}>Aún no tienes clientes</Text>
            <Text style={s.emptySub}>Empieza a escanear QRs para que los clientes aparezcan aquí</Text>
          </View>
        ) : (
          <View style={{ paddingTop: 16 }}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>🏆 Clientes más fieles</Text>
              <Text style={s.sectionHint}>Pulsa un cliente para ver sus campañas</Text>
            </View>
            {sorted.map((customer, i) => {
              const medalEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
              const badgeBg = i === 0 ? colors.highlight100 : i === 1 ? colors.gray100 : i === 2 ? '#FEE2C8' : colors.primary50;
              const badgeColor = i === 0 ? colors.highlight600 : i === 1 ? colors.gray500 : i === 2 ? '#C2410C' : colors.gray600;
              return (
                <TouchableOpacity
                  key={customer.customer_id}
                  style={[s.customerCard, { elevation: 2 }]}
                  onPress={() => openDetail(customer)}
                  activeOpacity={0.75}
                >
                  <View style={[s.medalBox, { backgroundColor: badgeBg }]}>
                    {medalEmoji
                      ? <Text style={{ fontSize: 20 }}>{medalEmoji}</Text>
                      : <Text style={[s.initial, { color: badgeColor }]}>{customer.full_name.charAt(0).toUpperCase()}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.customerName}>{customer.full_name}</Text>
                    <Text style={s.customerMeta}>
                      {customer.total_stamps} sellos · {customer.times_completed} premios canjeados
                    </Text>
                    {!!customer.last_visit && (
                      <Text style={s.customerDate}>Última visita: {formatDateShort(customer.last_visit)}</Text>
                    )}
                  </View>
                  <View style={s.stampsBlock}>
                    <Text style={s.stampsNum}>{customer.total_stamps}</Text>
                    <Text style={s.stampsLabel}>sellos</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.gray300} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Modal detalle cliente ─────────────────────────────── */}
      <Modal
        visible={!!selectedCustomer}
        animationType="slide"
        transparent
        onRequestClose={closeDetail}
      >
        <View style={s.modalBg}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />

            {/* Cabecera del modal */}
            <View style={s.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>{selectedCustomer?.full_name}</Text>
                <Text style={s.modalSubtitle}>
                  {selectedCustomer?.total_stamps} sellos · {selectedCustomer?.times_completed} premios canjeados
                </Text>
              </View>
              <TouchableOpacity onPress={closeDetail} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Pestañas */}
            <View style={s.tabBar}>
              {([
                { key: 'campaigns', label: '🎯 Campañas' },
                { key: 'stamps',    label: '📋 Registros' },
              ] as { key: DetailTab; label: string }[]).map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[s.tabItem, detailTab === tab.key && s.tabItemActive]}
                  onPress={() => setDetailTab(tab.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.tabLabel, detailTab === tab.key && s.tabLabelActive]}>
                    {tab.label}
                  </Text>
                  {detailTab === tab.key && <View style={s.tabIndicator} />}
                </TouchableOpacity>
              ))}
            </View>

            {/* Contenido */}
            {detailLoading ? (
              <View style={s.detailCenter}>
                <ActivityIndicator size="large" color={colors.primary500} />
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {detailTab === 'campaigns' && (
                  <View style={{ paddingVertical: 12 }}>
                    {customerCards.length === 0 ? (
                      <View style={s.detailEmpty}>
                        <Text style={{ fontSize: 40, marginBottom: 8 }}>🎯</Text>
                        <Text style={s.detailEmptyText}>Este cliente no tiene campañas activas</Text>
                      </View>
                    ) : (
                      customerCards.map(renderCampaignCard)
                    )}
                  </View>
                )}

                {detailTab === 'stamps' && (
                  <View style={{ paddingVertical: 12, paddingHorizontal: 20 }}>
                    {customerStamps.length === 0 ? (
                      <View style={s.detailEmpty}>
                        <Text style={{ fontSize: 40, marginBottom: 8 }}>📋</Text>
                        <Text style={s.detailEmptyText}>No hay registros para este cliente</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={s.stampsHistoryTitle}>{customerStamps.length} registro{customerStamps.length !== 1 ? 's' : ''}</Text>
                        <View style={s.timeline}>
                          {customerStamps.map(renderStamp)}
                        </View>
                      </>
                    )}
                  </View>
                )}

                <View style={{ height: 24 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  // ── Pantalla ─────────────────────────────────────────────────
  screen:         { flex: 1, backgroundColor: colors.background },
  loadingScreen:  { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  // ── Header premium ────────────────────────────────────────────
  header:         { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, overflow: 'hidden', position: 'relative' },
  headerCircle1:  { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -50 },
  headerCircle2:  { position: 'absolute', width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -40, left: 40 },
  headerInner:    { flexDirection: 'row', alignItems: 'center' },
  headerSup:      { color: 'rgba(255,255,255,0.70)', fontSize: 12, fontFamily: fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.8 },
  headerTitle:    { color: colors.white, fontSize: 24, fontFamily: fonts.bold, fontWeight: '700', marginTop: 4, marginBottom: 10 },
  headerPill:     { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  headerPillText: { color: colors.white, fontSize: 12, fontFamily: fonts.semibold },
  headerIcon:     { width: 54, height: 54, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)' },
  title:          { color: colors.accent, fontSize: 24, fontFamily: fonts.bold, fontWeight: '700' },
  subtitle:       { color: colors.gray500, fontSize: 14, fontFamily: fonts.regular, marginTop: 4 },
  emptyIconWrap:{ width: 88, height: 88, backgroundColor: colors.primary50, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  empty:        { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 32 },
  emptyTitle:   { color: colors.accent, fontFamily: fonts.bold, fontWeight: '700', fontSize: 20, textAlign: 'center' },
  emptySub:     { color: colors.gray500, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', marginTop: 8 },
  sectionHeader:{ paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { color: colors.accent, fontFamily: fonts.bold, fontWeight: '700', fontSize: 16 },
  sectionHint:  { color: colors.gray400, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },

  // ── Tarjeta cliente ──────────────────────────────────────────
  customerCard: { marginHorizontal: 20, marginBottom: 10, backgroundColor: colors.surface, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', shadowColor: colors.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },
  medalBox:     { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  initial:      { fontSize: 18, fontFamily: fonts.bold, fontWeight: '700' },
  customerName: { color: colors.accent, fontFamily: fonts.semibold, fontWeight: '600' },
  customerMeta: { color: colors.gray400, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  customerDate: { color: colors.gray400, fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },
  stampsBlock:  { alignItems: 'flex-end', marginRight: 10 },
  stampsNum:    { color: colors.primary500, fontFamily: fonts.extrabold, fontWeight: '700', fontSize: 20 },
  stampsLabel:  { color: colors.gray400, fontFamily: fonts.regular, fontSize: 11 },

  // ── Modal ────────────────────────────────────────────────────
  modalBg:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, height: '88%' },
  modalHandle:  { width: 48, height: 6, backgroundColor: colors.gray200, borderRadius: 99, alignSelf: 'center', marginBottom: 12 },
  modalHeader:  { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingBottom: 16 },
  modalTitle:   { color: colors.accent, fontFamily: fonts.bold, fontSize: 20, fontWeight: '700' },
  modalSubtitle:{ color: colors.gray400, fontFamily: fonts.regular, fontSize: 13, marginTop: 4 },
  modalClose:   { color: colors.gray400, fontSize: 20 },

  // ── Tab bar (modal) ──────────────────────────────────────────
  tabBar:         { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  tabItem:        { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabItemActive:  {},
  tabLabel:       { fontSize: 14, fontFamily: fonts.semibold, fontWeight: '600', color: colors.gray400 },
  tabLabelActive: { color: colors.primary600, fontFamily: fonts.semibold },
  tabIndicator:   { position: 'absolute', bottom: 0, left: 12, right: 12, height: 3, borderRadius: 99, backgroundColor: colors.primary500 },

  // ── Detalle loading / empty ───────────────────────────────────
  detailCenter:    { paddingVertical: 48, alignItems: 'center' },
  detailEmpty:     { alignItems: 'center', paddingVertical: 36 },
  detailEmptyText: { color: colors.gray400, fontSize: 14, textAlign: 'center' },

  // ── Tarjeta de campaña (modal) ────────────────────────────────
  campaignCard:       { marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.background, borderRadius: 16, padding: 14 },
  campaignCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  campaignIcon:       { width: 40, height: 40, backgroundColor: colors.primary100, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  campaignCardName:   { color: colors.accent, fontFamily: fonts.bold, fontWeight: '700', fontSize: 14 },
  campaignCardMeta:   { color: colors.gray400, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  statusBadge:        { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  statusBadgeText:    { fontSize: 11, fontWeight: '700' },
  detailProgressBg:   { height: 8, backgroundColor: colors.gray200, borderRadius: 99, overflow: 'hidden', marginBottom: 4 },
  detailProgressFill: { height: '100%', backgroundColor: colors.primary500, borderRadius: 99 },
  detailProgressText: { color: colors.gray500, fontSize: 12, marginBottom: 8 },
  campaignCardReward: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  campaignCardRewardText: { color: colors.gray600, fontSize: 13, flex: 1 },
  completedBadge:     { backgroundColor: colors.primary100, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 6 },
  completedBadgeText: { color: colors.primary600, fontSize: 11, fontWeight: '700' },

  // ── Timeline de sellos ────────────────────────────────────────
  stampsHistoryTitle: { color: colors.gray500, fontSize: 12, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  timeline:           { borderLeftWidth: 2, borderLeftColor: colors.gray100, paddingLeft: 16 },
  stampRow:           { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, position: 'relative' },
  stampDot:           { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary500, position: 'absolute', left: -21, top: 5 },
  stampDate:          { color: colors.accent, fontFamily: fonts.semibold, fontSize: 13, fontWeight: '600' },
  stampPoints:        { color: colors.primary500, fontFamily: fonts.bold, fontSize: 13, fontWeight: '700', marginTop: 2 },
  stampMeta:          { color: colors.gray400, fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
});
