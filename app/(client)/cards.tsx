import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, RefreshControl, ActivityIndicator,
  TouchableOpacity, Modal, Alert, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';
import { supabase } from '../../src/lib/supabase';
import { PunchCard } from '../../src/components/PunchCard';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { LoyaltyCardWithCampaign, RewardCatalogItem, RedeemCatalogItemResult } from '../../src/types/database';
import { colors, fonts } from '../../src/theme';

export default function CardsScreen() {
  const { user } = useAuthStore();
  const [cards,    setCards]    = useState<LoyaltyCardWithCampaign[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,    setError]    = useState(false);
  const firstLoad = useRef(true);

  // Catálogo de puntos
  const [catalogCard,    setCatalogCard]    = useState<LoyaltyCardWithCampaign | null>(null);
  const [catalogItems,   setCatalogItems]   = useState<RewardCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [redeemingId,    setRedeemingId]    = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error: err } = await supabase
        .from('loyalty_cards')
        .select('*, campaigns (*, businesses (id, name, logo_url, cover_url, card_color, city, category))')
        .eq('customer_id', user.id)
        .order('updated_at', { ascending: false });
      if (err) throw err;
      const valid = (data ?? []).filter(
        (c: any) => c.campaigns != null && c.campaigns.businesses != null,
      );
      setCards(valid as LoyaltyCardWithCampaign[]);
      setError(false);
    } catch (e) {
      console.error(e);
      if (firstLoad.current) setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
      firstLoad.current = false;
    }
  }, [user]);

  useFocusEffect(useCallback(() => { fetchCards(); }, [fetchCards]));

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`loyalty-cards-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'loyalty_cards', filter: `customer_id=eq.${user.id}` },
        () => { fetchCards(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchCards]);

  const onRefresh = () => { setRefreshing(true); fetchCards(); };

  const openCatalog = async (card: LoyaltyCardWithCampaign) => {
    setCatalogCard(card);
    setCatalogItems([]);
    setCatalogLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('reward_catalog_items')
        .select('*')
        .eq('campaign_id', card.campaign_id)
        .eq('is_active', true)
        .order('points_cost', { ascending: true });
      if (err) throw err;
      setCatalogItems((data ?? []) as RewardCatalogItem[]);
    } catch (e) {
      console.error(e);
    } finally {
      setCatalogLoading(false);
    }
  };

  const redeemItem = async (item: RewardCatalogItem) => {
    if (!catalogCard) return;
    if (catalogCard.current_points < item.points_cost) {
      Alert.alert('Puntos insuficientes', `Necesitas ${item.points_cost} puntos y tienes ${catalogCard.current_points}.`);
      return;
    }
    Alert.alert('Canjear puntos', `¿Canjear "${item.name}" por ${item.points_cost} puntos?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Canjear', onPress: async () => {
          setRedeemingId(item.id);
          try {
            const { data, error: err } = await supabase.rpc('redeem_catalog_item', { p_item_id: item.id });
            if (err) throw err;
            const result = data as RedeemCatalogItemResult | null;
            if (!result?.success) {
              const reason = result?.error;
              Alert.alert('No se pudo canjear',
                reason === 'insufficient_points' ? 'No tienes puntos suficientes.' :
                reason === 'no_card'             ? 'Aún no tienes tarjeta en esta campaña.' :
                reason === 'inactive'            ? 'Este artículo ya no está disponible.' :
                reason === 'campaign_archived'   ? 'Esta campaña ya no está disponible.' :
                'Inténtalo de nuevo.');
              return;
            }
            Alert.alert('¡Canjeado! 🎉', `Tienes un nuevo premio pendiente. Te quedan ${result.points_left ?? 0} puntos.`);
            setCatalogCard(null);
            fetchCards();
          } catch (e: any) {
            Alert.alert('Error', e.message ?? 'No se pudo canjear el artículo');
          } finally {
            setRedeemingId(null);
          }
        },
      },
    ]);
  };

  if (loading) return <SafeAreaView style={s.center}><ActivityIndicator size="large" color={colors.primary500} /></SafeAreaView>;

  if (error) return (
    <SafeAreaView style={s.center}>
      <Text style={{ fontSize: 56, marginBottom: 16 }}>⚠️</Text>
      <Text style={s.errorTitle}>No se pudieron cargar tus tarjetas</Text>
      <Text style={s.errorSub}>Comprueba tu conexión e inténtalo de nuevo</Text>
      <TouchableOpacity style={s.retryBtn} onPress={() => { setLoading(true); firstLoad.current = true; fetchCards(); }}>
        <Text style={s.retryText}>Reintentar</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );

  const active    = cards.filter((c) => !c.is_completed);
  const completed = cards.filter((c) => c.is_completed);

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary500} />}
      >
        <View style={s.header}>
          <Text style={s.title}>Mis tarjetas 💳</Text>
          <Text style={s.subtitle}>
            {cards.length === 0
              ? 'Visita un negocio para empezar'
              : `${cards.length} tarjeta${cards.length !== 1 ? 's' : ''} activa${cards.length !== 1 ? 's' : ''}`}
          </Text>
        </View>

        {cards.length === 0 ? (
          <EmptyState
            variant="chest"
            title="¡El cofre está vacío! 🏴‍☠️"
            subtitle="Visita un negocio para que te sellen tu primera tarjeta y empieces a acumular premios"
          />
        ) : (
          <>
            {active.length > 0 && (
              <>
                <View style={s.section}>
                  <Text style={s.sectionText}>En progreso ({active.length})</Text>
                </View>
                {active.map((c) => (
                  <PunchCard
                    key={c.id}
                    card={c}
                    onPress={c.campaigns?.type === 'points' ? () => openCatalog(c) : undefined}
                  />
                ))}
              </>
            )}
            {completed.length > 0 && (
              <>
                <View style={s.section}>
                  <Text style={[s.sectionText, { color: colors.primary500 }]}>
                    🎉 ¡Completadas! ({completed.length})
                  </Text>
                </View>
                {completed.map((c) => (
                  <PunchCard
                    key={c.id}
                    card={c}
                    onPress={c.campaigns?.type === 'points' ? () => openCatalog(c) : undefined}
                  />
                ))}
              </>
            )}
          </>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Modal catálogo de puntos */}
      <Modal visible={!!catalogCard} animationType="slide" transparent onRequestClose={() => setCatalogCard(null)}>
        <View style={s.modalBg}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>Catálogo de puntos</Text>
                {catalogCard && <Text style={s.subtitle}>{catalogCard.campaigns?.name}</Text>}
              </View>
              <TouchableOpacity onPress={() => setCatalogCard(null)}>
                <Text style={{ color: colors.gray400, fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {catalogCard && (
              <View style={s.pointsBalance}>
                <Text style={s.pointsBalanceLabel}>Tus puntos</Text>
                <Text style={s.pointsBalanceValue}>⭐ {catalogCard.current_points}</Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {catalogLoading ? (
                <ActivityIndicator color={colors.primary500} style={{ marginVertical: 24 }} />
              ) : catalogItems.length === 0 ? (
                <View style={s.catalogEmpty}>
                  <Text style={{ fontSize: 40, marginBottom: 8 }}>🎁</Text>
                  <Text style={s.catalogEmptyText}>Este negocio aún no ha añadido artículos canjeables.</Text>
                </View>
              ) : (
                catalogItems.map((item) => {
                  const affordable = !!catalogCard && catalogCard.current_points >= item.points_cost;
                  return (
                    <View key={item.id} style={s.itemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemName}>{item.name}</Text>
                        {!!item.description && <Text style={s.itemDesc}>{item.description}</Text>}
                        <Text style={[s.itemCost, { color: affordable ? colors.primary600 : colors.gray400 }]}>
                          ⭐ {item.points_cost} puntos
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[s.redeemItemBtn, !affordable && { backgroundColor: colors.gray200 }]}
                        onPress={() => redeemItem(item)}
                        disabled={!affordable || redeemingId === item.id}
                        activeOpacity={0.8}
                      >
                        {redeemingId === item.id
                          ? <ActivityIndicator color={colors.white} size="small" />
                          : <Text style={s.redeemItemText}>{affordable ? 'Canjear' : 'Faltan pts'}</Text>}
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
              <View style={{ height: 16 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: colors.background },
  center:   { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header:   { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, backgroundColor: colors.surface },
  title:    { color: colors.accent, fontSize: 24, fontWeight: '800', fontFamily: fonts.extrabold },
  subtitle: { color: colors.gray400, fontFamily: fonts.regular, fontSize: 14, marginTop: 4 },
  section:  { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  sectionText: { color: colors.accent, fontWeight: '700', fontFamily: fonts.bold, fontSize: 16 },

  errorTitle:{ color: colors.accent, fontWeight: '700', fontFamily: fonts.bold, fontSize: 18, textAlign: 'center' },
  errorSub:  { color: colors.gray400, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', marginTop: 8 },
  retryBtn:  { marginTop: 24, backgroundColor: colors.primary500, borderRadius: 999, paddingHorizontal: 32, paddingVertical: 14 },
  retryText: { color: colors.white, fontWeight: '700', fontFamily: fonts.bold, fontSize: 15 },

  modalBg:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, maxHeight: '85%' },
  modalHandle:{ width: 48, height: 6, backgroundColor: colors.gray200, borderRadius: 99, alignSelf: 'center', marginBottom: 16 },
  modalHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { color: colors.accent, fontSize: 20, fontWeight: '700', fontFamily: fonts.bold },

  pointsBalance:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primary50, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16 },
  pointsBalanceLabel: { color: colors.primary600, fontSize: 14, fontWeight: '600', fontFamily: fonts.semibold },
  pointsBalanceValue: { color: colors.primary600, fontSize: 22, fontWeight: '700', fontFamily: fonts.bold },

  catalogEmpty:    { alignItems: 'center', paddingVertical: 32 },
  catalogEmptyText:{ color: colors.gray400, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center' },

  itemRow:       { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 16, padding: 16, marginBottom: 12 },
  itemName:      { color: colors.accent, fontWeight: '700', fontFamily: fonts.bold, fontSize: 15 },
  itemDesc:      { color: colors.gray400, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  itemCost:      { fontSize: 13, fontWeight: '700', fontFamily: fonts.bold, marginTop: 6 },
  redeemItemBtn: { backgroundColor: colors.primary500, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, marginLeft: 12, minWidth: 96, alignItems: 'center' },
  redeemItemText:{ color: colors.white, fontWeight: '700', fontFamily: fonts.bold, fontSize: 13 },
});
