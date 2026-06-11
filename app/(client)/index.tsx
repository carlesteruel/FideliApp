import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, StyleSheet, Image, ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../src/store/useAuthStore';
import { supabase } from '../../src/lib/supabase';
import { CampaignWithBusiness } from '../../src/types/database';
import { colors, fonts } from '../../src/theme';
import {
  CATEGORY_COLORS, CATEGORY_EMOJI, CATEGORY_LABEL, getCoverSource,
} from '../../src/constants/businessAssets';
import { PressableScale } from '../../src/components/ui/PressableScale';
import { EmptyState } from '../../src/components/ui/EmptyState';

const CATEGORY_FILTERS = [
  { id: 'all',        label: '🌟 Todos' },
  { id: 'cafe',       label: '☕ Cafés' },
  { id: 'restaurant', label: '🍽️ Restaurantes' },
  { id: 'bar',        label: '🍺 Bares' },
  { id: 'bakery',     label: '🥐 Panaderías' },
  { id: 'pizza',      label: '🍕 Pizzerías' },
  { id: 'fast_food',  label: '🍔 Fast food' },
];

interface BusinessWithCampaigns {
  id:            string;
  name:          string;
  logo_url:      string | null;
  cover_url:     string | null;
  card_color:    string | null;
  city:          string | null;
  category:      string;
  campaignCount: number;
}

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [businesses,    setBusinesses]    = useState<BusinessWithCampaigns[]>([]);
  const [campaignTotal, setCampaignTotal] = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [activeFilter,  setActiveFilter]  = useState('all');

  // Banner de cumpleaños
  const [birthdayCount,   setBirthdayCount]   = useState(0);
  const [birthdayDismiss, setBirthdayDismiss] = useState(false);

  const claimBirthdayRewards = useCallback(async () => {
    try {
      const { data } = await supabase.rpc('claim_birthday_reward');
      if (data?.success && Array.isArray(data.rewards_created) && data.rewards_created.length > 0) {
        setBirthdayCount(data.rewards_created.length);
        setBirthdayDismiss(false);
      }
    } catch (e) {
      console.warn('claim_birthday_reward error:', e);
    }
  }, []);

  useFocusEffect(useCallback(() => { claimBirthdayRewards(); }, [claimBirthdayRewards]));

  const fetchData = async () => {
    try {
      const { data: c } = await supabase
        .from('campaigns')
        .select('*, businesses (id, name, logo_url, cover_url, card_color, city, category)')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      const campaigns = (c ?? []) as CampaignWithBusiness[];
      setCampaignTotal(campaigns.length);

      const map = new Map<string, BusinessWithCampaigns>();
      for (const camp of campaigns) {
        const b = camp.businesses;
        if (!b) continue;
        const existing = map.get(b.id);
        if (existing) {
          existing.campaignCount += 1;
        } else {
          map.set(b.id, {
            id: b.id, name: b.name, logo_url: b.logo_url, cover_url: b.cover_url,
            card_color: b.card_color, city: b.city, category: b.category, campaignCount: 1,
          });
        }
      }
      setBusinesses(Array.from(map.values()));
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchData(); }, []);
  const onRefresh = () => { setRefreshing(true); fetchData(); claimBirthdayRewards(); };
  const filtered  = activeFilter === 'all' ? businesses : businesses.filter((b) => b.category === activeFilter);

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? '🌅 Buenos días' : h < 20 ? '☀️ Buenas tardes' : '🌙 Buenas noches';
  };

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size="large" color={colors.primary500} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary500} />
        }
      >
        {/* ── Banner cumpleaños ── */}
        {birthdayCount > 0 && !birthdayDismiss && (
          <TouchableOpacity
            style={s.birthdayBanner}
            activeOpacity={0.88}
            onPress={() => { setBirthdayDismiss(true); router.push('/(client)/rewards'); }}
          >
            <View style={s.birthdayBannerLeft}>
              <Text style={{ fontSize: 36 }}>🎂</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.birthdayBannerTitle}>¡Feliz cumpleaños! 🎉</Text>
              <Text style={s.birthdayBannerSub}>
                {birthdayCount === 1
                  ? 'Tienes 1 nuevo premio de cumpleaños'
                  : `Tienes ${birthdayCount} nuevos premios de cumpleaños`}
                {' · '}<Text style={{ fontWeight: '700' }}>Ver premios →</Text>
              </Text>
            </View>
            <TouchableOpacity hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }} onPress={() => setBirthdayDismiss(true)}>
              <Text style={s.birthdayBannerClose}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {/* ── Header con gradiente ── */}
        <LinearGradient
          colors={[colors.surface, colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.header}
        >
          <Text style={s.greeting}>{greeting()}</Text>
          <Text style={s.username}>
            {profile?.full_name?.split(' ')[0] ?? 'Usuario'} 👋
          </Text>
          <Text style={s.headerSub}>Descubre locales y acumula premios</Text>
        </LinearGradient>

        {/* ── Stats ── */}
        <View style={s.statsRow}>
          <View style={[s.statCard, { backgroundColor: colors.primary500 }]}>
            <Text style={s.statLabel}>Locales</Text>
            <Text style={s.statNum}>{businesses.length}</Text>
            <Text style={s.statSub}>con campañas</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: colors.accent }]}>
            <Text style={s.statLabel}>Campañas</Text>
            <Text style={s.statNum}>{campaignTotal}</Text>
            <Text style={s.statSub}>activas ahora</Text>
          </View>
        </View>

        {/* ── Filtros ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          style={{ marginBottom: 8 }}
        >
          {CATEGORY_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.id}
              onPress={() => setActiveFilter(f.id)}
              style={[s.filterBtn, activeFilter === f.id ? s.filterActive : s.filterInactive]}
            >
              <Text style={[s.filterText, { color: activeFilter === f.id ? colors.white : colors.gray600 }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={s.sectionTitle}>
          <Text style={s.sectionTitleText}>🏪 Locales con campañas</Text>
        </View>

        {filtered.length === 0 ? (
          <EmptyState
            variant="cards"
            title="¡Aquí no hay nadie!"
            subtitle="Prueba con otra categoría o espera a que más negocios se unan a FideliApp"
          />
        ) : (
          filtered.map((b) => (
            <BusinessCard
              key={b.id}
              business={b}
              onPress={() => router.push({ pathname: '/(client)/business/[id]', params: { id: b.id } })}
            />
          ))
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Tarjeta de negocio con PressableScale ─────────────────────────────
function BusinessCard({ business, onPress }: { business: BusinessWithCampaigns; onPress: () => void }) {
  const color    = business.card_color ?? CATEGORY_COLORS[business.category] ?? colors.primary500;
  const coverUri = getCoverSource(business.cover_url, business.category);

  return (
    <PressableScale
      onPress={onPress}
      style={s.bizCard}
      scaleValue={0.97}
    >
      {/* Imagen de portada */}
      <ImageBackground
        source={{ uri: coverUri }}
        style={[s.bizCoverBg, { backgroundColor: color }]}
        imageStyle={s.bizCoverImg}
        resizeMode="cover"
      >
        <LinearGradient
          colors={[`${color}66`, '#00000055']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Badge campañas */}
        <View style={[s.campaignsBadge, { backgroundColor: color }]}>
          <Text style={s.campaignsBadgeText}>
            {business.campaignCount} campaña{business.campaignCount !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Badge categoría */}
        <View style={s.categoryBadge}>
          <Text style={s.categoryBadgeText}>
            {CATEGORY_EMOJI[business.category]}  {CATEGORY_LABEL[business.category] ?? 'Negocio'}
          </Text>
        </View>
      </ImageBackground>

      {/* Info */}
      <View style={s.bizBody}>
        {business.logo_url ? (
          <Image
            source={{ uri: business.logo_url }}
            style={[s.bizLogoImg, { borderColor: `${color}44` }]}
            resizeMode="cover"
          />
        ) : (
          <View style={[s.bizIcon, { backgroundColor: `${color}18` }]}>
            <Text style={{ fontSize: 22 }}>{CATEGORY_EMOJI[business.category] ?? '🏪'}</Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={s.bizName} numberOfLines={1}>{business.name}</Text>
          {business.city && (
            <Text style={s.bizCity} numberOfLines={1}>📍 {business.city}</Text>
          )}
        </View>
        <Text style={s.bizArrow}>›</Text>
      </View>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.background },
  center:  { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },

  // ── Birthday banner ─────────────────────────────────────────
  birthdayBanner:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary500, paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  birthdayBannerLeft:  { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  birthdayBannerTitle: { color: colors.white, fontWeight: '700', fontFamily: fonts.bold, fontSize: 15 },
  birthdayBannerSub:   { color: 'rgba(255,255,255,0.88)', fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  birthdayBannerClose: { color: 'rgba(255,255,255,0.75)', fontSize: 18, paddingHorizontal: 4 },

  // ── Header ──────────────────────────────────────────────────
  header:    { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  greeting:  { color: colors.gray500, fontFamily: fonts.regular, fontSize: 14 },
  username:  { color: colors.accent, fontSize: 26, fontWeight: '800', fontFamily: fonts.extrabold, marginTop: 2 },
  headerSub: { color: colors.gray400, fontFamily: fonts.regular, fontSize: 14, marginTop: 4 },

  // ── Stats ────────────────────────────────────────────────────
  statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 16 },
  statCard: { flex: 1, borderRadius: 20, padding: 16 },
  statLabel:{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontFamily: fonts.semibold },
  statNum:  { color: colors.white, fontSize: 28, fontWeight: '800', fontFamily: fonts.extrabold, marginTop: 2 },
  statSub:  { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: fonts.regular },

  // ── Filtros ──────────────────────────────────────────────────
  filterBtn:     { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 99, borderWidth: 1 },
  filterActive:  { backgroundColor: colors.primary500, borderColor: colors.primary500 },
  filterInactive:{ backgroundColor: colors.surface, borderColor: colors.gray200 },
  filterText:    { fontSize: 14, fontFamily: fonts.semibold },

  // ── Section title ────────────────────────────────────────────
  sectionTitle:     { paddingHorizontal: 20, marginTop: 8, marginBottom: 16 },
  sectionTitleText: { color: colors.accent, fontSize: 18, fontWeight: '700', fontFamily: fonts.bold },

  // ── BusinessCard ─────────────────────────────────────────────
  bizCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 8,
  },

  bizCoverBg:  { height: 130, width: '100%', justifyContent: 'flex-end' },
  bizCoverImg: { opacity: 0.78 },

  campaignsBadge:    { position: 'absolute', top: 12, right: 12, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  campaignsBadgeText:{ color: colors.white, fontSize: 11, fontWeight: '700', fontFamily: fonts.bold },

  categoryBadge:    { position: 'absolute', bottom: 10, left: 12, backgroundColor: 'rgba(0,0,0,0.38)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  categoryBadgeText:{ color: colors.white, fontSize: 11, fontWeight: '600', fontFamily: fonts.semibold },

  bizBody:   { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  bizLogoImg:{ width: 48, height: 48, borderRadius: 14, borderWidth: 2 },
  bizIcon:   { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bizName:   { color: colors.accent, fontWeight: '700', fontFamily: fonts.bold, fontSize: 16 },
  bizCity:   { color: colors.gray500, fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  bizArrow:  { color: colors.gray300, fontSize: 28 },
});
