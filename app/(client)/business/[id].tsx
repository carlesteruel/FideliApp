import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, StyleSheet, Image, ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../../../src/store/useAuthStore';
import { supabase } from '../../../src/lib/supabase';
import { Business, Campaign, LoyaltyCard } from '../../../src/types/database';
import { colors } from '../../../src/theme';
import {
  CATEGORY_COLORS, CATEGORY_EMOJI, CATEGORY_LABEL,
  getCoverSource,
} from '../../../src/constants/businessAssets';

const CAMPAIGN_TYPE_LABEL: Record<string, string> = {
  punch_card: '🎟️ Tarjeta de sellos',
  points:     '⭐ Puntos',
  birthday:   '🎂 Cumpleaños',
  streak:     '🔥 Racha de visitas',
  cashback:   '💶 Cashback',
  referral:   '👥 Referidos',
};

export default function BusinessDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const { user } = useAuthStore();

  const [business, setBusiness] = useState<Business | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [cards,     setCards]     = useState<LoyaltyCard[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState<Campaign | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [{ data: b }, { data: c }] = await Promise.all([
        supabase.from('businesses').select('*').eq('id', id).single(),
        supabase.from('campaigns').select('*')
          .eq('business_id', id).eq('is_active', true)
          .order('created_at', { ascending: false }),
      ]);
      setBusiness((b as Business) ?? null);
      setCampaigns((c ?? []) as Campaign[]);

      if (user) {
        const { data: lc } = await supabase
          .from('loyalty_cards').select('*')
          .eq('customer_id', user.id).eq('business_id', id);
        setCards((lc ?? []) as LoyaltyCard[]);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [id, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const cardFor = (campaignId: string) =>
    cards.find((c) => c.campaign_id === campaignId) ?? null;

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size="large" color={colors.primary500} />
      </SafeAreaView>
    );
  }

  if (!business) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={{ fontSize: 56, marginBottom: 16 }}>🏚️</Text>
        <Text style={s.errorTitle}>Local no disponible</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => router.back()}>
          <Text style={s.retryText}>Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const color = business.card_color ?? CATEGORY_COLORS[business.category] ?? colors.primary500;
  const emoji = CATEGORY_EMOJI[business.category] ?? '🏪';
  const coverUri = getCoverSource(business.cover_url, business.category);
  const isCustomCover = !!business.cover_url;

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Hero Banner ── */}
        <View>
          <ImageBackground
            source={{ uri: coverUri }}
            style={[s.heroBanner, { backgroundColor: color }]}
            imageStyle={s.heroBannerImg}
            resizeMode="cover"
          >
            {/* Tinte de color de categoría para cohesión */}
            <View style={[s.heroTint, { backgroundColor: `${color}50` }]} />
            {/* Oscurecimiento progresivo en la parte inferior */}
            <View style={s.heroBottomFade} />

            {/* Botón volver flotante */}
            <TouchableOpacity onPress={() => router.back()} style={s.heroBackBtn}>
              <Text style={s.heroBackBtnText}>←</Text>
            </TouchableOpacity>

            {/* Badge de categoría (solo si no tiene foto personalizada) */}
            {!isCustomCover && (
              <View style={s.heroCatBadge}>
                <Text style={s.heroCatBadgeText}>
                  {CATEGORY_EMOJI[business.category]}  {CATEGORY_LABEL[business.category] ?? 'Negocio'}
                </Text>
              </View>
            )}

            {/* Badge "foto personalizada" */}
            {isCustomCover && (
              <View style={s.heroCustomBadge}>
                <Text style={s.heroCustomBadgeText}>📸 Foto del local</Text>
              </View>
            )}
          </ImageBackground>

          {/* Tarjeta de info que se superpone al hero */}
          <View style={s.infoCard}>

            {/* ── Logo flotante ── */}
            <View style={[
              s.logoFloat,
              { borderColor: colors.white, shadowColor: color },
            ]}>
              {business.logo_url ? (
                <Image
                  source={{ uri: business.logo_url }}
                  style={[s.bizLogo, { borderColor: `${color}30` }]}
                  resizeMode="cover"
                />
              ) : (
                <View style={[s.bizIcon, { backgroundColor: `${color}18` }]}>
                  <Text style={{ fontSize: 40 }}>{emoji}</Text>
                </View>
              )}
            </View>

            <Text style={s.bizName}>{business.name}</Text>
            <Text style={s.bizMeta}>
              {CATEGORY_LABEL[business.category] ?? 'Negocio'}
              {business.city ? ` · ${business.city}` : ''}
            </Text>

            {!!business.description && (
              <Text style={s.bizDesc}>{business.description}</Text>
            )}

            {(!!business.address || !!business.phone) && (
              <View style={s.contactBox}>
                {!!business.address && (
                  <View style={s.infoRow}>
                    <Text style={s.infoEmoji}>📍</Text>
                    <Text style={s.infoText}>{business.address}</Text>
                  </View>
                )}
                {!!business.phone && (
                  <View style={s.infoRow}>
                    <Text style={s.infoEmoji}>📞</Text>
                    <Text style={s.infoText}>{business.phone}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* ── Sección de campañas ── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>🔥 Campañas activas</Text>
          {campaigns.length > 0 && (
            <View style={[s.countBadge, { backgroundColor: `${color}18` }]}>
              <Text style={[s.countBadgeText, { color }]}>{campaigns.length}</Text>
            </View>
          )}
        </View>

        {campaigns.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🗓️</Text>
            <Text style={s.emptyTitle}>Sin campañas activas</Text>
            <Text style={s.emptySub}>Este local no tiene campañas en este momento</Text>
          </View>
        ) : (
          campaigns.map((camp) => {
            const card   = cardFor(camp.id);
            const config = camp.config as { total_stamps?: number };
            return (
              <TouchableOpacity
                key={camp.id}
                style={[s.campaignCard, { elevation: 3 }]}
                activeOpacity={0.88}
                onPress={() => setSelected(camp)}
              >
                <View style={[s.campaignStripe, { backgroundColor: color }]} />
                <View style={s.campaignBody}>
                  <View style={s.campaignRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.campaignType}>{CAMPAIGN_TYPE_LABEL[camp.type] ?? camp.type}</Text>
                      <Text style={s.campaignName} numberOfLines={1}>{camp.name}</Text>
                    </View>
                    {card ? (
                      <View style={[s.progressPill, { backgroundColor: `${color}15` }]}>
                        <Text style={[s.progressPillText, { color }]}>En curso</Text>
                      </View>
                    ) : (
                      <View style={s.newPill}>
                        <Text style={s.newPillText}>Nueva</Text>
                      </View>
                    )}
                  </View>
                  {!!camp.description && (
                    <Text style={s.campaignDesc} numberOfLines={2}>{camp.description}</Text>
                  )}
                  <View style={s.rewardRow}>
                    <Text style={{ fontSize: 18, marginRight: 8 }}>🎁</Text>
                    <Text style={s.rewardText} numberOfLines={1}>{camp.reward_description}</Text>
                    {!!config.total_stamps && (
                      <Text style={s.stampsText}>{config.total_stamps} sellos</Text>
                    )}
                  </View>
                  <Text style={s.tapHint}>Toca para ver tu progreso →</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <ProgressModal
        campaign={selected}
        card={selected ? cardFor(selected.id) : null}
        color={color}
        onClose={() => setSelected(null)}
      />
    </SafeAreaView>
  );
}

// ── Modal de progreso ────────────────────────────────────────
function ProgressModal({ campaign, card, color, onClose }: {
  campaign: Campaign | null;
  card: LoyaltyCard | null;
  color: string;
  onClose: () => void;
}) {
  if (!campaign) return null;

  const renderProgress = () => {
    if (campaign.type === 'punch_card') {
      const config  = campaign.config as { total_stamps?: number };
      const total   = config?.total_stamps ?? 10;
      const current = card?.current_stamps ?? 0;
      const pct     = Math.min((current / total) * 100, 100);
      return (
        <View>
          <View style={s.bigStatRow}>
            <Text style={[s.bigStat, { color }]}>{current}</Text>
            <Text style={s.bigStatTotal}> / {total} sellos</Text>
          </View>
          <View style={s.progressBg}>
            <View style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: color }]} />
          </View>
          <View style={s.stampsGrid}>
            {Array.from({ length: total }).map((_, i) => {
              const filled = i < current;
              return (
                <View key={i} style={[
                  s.stamp,
                  filled
                    ? { backgroundColor: color }
                    : { backgroundColor: `${color}1A`, borderWidth: 2, borderColor: `${color}55` },
                ]}>
                  {filled
                    ? <Text style={s.stampCheck}>✓</Text>
                    : <Text style={s.stampNum}>{i + 1}</Text>}
                </View>
              );
            })}
          </View>
        </View>
      );
    }

    if (campaign.type === 'points' || campaign.type === 'cashback') {
      return (
        <View style={s.singleStatBox}>
          <Text style={s.singleStatLabel}>Puntos acumulados</Text>
          <Text style={[s.singleStatValue, { color }]}>⭐ {card?.current_points ?? 0}</Text>
        </View>
      );
    }

    if (campaign.type === 'streak') {
      return (
        <View style={s.singleStatBox}>
          <Text style={s.singleStatLabel}>Racha actual</Text>
          <Text style={[s.singleStatValue, { color }]}>
            🔥 {card?.current_streak ?? 0} visita{(card?.current_streak ?? 0) !== 1 ? 's' : ''}
          </Text>
        </View>
      );
    }

    return (
      <View style={s.singleStatBox}>
        <Text style={s.singleStatLabel}>Estado</Text>
        <Text style={[s.singleStatValue, { color }]}>{card ? 'Participando' : 'Sin empezar'}</Text>
      </View>
    );
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalBg}>
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <View style={s.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.modalType}>{CAMPAIGN_TYPE_LABEL[campaign.type] ?? campaign.type}</Text>
              <Text style={s.modalTitle}>{campaign.name}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: colors.gray400, fontSize: 20 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.modalSectionLabel}>TU PROGRESO</Text>
          {!card && (
            <View style={s.noCardBanner}>
              <Text style={s.noCardText}>
                Aún no has empezado esta campaña. Visita el negocio y pide que te sellen para empezar 🎯
              </Text>
            </View>
          )}
          {renderProgress()}

          <View style={s.modalRewardRow}>
            <Text style={{ fontSize: 22, marginRight: 12 }}>🎁</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.modalRewardLabel}>Premio</Text>
              <Text style={s.modalRewardText}>{campaign.reward_description}</Text>
            </View>
            {!!card && card.times_completed > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>x{card.times_completed} canjeado</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[s.closeBtn, { backgroundColor: color }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={s.closeBtnText}>Entendido</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: colors.gray50 },
  center:  { flex: 1, backgroundColor: colors.gray50, alignItems: 'center', justifyContent: 'center', padding: 32 },

  // ── Hero ──────────────────────────────────────────────────
  heroBanner:    { height: 230, width: '100%', justifyContent: 'flex-end' },
  heroBannerImg: { opacity: 0.82 },
  heroTint:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroBottomFade:{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
                   backgroundColor: 'rgba(0,0,0,0.38)' },
  heroBackBtn:   { position: 'absolute', top: 16, left: 16, width: 42, height: 42,
                   borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.38)',
                   alignItems: 'center', justifyContent: 'center' },
  heroBackBtnText: { color: colors.white, fontSize: 20, fontWeight: '600' },
  heroCatBadge:  { position: 'absolute', bottom: 16, right: 16,
                   backgroundColor: 'rgba(0,0,0,0.40)', borderRadius: 99,
                   paddingHorizontal: 12, paddingVertical: 5 },
  heroCatBadgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  heroCustomBadge:  { position: 'absolute', bottom: 16, right: 16,
                      backgroundColor: 'rgba(0,0,0,0.40)', borderRadius: 99,
                      paddingHorizontal: 12, paddingVertical: 5 },
  heroCustomBadgeText: { color: colors.white, fontSize: 12, fontWeight: '600' },

  // ── Info card ──────────────────────────────────────────────
  infoCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    marginTop: -28,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 28,
  },

  // Logo flotante
  logoFloat: {
    marginTop: -44,
    marginBottom: 14,
    borderWidth: 4,
    borderColor: colors.white,
    borderRadius: 28,
    elevation: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  bizLogo: { width: 84, height: 84, borderRadius: 24, borderWidth: 2 },
  bizIcon: { width: 84, height: 84, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },

  bizName: { color: colors.gray900, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  bizMeta: { color: colors.gray500, fontSize: 14, marginTop: 4, textAlign: 'center' },
  bizDesc: { color: colors.gray600, fontSize: 14, textAlign: 'center', marginTop: 12,
             lineHeight: 20, paddingHorizontal: 8 },
  contactBox: { alignSelf: 'stretch', backgroundColor: colors.gray50, borderRadius: 16,
                paddingHorizontal: 16, paddingVertical: 12, marginTop: 16, gap: 8 },
  infoRow:   { flexDirection: 'row', alignItems: 'center' },
  infoEmoji: { fontSize: 14, marginRight: 8, width: 20 },
  infoText:  { color: colors.gray600, fontSize: 14, flex: 1 },

  // ── Sección campañas ───────────────────────────────────────
  sectionHeader:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
                      marginTop: 20, marginBottom: 16 },
  sectionTitle:     { color: colors.gray900, fontSize: 18, fontWeight: '700', flex: 1 },
  countBadge:       { borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4 },
  countBadgeText:   { fontSize: 14, fontWeight: '700' },

  empty:     { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  emptyTitle:{ color: colors.gray700, fontWeight: '700', fontSize: 18, textAlign: 'center' },
  emptySub:  { color: colors.gray400, fontSize: 14, textAlign: 'center', marginTop: 8 },
  errorTitle:{ color: colors.gray800, fontWeight: '700', fontSize: 18, textAlign: 'center' },
  retryBtn:  { marginTop: 24, backgroundColor: colors.primary500, borderRadius: 16, paddingHorizontal: 32, paddingVertical: 14 },
  retryText: { color: colors.white, fontWeight: '700', fontSize: 15 },

  campaignCard:  { marginHorizontal: 20, marginBottom: 16, backgroundColor: colors.white, borderRadius: 16, overflow: 'hidden' },
  campaignStripe:{ height: 6 },
  campaignBody:  { padding: 16 },
  campaignRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  campaignType:  { color: colors.gray500, fontSize: 12, fontWeight: '600' },
  campaignName:  { color: colors.gray900, fontWeight: '700', fontSize: 16, marginTop: 2 },
  progressPill:  { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  progressPillText: { fontSize: 12, fontWeight: '700' },
  newPill:       { backgroundColor: colors.green100, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  newPillText:   { color: colors.green700, fontSize: 12, fontWeight: '700' },
  campaignDesc:  { color: colors.gray500, fontSize: 14, marginBottom: 12 },
  rewardRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray50,
                   borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  rewardText:    { color: colors.gray700, fontSize: 14, fontWeight: '500', flex: 1 },
  stampsText:    { color: colors.gray400, fontSize: 12, marginLeft: 8 },
  tapHint:       { color: colors.primary500, fontSize: 12, fontWeight: '600', marginTop: 10, textAlign: 'right' },

  // ── Modal ──────────────────────────────────────────────────
  modalBg:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
                paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, maxHeight: '88%' },
  modalHandle:{ width: 48, height: 6, backgroundColor: colors.gray200, borderRadius: 99,
                alignSelf: 'center', marginBottom: 16 },
  modalHeader:{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  modalType:  { color: colors.gray500, fontSize: 13, fontWeight: '600' },
  modalTitle: { color: colors.gray900, fontSize: 22, fontWeight: '700', marginTop: 2 },
  modalSectionLabel: { color: colors.gray400, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  noCardBanner: { backgroundColor: colors.gray50, borderRadius: 12, padding: 14, marginBottom: 16 },
  noCardText: { color: colors.gray600, fontSize: 14, lineHeight: 20 },
  bigStatRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: 12 },
  bigStat:    { fontSize: 44, fontWeight: '700' },
  bigStatTotal: { color: colors.gray400, fontSize: 18, fontWeight: '600' },
  progressBg: { height: 10, backgroundColor: colors.gray100, borderRadius: 99, overflow: 'hidden', marginBottom: 20 },
  progressFill: { height: '100%', borderRadius: 99 },
  stampsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 8 },
  stamp:      { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stampCheck: { color: colors.white, fontSize: 16 },
  stampNum:   { color: colors.gray300, fontSize: 12 },
  singleStatBox: { alignItems: 'center', backgroundColor: colors.gray50, borderRadius: 16,
                   paddingVertical: 24, marginBottom: 8 },
  singleStatLabel: { color: colors.gray500, fontSize: 14, fontWeight: '600' },
  singleStatValue: { fontSize: 34, fontWeight: '700', marginTop: 8 },
  modalRewardRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray50,
                    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginTop: 16 },
  modalRewardLabel: { color: colors.gray400, fontSize: 12, fontWeight: '500' },
  modalRewardText:  { color: colors.gray800, fontWeight: '700', fontSize: 14 },
  badge:      { backgroundColor: colors.primary100, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText:  { color: colors.primary600, fontSize: 12, fontWeight: '700' },
  closeBtn:   { borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  closeBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
