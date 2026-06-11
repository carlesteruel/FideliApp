import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal, Switch, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore } from '../../src/store/useAuthStore';
import { supabase } from '../../src/lib/supabase';
import { Campaign, CampaignType, CampaignStatus, RewardCatalogItem, SetCampaignStatusResult } from '../../src/types/database';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { colors, fonts } from '../../src/theme';

const CAMPAIGN_TYPES = [
  { id: 'punch_card',     emoji: '☕', label: 'Tarjeta de sellos',  desc: 'X sellos → premio gratis' },
  { id: 'points',         emoji: '⭐', label: 'Puntos',             desc: 'Acumula puntos por €' },
  { id: 'birthday',       emoji: '🎂', label: 'Cumpleaños',         desc: 'Premio en el día especial' },
  { id: 'streak',         emoji: '🔥', label: 'Racha',              desc: 'Premia la fidelidad continua' },
  { id: 'first_visit',    emoji: '👋', label: 'Primera visita',     desc: 'Premio al nuevo cliente' },
  { id: 'min_spend',      emoji: '💶', label: 'Gasto mínimo',       desc: 'Premio a partir de X€ en una compra' },
  { id: 'monthly_visits', emoji: '📅', label: 'Visitas mensuales',  desc: 'X visitas al mes → premio' },
  { id: 'referral',       emoji: '👥', label: 'Referidos',          desc: 'Cada referido = un premio' },
];

const typeEmoji = (t: CampaignType): string => {
  const map: Partial<Record<CampaignType, string>> = {
    punch_card: '☕', points: '⭐', birthday: '🎂', streak: '🔥',
    first_visit: '👋', min_spend: '💶', monthly_visits: '📅', referral: '👥',
  };
  return map[t] ?? '🎯';
};
const typeLabel = (t: CampaignType): string => {
  const map: Partial<Record<CampaignType, string>> = {
    punch_card: '☕ Tarjeta de sellos', points: '⭐ Puntos', birthday: '🎂 Cumpleaños',
    streak: '🔥 Racha', first_visit: '👋 Primera visita', min_spend: '💶 Gasto mínimo',
    monthly_visits: '📅 Visitas mensuales', referral: '👥 Referidos',
  };
  return map[t] ?? t;
};

type TabKey = 'active' | 'ended' | 'archived';

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: 'active',   label: 'Activas',    emoji: '✅' },
  { key: 'ended',    label: 'Terminadas', emoji: '🏁' },
  { key: 'archived', label: 'Archivadas', emoji: '📦' },
];

export default function CampaignsScreen() {
  const { profile } = useAuthStore();
  const params = useLocalSearchParams<{ editId?: string }>();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('active');

  // ── Modal nueva campaña ────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [formType, setFormType] = useState<CampaignType>('punch_card');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formReward, setFormReward] = useState('');
  const [formStamps, setFormStamps] = useState('10');
  const [formPointsPerEuro, setFormPointsPerEuro] = useState('10');
  const [formPointsToReward, setFormPointsToReward] = useState('500');
  const [formSaving, setFormSaving] = useState(false);

  // ── Modal edición ──────────────────────────────────────────
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editReward, setEditReward] = useState('');
  const [editStamps, setEditStamps] = useState('10');
  const [editPointsPerEuro, setEditPointsPerEuro] = useState('10');
  const [editPointsToReward, setEditPointsToReward] = useState('500');
  const [editVisitsRequired, setEditVisitsRequired] = useState('5');
  const [editPeriodDays, setEditPeriodDays] = useState('7');
  const [editDaysWindow, setEditDaysWindow] = useState('7');
  const [editMinAmount, setEditMinAmount] = useState('20');
  const [editRefereeReward, setEditRefereeReward] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // ── Campos extra para nuevos tipos (form crear) ────────────
  const [formMinAmount, setFormMinAmount] = useState('20');
  const [formMonthlyVisits, setFormMonthlyVisits] = useState('4');
  const [formRefereeReward, setFormRefereeReward] = useState('');

  // ── Catálogo de puntos ─────────────────────────────────────
  const [catalogCampaign, setCatalogCampaign] = useState<Campaign | null>(null);
  const [catalogItems, setCatalogItems] = useState<RewardCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemPoints, setItemPoints] = useState('');
  const [itemSaving, setItemSaving] = useState(false);

  const fetchData = async () => {
    if (!profile) return;
    try {
      const { data: biz } = await supabase.from('businesses').select('id').eq('owner_id', profile.id).single();
      if (!biz) { setLoading(false); setRefreshing(false); return; }
      const bId = (biz as any).id; setBusinessId(bId);
      const { data } = await supabase.from('campaigns').select('*').eq('business_id', bId).order('created_at', { ascending: false });
      if (data) setCampaigns(data as Campaign[]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, [profile]));
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // Ref para evitar abrir el modal de edición más de una vez por el mismo editId
  const handledEditId = useRef<string | null>(null);

  // Abrir edición automáticamente si viene un editId por params
  useEffect(() => {
    if (!params.editId || campaigns.length === 0) return;
    if (handledEditId.current === params.editId) return; // ya procesado
    const target = campaigns.find((c) => c.id === params.editId);
    if (target) {
      handledEditId.current = params.editId;
      openEdit(target);
    }
  }, [params.editId, campaigns]);

  const toggleCampaign = async (c: Campaign) => {
    await supabase.from('campaigns').update({ is_active: !c.is_active }).eq('id', c.id);
    fetchData();
  };

  const changeStatus = async (c: Campaign, status: CampaignStatus) => {
    const { data, error } = await supabase.rpc('set_campaign_status', { p_campaign_id: c.id, p_status: status });
    if (error) { Alert.alert('Error', error.message); return; }
    const result = data as SetCampaignStatusResult | null;
    if (!result?.success) {
      Alert.alert('No se pudo actualizar', result?.error === 'unauthorized' ? 'No tienes permiso sobre esta campaña.' : 'Inténtalo de nuevo.');
      return;
    }
    if (status === 'active') setActiveTab('active');
    if (status === 'ended') setActiveTab('ended');
    if (status === 'archived') setActiveTab('archived');
    fetchData();
  };

  const confirmEnd = (c: Campaign) => {
    Alert.alert(
      'Terminar campaña',
      `"${c.name}" dejará de admitir nuevos clientes. Quienes ya tengan una tarjeta en curso podrán terminarla; al completarla ya no podrán usarla más.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Terminar', style: 'destructive', onPress: () => changeStatus(c, 'ended') },
      ],
    );
  };

  const confirmArchive = (c: Campaign) => {
    Alert.alert(
      'Archivar campaña',
      `"${c.name}" se ocultará y quedará congelada (sin nuevos sellos ni puntos). Los premios ya ganados seguirán siendo canjeables. Podrás reactivarla cuando quieras.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Archivar', style: 'destructive', onPress: () => changeStatus(c, 'archived') },
      ],
    );
  };

  // ── Crear campaña ──────────────────────────────────────────
  const handleCreate = async () => {
    if (!formName.trim() || !formReward.trim() || !businessId) return;
    setFormSaving(true);
    let config: Record<string, any> = {};
    if (formType === 'punch_card') config = { total_stamps: parseInt(formStamps, 10) || 10, reward: formReward };
    else if (formType === 'points') config = { points_per_euro: parseInt(formPointsPerEuro, 10) || 10, points_to_reward: parseInt(formPointsToReward, 10) || 500, reward: formReward };
    else if (formType === 'birthday') config = { reward: formReward, days_window: 7 };
    else if (formType === 'streak') config = { visits_required: 5, period_days: 7, reward: formReward };
    else if (formType === 'first_visit') config = { reward: formReward };
    else if (formType === 'min_spend') config = { min_amount: parseFloat(formMinAmount) || 20, reward: formReward };
    else if (formType === 'monthly_visits') config = { visits_required: parseInt(formMonthlyVisits, 10) || 4, reward: formReward };
    else if (formType === 'referral') config = { referrer_reward: formReward, referee_reward: formRefereeReward || formReward };
    const { error } = await supabase.from('campaigns').insert({ business_id: businessId, name: formName.trim(), description: formDescription.trim() || null, type: formType, config, reward_description: formReward.trim(), is_active: true });
    setFormSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setShowModal(false);
    setFormName(''); setFormDescription(''); setFormReward(''); setFormStamps('10'); setFormPointsPerEuro('10'); setFormPointsToReward('500'); setFormType('punch_card'); setFormMinAmount('20'); setFormMonthlyVisits('4'); setFormRefereeReward('');
    setActiveTab('active');
    fetchData();
  };

  // ── Editar campaña ─────────────────────────────────────────
  const openEdit = (c: Campaign) => {
    const cfg = c.config as any;
    setEditName(c.name);
    setEditDescription(c.description ?? '');
    setEditReward(c.reward_description);
    setEditStamps(String(cfg?.total_stamps ?? 10));
    setEditPointsPerEuro(String(cfg?.points_per_euro ?? 10));
    setEditPointsToReward(String(cfg?.points_to_reward ?? 500));
    setEditVisitsRequired(String(cfg?.visits_required ?? 5));
    setEditPeriodDays(String(cfg?.period_days ?? 7));
    setEditDaysWindow(String(cfg?.days_window ?? 7));
    setEditMinAmount(String(cfg?.min_amount ?? 20));
    setEditRefereeReward(String(cfg?.referee_reward ?? ''));
    setEditCampaign(c);
  };

  const handleSave = async () => {
    if (!editCampaign) return;
    if (!editName.trim() || !editReward.trim()) {
      Alert.alert('Campos requeridos', 'El nombre y el premio son obligatorios.');
      return;
    }
    setEditSaving(true);

    // Actualizar config según tipo
    const cfg = editCampaign.config as any;
    let newConfig: Record<string, any> = { ...cfg };
    if (editCampaign.type === 'punch_card') {
      newConfig = { ...cfg, total_stamps: parseInt(editStamps, 10) || cfg.total_stamps, reward: editReward.trim() };
    } else if (editCampaign.type === 'points') {
      newConfig = { ...cfg, points_per_euro: parseInt(editPointsPerEuro, 10) || cfg.points_per_euro, points_to_reward: parseInt(editPointsToReward, 10) || cfg.points_to_reward, reward: editReward.trim() };
    } else if (editCampaign.type === 'birthday') {
      newConfig = { ...cfg, reward: editReward.trim(), days_window: parseInt(editDaysWindow, 10) || cfg.days_window };
    } else if (editCampaign.type === 'streak') {
      newConfig = { ...cfg, visits_required: parseInt(editVisitsRequired, 10) || cfg.visits_required, period_days: parseInt(editPeriodDays, 10) || cfg.period_days, reward: editReward.trim() };
    } else if (editCampaign.type === 'min_spend') {
      newConfig = { ...cfg, min_amount: parseFloat(editMinAmount) || cfg.min_amount, reward: editReward.trim() };
    } else if (editCampaign.type === 'monthly_visits') {
      newConfig = { ...cfg, visits_required: parseInt(editVisitsRequired, 10) || cfg.visits_required, reward: editReward.trim() };
    } else if (editCampaign.type === 'referral') {
      newConfig = { ...cfg, referrer_reward: editReward.trim(), referee_reward: editRefereeReward.trim() || editReward.trim() };
    }

    const { error } = await supabase.from('campaigns').update({
      name: editName.trim(),
      description: editDescription.trim() || null,
      reward_description: editReward.trim(),
      config: newConfig,
    }).eq('id', editCampaign.id);

    setEditSaving(false);
    if (error) { Alert.alert('Error al guardar', error.message); return; }
    setEditCampaign(null);
    fetchData();
  };

  // ── Catálogo ────────────────────────────────────────────────
  const openCatalog = async (c: Campaign) => {
    setCatalogCampaign(c);
    setItemName(''); setItemDesc(''); setItemPoints('');
    setCatalogItems([]);
    await fetchCatalog(c.id);
  };

  const fetchCatalog = async (campaignId: string) => {
    setCatalogLoading(true);
    try {
      const { data, error } = await supabase
        .from('reward_catalog_items')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('points_cost', { ascending: true });
      if (error) throw error;
      setCatalogItems((data ?? []) as RewardCatalogItem[]);
    } catch (e) {
      console.error(e);
    } finally {
      setCatalogLoading(false);
    }
  };

  const addCatalogItem = async () => {
    if (!catalogCampaign || !businessId) return;
    const cost = parseInt(itemPoints, 10);
    if (!itemName.trim() || !cost || cost <= 0) {
      Alert.alert('Campos incompletos', 'Indica un nombre y un coste en puntos mayor que 0.');
      return;
    }
    setItemSaving(true);
    const { error } = await supabase.from('reward_catalog_items').insert({
      campaign_id: catalogCampaign.id,
      business_id: businessId,
      name: itemName.trim(),
      description: itemDesc.trim() || null,
      points_cost: cost,
      image_url: null,
    });
    setItemSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setItemName(''); setItemDesc(''); setItemPoints('');
    fetchCatalog(catalogCampaign.id);
  };

  const deleteCatalogItem = (item: RewardCatalogItem) => {
    Alert.alert('Eliminar artículo', `¿Quitar "${item.name}" del catálogo?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('reward_catalog_items').delete().eq('id', item.id);
          if (error) { Alert.alert('Error', error.message); return; }
          if (catalogCampaign) fetchCatalog(catalogCampaign.id);
        },
      },
    ]);
  };

  if (loading) return <SafeAreaView style={s.loadingScreen}><ActivityIndicator size="large" color={colors.primary500} /></SafeAreaView>;

  // Conteos por pestaña
  const countActive   = campaigns.filter((c) => c.status === 'active').length;
  const countEnded    = campaigns.filter((c) => c.status === 'ended').length;
  const countArchived = campaigns.filter((c) => c.status === 'archived').length;

  const tabCount: Record<TabKey, number> = {
    active:   countActive,
    ended:    countEnded,
    archived: countArchived,
  };

  const tabCampaigns = campaigns.filter((c) => c.status === activeTab);

  const TAB_EMPTY: Record<TabKey, { emoji: string; title: string; sub: string }> = {
    active:   { emoji: '🎯', title: 'No hay campañas activas', sub: 'Crea una nueva campaña para empezar a fidelizar clientes.' },
    ended:    { emoji: '🏁', title: 'No hay campañas terminadas', sub: 'Las campañas que termines aparecerán aquí.' },
    archived: { emoji: '📦', title: 'No hay campañas archivadas', sub: 'Las campañas archivadas se guardarán aquí.' },
  };

  const renderCard = (c: Campaign) => {
    const isArchived = c.status === 'archived';
    const isEnded = c.status === 'ended';
    const stripeColor = isArchived ? colors.gray300 : isEnded ? colors.secondary500 : c.is_active ? colors.primary500 : colors.gray200;
    return (
      <View key={c.id} style={[s.card, { elevation: 2 }]}>
        <View style={[s.cardStripe, { backgroundColor: stripeColor }]} />
        <View style={s.cardBody}>
          <View style={s.cardRow}>
            <View style={s.cardIcon}><Text style={{ fontSize: 22 }}>{typeEmoji(c.type)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardName}>{c.name}</Text>
              <Text style={s.cardMeta}>{typeLabel(c.type)} · {c.total_redemptions} canjes</Text>
            </View>
            {c.status === 'active' && (
              <Switch value={c.is_active} onValueChange={() => toggleCampaign(c)} trackColor={{ false: colors.gray200, true: colors.primary100 }} thumbColor={c.is_active ? colors.primary500 : colors.gray400} />
            )}
          </View>

          {/* Estado */}
          <View style={s.statusRow}>
            {isArchived ? (
              <View style={[s.statusBadge, { backgroundColor: colors.gray100 }]}><Text style={[s.statusBadgeText, { color: colors.gray500 }]}>📦 Archivada</Text></View>
            ) : isEnded ? (
              <View style={[s.statusBadge, { backgroundColor: '#FEF3E2' }]}><Text style={[s.statusBadgeText, { color: colors.secondary500 }]}>🏁 Terminada · finaliza cartones en curso</Text></View>
            ) : c.is_active ? (
              <View style={[s.statusBadge, { backgroundColor: colors.green100 }]}><Text style={[s.statusBadgeText, { color: colors.green600 }]}>✅ Activa</Text></View>
            ) : (
              <View style={[s.statusBadge, { backgroundColor: colors.gray100 }]}><Text style={[s.statusBadgeText, { color: colors.gray500 }]}>⏸ Pausada</Text></View>
            )}
          </View>

          <View style={s.rewardRow}>
            <Text style={{ fontSize: 16, marginRight: 8 }}>🎁</Text>
            <Text style={s.rewardText}>{c.reward_description}</Text>
          </View>
          {c.type === 'punch_card' && <Text style={s.configText}>{(c.config as any)?.total_stamps ?? 10} sellos necesarios</Text>}
          {c.type === 'points' && <Text style={s.configText}>{(c.config as any)?.points_per_euro ?? 10} puntos por cada €</Text>}
          {c.type === 'streak' && <Text style={s.configText}>{(c.config as any)?.visits_required ?? 5} visitas en {(c.config as any)?.period_days ?? 7} días</Text>}
          {c.type === 'min_spend' && <Text style={s.configText}>A partir de {(c.config as any)?.min_amount ?? 20}€ por compra</Text>}
          {c.type === 'monthly_visits' && <Text style={s.configText}>{(c.config as any)?.visits_required ?? 4} visitas al mes</Text>}
          {c.type === 'referral' && <Text style={s.configText}>Premio por referido · nuevo cliente: {(c.config as any)?.referee_reward ?? '—'}</Text>}
          {c.type === 'birthday' && <Text style={s.configText}>Ventana de {(c.config as any)?.days_window ?? 7} días</Text>}
          {c.type === 'first_visit' && <Text style={s.configText}>Premio único en la primera visita</Text>}

          {/* Catálogo de puntos */}
          {c.type === 'points' && !isArchived && (
            <TouchableOpacity style={s.catalogBtn} onPress={() => openCatalog(c)}>
              <Text style={s.catalogBtnText}>🎁 Gestionar catálogo de puntos</Text>
            </TouchableOpacity>
          )}

          {/* Acciones */}
          <View style={s.actionsRow}>
            {/* Botón editar — disponible en todos los estados */}
            <TouchableOpacity style={[s.actionBtn, s.actionEdit]} onPress={() => openEdit(c)}>
              <Text style={[s.actionText, { color: colors.primary600 }]}>✏️ Editar</Text>
            </TouchableOpacity>

            {c.status === 'active' && (
              <>
                <TouchableOpacity style={[s.actionBtn, s.actionWarn]} onPress={() => confirmEnd(c)}><Text style={[s.actionText, { color: colors.secondary500 }]}>🏁 Terminar</Text></TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, s.actionMuted]} onPress={() => confirmArchive(c)}><Text style={[s.actionText, { color: colors.gray500 }]}>📦 Archivar</Text></TouchableOpacity>
              </>
            )}
            {c.status === 'ended' && (
              <>
                <TouchableOpacity style={[s.actionBtn, s.actionPrimary]} onPress={() => changeStatus(c, 'active')}><Text style={[s.actionText, { color: colors.primary600 }]}>↻ Reactivar</Text></TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, s.actionMuted]} onPress={() => confirmArchive(c)}><Text style={[s.actionText, { color: colors.gray500 }]}>📦 Archivar</Text></TouchableOpacity>
              </>
            )}
            {c.status === 'archived' && (
              <TouchableOpacity style={[s.actionBtn, s.actionPrimary]} onPress={() => changeStatus(c, 'active')}><Text style={[s.actionText, { color: colors.primary600 }]}>↻ Reactivar</Text></TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const emptyTab = TAB_EMPTY[activeTab];

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary500} />}>
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
              <Text style={s.headerSup}>Gestión de</Text>
              <Text style={s.headerTitle}>Mis campañas</Text>
              <View style={s.headerPill}>
                <Ionicons name="checkmark-circle" size={13} color={colors.white} style={{ marginRight: 4, opacity: 0.85 }} />
                <Text style={s.headerPillText}>{countActive} activas · {campaigns.length} en total</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 10 }}>
              <View style={s.headerIcon}>
                <Ionicons name="megaphone" size={26} color="rgba(255,255,255,0.9)" />
              </View>
              <TouchableOpacity style={s.newBtn} onPress={() => setShowModal(true)}>
                <Ionicons name="add" size={15} color={colors.white} />
                <Text style={s.newBtnText}>Nueva</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>

        {campaigns.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIconWrap}>
              <Ionicons name="megaphone-outline" size={48} color={colors.primary500} />
            </View>
            <Text style={s.emptyTitle}>Crea tu primera campaña</Text>
            <Text style={s.emptySub}>Las campañas te permiten fidelizar clientes y premiar su lealtad</Text>
            <View style={{ marginTop: 24 }}><Button title="Crear campaña" onPress={() => setShowModal(true)} size="lg" /></View>
          </View>
        ) : (
          <>
            {/* Tab bar */}
            <View style={s.tabBar}>
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                const count = tabCount[tab.key];
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[s.tabItem, isActive && s.tabItemActive]}
                    onPress={() => setActiveTab(tab.key)}
                    activeOpacity={0.7}
                  >
                    <View style={s.tabLabelRow}>
                      <Text style={[s.tabLabel, isActive && s.tabLabelActive]}>
                        {tab.emoji} {tab.label}
                      </Text>
                      {count > 0 && (
                        <View style={[s.tabBadge, isActive && s.tabBadgeActive]}>
                          <Text style={[s.tabBadgeText, isActive && s.tabBadgeTextActive]}>{count}</Text>
                        </View>
                      )}
                    </View>
                    {isActive && <View style={s.tabIndicator} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Contenido de la pestaña */}
            <View style={{ paddingTop: 16 }}>
              {tabCampaigns.length === 0 ? (
                <View style={s.tabEmpty}>
                  <Text style={{ fontSize: 48, marginBottom: 12 }}>{emptyTab.emoji}</Text>
                  <Text style={s.tabEmptyTitle}>{emptyTab.title}</Text>
                  <Text style={s.tabEmptySub}>{emptyTab.sub}</Text>
                  {activeTab === 'active' && (
                    <View style={{ marginTop: 20 }}>
                      <Button title="+ Nueva campaña" onPress={() => setShowModal(true)} size="md" />
                    </View>
                  )}
                </View>
              ) : (
                tabCampaigns.map(renderCard)
              )}
            </View>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Modal: nueva campaña */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={s.modalBg}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Nueva campaña</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}><Text style={{ color: colors.gray400, fontSize: 20 }}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.fieldLabel}>Tipo de campaña</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {CAMPAIGN_TYPES.map((t) => (
                  <TouchableOpacity key={t.id} onPress={() => setFormType(t.id as CampaignType)}
                    style={[s.typeBtn, formType === t.id ? s.typeBtnActive : s.typeBtnInactive]}>
                    <Text style={{ fontSize: 22, marginBottom: 4 }}>{t.emoji}</Text>
                    <Text style={[s.typeBtnText, { color: formType === t.id ? colors.primary600 : colors.gray600 }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Input label="Nombre de la campaña *" placeholder="10 cafés, el siguiente gratis" value={formName} onChangeText={setFormName} />
              <Input label="Descripción (opcional)" placeholder="Detalla tu campaña..." value={formDescription} onChangeText={setFormDescription} />
              <Input label="Premio al completar *" placeholder="1 café gratis de cualquier tipo" value={formReward} onChangeText={setFormReward} />
              {formType === 'punch_card' && <Input label="Número de sellos necesarios" placeholder="10" keyboardType="number-pad" value={formStamps} onChangeText={setFormStamps} />}
              {formType === 'points' && (
                <>
                  <Input label="Puntos por cada €" placeholder="10" keyboardType="number-pad" value={formPointsPerEuro} onChangeText={setFormPointsPerEuro} />
                  <Text style={s.helperText}>💡 Ejemplo: con 10 pts/€, una compra de 5 € da 50 puntos. Define los artículos canjeables en el catálogo tras crear la campaña.</Text>
                </>
              )}
              {formType === 'streak' && (
                <Text style={s.helperText}>🔥 Al crear la campaña, la racha se configura con 5 visitas en 7 días. Puedes ajustarlo editando la campaña.</Text>
              )}
              {formType === 'min_spend' && (
                <>
                  <Input label="Gasto mínimo (€)" placeholder="20" keyboardType="decimal-pad" value={formMinAmount} onChangeText={setFormMinAmount} />
                  <Text style={s.helperText}>💡 El cliente recibe el premio cuando gasta este importe o más en una sola visita.</Text>
                </>
              )}
              {formType === 'monthly_visits' && (
                <>
                  <Input label="Visitas necesarias al mes" placeholder="4" keyboardType="number-pad" value={formMonthlyVisits} onChangeText={setFormMonthlyVisits} />
                  <Text style={s.helperText}>📅 El contador se reinicia automáticamente el 1 de cada mes.</Text>
                </>
              )}
              {formType === 'referral' && (
                <>
                  <Input label="Premio para el nuevo cliente *" placeholder="10% descuento primera visita" value={formRefereeReward} onChangeText={setFormRefereeReward} />
                  <Text style={s.helperText}>👥 El campo "Premio al completar" es para quien refiere. Sella al cliente que trajo a alguien nuevo para darle su premio.</Text>
                </>
              )}
              {formType === 'birthday' && (
                <Text style={s.helperText}>🎂 Sella al cliente para inscribirle en la campaña. Recibirá el premio automáticamente durante su semana de cumpleaños.</Text>
              )}
              {formType === 'first_visit' && (
                <Text style={s.helperText}>👋 El cliente recibe el premio la primera vez que le selles. Perfecto para dar la bienvenida a nuevos clientes.</Text>
              )}
              <Button title="Crear campaña" onPress={handleCreate} loading={formSaving} size="lg" />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: editar campaña */}
      <Modal visible={!!editCampaign} animationType="slide" transparent onRequestClose={() => setEditCampaign(null)}>
        <View style={s.modalBg}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>Editar campaña</Text>
                {editCampaign && (
                  <View style={s.typePill}>
                    <Text style={s.typePillText}>{typeEmoji(editCampaign.type)} {typeLabel(editCampaign.type)}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => setEditCampaign(null)}><Text style={{ color: colors.gray400, fontSize: 20 }}>✕</Text></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Input label="Nombre de la campaña *" placeholder="10 cafés, el siguiente gratis" value={editName} onChangeText={setEditName} />
              <Input label="Descripción (opcional)" placeholder="Detalla tu campaña..." value={editDescription} onChangeText={setEditDescription} />
              <Input label="Premio al completar *" placeholder="1 café gratis de cualquier tipo" value={editReward} onChangeText={setEditReward} />

              {editCampaign?.type === 'punch_card' && (
                <Input label="Número de sellos necesarios" placeholder="10" keyboardType="number-pad" value={editStamps} onChangeText={setEditStamps} />
              )}
              {editCampaign?.type === 'points' && (
                <>
                  <Input label="Puntos por cada €" placeholder="10" keyboardType="number-pad" value={editPointsPerEuro} onChangeText={setEditPointsPerEuro} />
                  <Input label="Puntos mínimos para canjear" placeholder="500" keyboardType="number-pad" value={editPointsToReward} onChangeText={setEditPointsToReward} />
                </>
              )}
              {editCampaign?.type === 'birthday' && (
                <Input label="Días de ventana (antes/después del cumpleaños)" placeholder="7" keyboardType="number-pad" value={editDaysWindow} onChangeText={setEditDaysWindow} />
              )}
              {editCampaign?.type === 'streak' && (
                <>
                  <Input label="Visitas requeridas" placeholder="5" keyboardType="number-pad" value={editVisitsRequired} onChangeText={setEditVisitsRequired} />
                  <Input label="Período en días" placeholder="7" keyboardType="number-pad" value={editPeriodDays} onChangeText={setEditPeriodDays} />
                </>
              )}
              {editCampaign?.type === 'min_spend' && (
                <Input label="Gasto mínimo (€)" placeholder="20" keyboardType="decimal-pad" value={editMinAmount} onChangeText={setEditMinAmount} />
              )}
              {editCampaign?.type === 'monthly_visits' && (
                <Input label="Visitas necesarias al mes" placeholder="4" keyboardType="number-pad" value={editVisitsRequired} onChangeText={setEditVisitsRequired} />
              )}
              {editCampaign?.type === 'referral' && (
                <Input label="Premio para el nuevo cliente" placeholder="10% descuento primera visita" value={editRefereeReward} onChangeText={setEditRefereeReward} />
              )}

              <View style={{ height: 16 }} />
              <Button title="Guardar cambios" onPress={handleSave} loading={editSaving} size="lg" />
              <View style={{ height: 8 }} />
              <TouchableOpacity style={s.cancelBtn} onPress={() => setEditCampaign(null)}>
                <Text style={s.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: catálogo de puntos */}
      <Modal visible={!!catalogCampaign} animationType="slide" transparent onRequestClose={() => setCatalogCampaign(null)}>
        <View style={s.modalBg}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <View style={s.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>Catálogo de puntos</Text>
                {catalogCampaign && <Text style={s.subtitle}>{catalogCampaign.name}</Text>}
              </View>
              <TouchableOpacity onPress={() => setCatalogCampaign(null)}><Text style={{ color: colors.gray400, fontSize: 20 }}>✕</Text></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Lista de artículos */}
              {catalogLoading ? (
                <ActivityIndicator color={colors.primary500} style={{ marginVertical: 24 }} />
              ) : catalogItems.length === 0 ? (
                <View style={s.catalogEmpty}>
                  <Text style={{ fontSize: 40, marginBottom: 8 }}>🎁</Text>
                  <Text style={s.catalogEmptyText}>Aún no hay artículos. Añade el primero abajo.</Text>
                </View>
              ) : (
                catalogItems.map((item) => (
                  <View key={item.id} style={s.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemName}>{item.name}</Text>
                      {!!item.description && <Text style={s.itemDesc}>{item.description}</Text>}
                    </View>
                    <View style={s.itemPointsBadge}><Text style={s.itemPointsText}>{item.points_cost} pts</Text></View>
                    <TouchableOpacity onPress={() => deleteCatalogItem(item)} style={s.itemDelete}><Text style={{ color: colors.red400, fontSize: 18 }}>🗑</Text></TouchableOpacity>
                  </View>
                ))
              )}

              {/* Formulario para añadir artículo */}
              <View style={s.addBox}>
                <Text style={s.fieldLabel}>Añadir artículo</Text>
                <Input label="Nombre *" placeholder="Café gratis" value={itemName} onChangeText={setItemName} />
                <Input label="Descripción (opcional)" placeholder="Cualquier café de la carta" value={itemDesc} onChangeText={setItemDesc} />
                <Input label="Coste en puntos *" placeholder="200" keyboardType="number-pad" value={itemPoints} onChangeText={setItemPoints} />
                <Button title="Añadir al catálogo" onPress={addCatalogItem} loading={itemSaving} size="lg" />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: colors.background },
  loadingScreen:{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  // ── Header premium ────────────────────────────────────────────
  header:         { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, overflow: 'hidden', position: 'relative' },
  headerCircle1:  { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -50 },
  headerCircle2:  { position: 'absolute', width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -40, left: 40 },
  headerInner:    { flexDirection: 'row', alignItems: 'center' },
  headerSup:      { color: 'rgba(255,255,255,0.70)', fontSize: 12, fontFamily: fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.8 },
  headerTitle:    { color: colors.white, fontSize: 24, fontFamily: fonts.bold, fontWeight: '700', marginTop: 4, marginBottom: 10 },
  headerPill:     { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  headerPillText: { color: colors.white, fontSize: 12, fontFamily: fonts.semibold },
  headerIcon:     { width: 54, height: 54, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)', marginBottom: 8 },
  title:     { color: colors.accent, fontSize: 24, fontFamily: fonts.bold, fontWeight: '700' },
  subtitle:  { color: colors.gray500, fontSize: 14, fontFamily: fonts.regular, marginTop: 4 },
  newBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  newBtnText:{ color: colors.white, fontFamily: fonts.bold, fontWeight: '700', fontSize: 13 },
  emptyIconWrap: { width: 88, height: 88, backgroundColor: colors.primary50, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  empty:     { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 32 },
  emptyTitle:{ color: colors.accent, fontFamily: fonts.bold, fontWeight: '700', fontSize: 20, textAlign: 'center' },
  emptySub:  { color: colors.gray500, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', marginTop: 8 },

  // ── Tab bar ────────────────────────────────────────────────
  tabBar:      { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  tabItem:     { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabItemActive: {},
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabLabel:    { fontSize: 13, fontFamily: fonts.semibold, fontWeight: '600', color: colors.gray400 },
  tabLabelActive: { color: colors.primary600, fontFamily: fonts.semibold },
  tabBadge:    { backgroundColor: colors.gray200, borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  tabBadgeActive: { backgroundColor: colors.primary100 },
  tabBadgeText: { fontSize: 11, fontWeight: '700', color: colors.gray500 },
  tabBadgeTextActive: { color: colors.primary600 },
  tabIndicator: { position: 'absolute', bottom: 0, left: 12, right: 12, height: 3, borderRadius: 99, backgroundColor: colors.primary500 },

  // ── Tab empty state ───────────────────────────────────────
  tabEmpty:      { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 32 },
  tabEmptyTitle: { color: colors.accent, fontFamily: fonts.bold, fontWeight: '700', fontSize: 18, textAlign: 'center', marginBottom: 8 },
  tabEmptySub:   { color: colors.gray500, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center' },

  card:      { marginHorizontal: 20, marginBottom: 16, backgroundColor: colors.surface, borderRadius: 18, overflow: 'hidden', shadowColor: colors.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  cardStripe:{ height: 5 },
  cardBody:  { padding: 16 },
  cardRow:   { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  cardIcon:  { width: 48, height: 48, backgroundColor: colors.primary50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardName:  { color: colors.accent, fontFamily: fonts.bold, fontWeight: '700', fontSize: 16 },
  cardMeta:  { color: colors.gray400, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  statusRow: { flexDirection: 'row', marginBottom: 10 },
  statusBadge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  rewardRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  rewardText:{ color: colors.gray600, fontFamily: fonts.regular, fontSize: 14, flex: 1 },
  configText:{ color: colors.gray400, fontFamily: fonts.regular, fontSize: 12, marginBottom: 8 },
  catalogBtn: { backgroundColor: colors.primary50, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  catalogBtnText: { color: colors.primary600, fontWeight: '700', fontSize: 14 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  actionBtn:  { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', borderWidth: 1 },
  actionEdit:    { borderColor: colors.primary100, backgroundColor: colors.primary50 },
  actionWarn:    { borderColor: '#FBD9A8', backgroundColor: '#FFF8EF' },
  actionMuted:   { borderColor: colors.gray200, backgroundColor: colors.gray50 },
  actionPrimary: { borderColor: colors.primary100, backgroundColor: colors.primary50 },
  actionText: { fontSize: 13, fontWeight: '700' },
  modalBg:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, maxHeight: '90%' },
  modalHandle:{ width: 48, height: 6, backgroundColor: colors.gray200, borderRadius: 99, alignSelf: 'center', marginBottom: 16 },
  modalHeader:{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { color: colors.accent, fontFamily: fonts.bold, fontSize: 20, fontWeight: '700' },
  fieldLabel: { color: colors.gray700, fontFamily: fonts.semibold, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  helperText: { color: colors.gray400, fontFamily: fonts.regular, fontSize: 12, marginBottom: 16, lineHeight: 18 },
  typeBtn:    { marginRight: 12, padding: 12, borderRadius: 16, borderWidth: 2, alignItems: 'center', width: 108 },
  typeBtnActive:  { borderColor: colors.primary500, backgroundColor: colors.primary50 },
  typeBtnInactive:{ borderColor: colors.gray200, backgroundColor: colors.gray50 },
  typeBtnText:{ fontSize: 12, fontWeight: '700', textAlign: 'center' },
  typePill:   { marginTop: 4, alignSelf: 'flex-start', backgroundColor: colors.primary50, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  typePillText: { color: colors.primary600, fontSize: 12, fontWeight: '600' },
  cancelBtn:  { alignItems: 'center', paddingVertical: 12 },
  cancelBtnText: { color: colors.gray400, fontSize: 15, fontWeight: '600' },
  catalogEmpty: { alignItems: 'center', paddingVertical: 24 },
  catalogEmptyText: { color: colors.gray400, fontSize: 14, textAlign: 'center' },
  itemRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray50, borderRadius: 12, padding: 12, marginBottom: 10 },
  itemName:  { color: colors.gray900, fontWeight: '700', fontSize: 14 },
  itemDesc:  { color: colors.gray400, fontSize: 12, marginTop: 2 },
  itemPointsBadge: { backgroundColor: colors.primary100, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, marginRight: 8 },
  itemPointsText:  { color: colors.primary600, fontWeight: '700', fontSize: 12 },
  itemDelete: { padding: 4 },
  addBox:    { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.gray100, paddingTop: 16 },
});
