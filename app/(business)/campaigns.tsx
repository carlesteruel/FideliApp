import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Switch,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';
import { supabase } from '../../src/lib/supabase';
import { Campaign, CampaignType } from '../../src/types/database';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';

const CAMPAIGN_TYPES = [
  { id: 'punch_card', emoji: '☕', label: 'Tarjeta de sellos', desc: 'X sellos → premio gratis' },
  { id: 'points', emoji: '⭐', label: 'Sistema de puntos', desc: 'Acumula puntos por €' },
  { id: 'birthday', emoji: '🎂', label: 'Regalo cumpleaños', desc: 'Premio en el día especial' },
  { id: 'streak', emoji: '🔥', label: 'Racha de visitas', desc: 'Premia la fidelidad' },
];

export default function CampaignsScreen() {
  const { profile } = useAuthStore();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [formType, setFormType] = useState<CampaignType>('punch_card');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formReward, setFormReward] = useState('');
  const [formStamps, setFormStamps] = useState('10');
  const [formPointsPerEuro, setFormPointsPerEuro] = useState('10');
  const [formPointsToReward, setFormPointsToReward] = useState('500');
  const [formSaving, setFormSaving] = useState(false);

  const fetchData = async () => {
    if (!profile) return;
    try {
      const { data: bizData } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', profile.id)
        .single();

      if (!bizData) { setLoading(false); setRefreshing(false); return; }
      const bId = (bizData as any).id;
      setBusinessId(bId);

      const { data } = await supabase
        .from('campaigns')
        .select('*')
        .eq('business_id', bId)
        .order('created_at', { ascending: false });

      if (data) setCampaigns(data as Campaign[]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, [profile]));
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const toggleCampaign = async (campaign: Campaign) => {
    const { error } = await supabase
      .from('campaigns')
      .update({ is_active: !campaign.is_active })
      .eq('id', campaign.id);
    if (!error) fetchData();
  };

  const deleteCampaign = (campaign: Campaign) => {
    Alert.alert(
      'Eliminar campaña',
      `¿Seguro que quieres eliminar "${campaign.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('campaigns').delete().eq('id', campaign.id);
            fetchData();
          },
        },
      ]
    );
  };

  const handleCreateCampaign = async () => {
    if (!formName.trim() || !formReward.trim() || !businessId) return;
    setFormSaving(true);

    let config: Record<string, any> = {};
    if (formType === 'punch_card') {
      config = { total_stamps: parseInt(formStamps, 10) || 10, reward: formReward };
    } else if (formType === 'points') {
      config = {
        points_per_euro: parseInt(formPointsPerEuro, 10) || 10,
        points_to_reward: parseInt(formPointsToReward, 10) || 500,
        reward: formReward,
      };
    } else if (formType === 'birthday') {
      config = { reward: formReward, days_window: 7 };
    } else if (formType === 'streak') {
      config = { visits_required: 5, period_days: 7, reward: formReward };
    }

    const { error } = await supabase.from('campaigns').insert({
      business_id: businessId,
      name: formName.trim(),
      description: formDescription.trim() || null,
      type: formType,
      config,
      reward_description: formReward.trim(),
      is_active: true,
    });

    setFormSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setShowModal(false);
    resetForm();
    fetchData();
  };

  const resetForm = () => {
    setFormName(''); setFormDescription(''); setFormReward('');
    setFormStamps('10'); setFormPointsPerEuro('10');
    setFormPointsToReward('500'); setFormType('punch_card');
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#6C3DF4" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C3DF4" />}
      >
        {/* Header */}
        <View className="px-5 pt-4 pb-5 bg-white flex-row items-center justify-between">
          <View>
            <Text className="text-gray-900 text-2xl font-bold">Campañas 🎯</Text>
            <Text className="text-gray-400 text-sm mt-1">
              {campaigns.filter((c) => c.is_active).length} activas · {campaigns.length} total
            </Text>
          </View>
          <TouchableOpacity
            className="bg-primary-500 rounded-2xl px-4 py-2.5"
            onPress={() => setShowModal(true)}
          >
            <Text className="text-white font-bold text-sm">+ Nueva</Text>
          </TouchableOpacity>
        </View>

        {campaigns.length === 0 ? (
          <View className="items-center py-16 px-8">
            <Text className="text-6xl mb-4">🎯</Text>
            <Text className="text-gray-700 font-bold text-xl text-center">
              Crea tu primera campaña
            </Text>
            <Text className="text-gray-400 text-sm text-center mt-2 mb-6">
              Las campañas te permiten fidelizar clientes y premiar su lealtad
            </Text>
            <Button title="Crear campaña" onPress={() => setShowModal(true)} size="lg" />
          </View>
        ) : (
          <View className="pt-4">
            {campaigns.map((campaign) => (
              <View key={campaign.id} className="mx-5 mb-4 bg-white rounded-2xl overflow-hidden shadow-sm" style={{ elevation: 2 }}>
                <View className={`h-1.5 ${campaign.is_active ? 'bg-primary-500' : 'bg-gray-200'}`} />
                <View className="p-4">
                  <View className="flex-row items-start">
                    <View className="w-12 h-12 bg-primary-100 rounded-xl items-center justify-center mr-3">
                      <Text className="text-2xl">
                        {campaign.type === 'punch_card' ? '☕' :
                         campaign.type === 'points' ? '⭐' :
                         campaign.type === 'birthday' ? '🎂' : '🔥'}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-gray-900 font-bold text-base">{campaign.name}</Text>
                      <Text className="text-gray-400 text-xs mt-0.5">
                        {campaign.type === 'punch_card' ? '🥊 Tarjeta de sellos' :
                         campaign.type === 'points' ? '⭐ Puntos' :
                         campaign.type === 'birthday' ? '🎂 Cumpleaños' : '🔥 Racha'}
                        {' · '}{campaign.total_redemptions} canjes
                      </Text>
                    </View>
                    <Switch
                      value={campaign.is_active}
                      onValueChange={() => toggleCampaign(campaign)}
                      trackColor={{ false: '#E5E7EB', true: '#DDD6FE' }}
                      thumbColor={campaign.is_active ? '#6C3DF4' : '#9CA3AF'}
                    />
                  </View>

                  <View className="flex-row items-center bg-gray-50 rounded-xl px-3 py-2 mt-3">
                    <Text className="text-base mr-2">🎁</Text>
                    <Text className="text-gray-600 text-sm flex-1">{campaign.reward_description}</Text>
                  </View>

                  {campaign.type === 'punch_card' && (
                    <Text className="text-gray-400 text-xs mt-2">
                      {(campaign.config as any)?.total_stamps ?? 10} sellos necesarios
                    </Text>
                  )}

                  <TouchableOpacity
                    className="mt-3 self-end"
                    onPress={() => deleteCampaign(campaign)}
                  >
                    <Text className="text-red-400 text-xs font-medium">Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
        <View className="h-8" />
      </ScrollView>

      {/* Modal: Crear campaña */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl px-5 pt-5 pb-10 max-h-5/6">
            <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center mb-4" />
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-gray-900 text-xl font-bold">Nueva campaña</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                <Text className="text-gray-400 text-lg">✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Tipo de campaña */}
              <Text className="text-gray-700 text-sm font-semibold mb-2">Tipo de campaña</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                {CAMPAIGN_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    onPress={() => setFormType(type.id as CampaignType)}
                    className={`mr-3 p-3 rounded-2xl border-2 items-center w-28 ${formType === type.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-gray-50'}`}
                  >
                    <Text className="text-2xl mb-1">{type.emoji}</Text>
                    <Text className={`text-xs font-bold text-center ${formType === type.id ? 'text-primary-600' : 'text-gray-600'}`}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Input label="Nombre de la campaña *" placeholder="10 cafés, el siguiente gratis" value={formName} onChangeText={setFormName} />
              <Input label="Descripción (opcional)" placeholder="Detalla tu campaña..." value={formDescription} onChangeText={setFormDescription} />
              <Input label="Premio al completar *" placeholder="1 café gratis de cualquier tipo" value={formReward} onChangeText={setFormReward} />

              {formType === 'punch_card' && (
                <Input
                  label="Número de sellos necesarios"
                  placeholder="10"
                  keyboardType="number-pad"
                  value={formStamps}
                  onChangeText={setFormStamps}
                />
              )}

              {formType === 'points' && (
                <>
                  <Input label="Puntos por cada €" placeholder="10" keyboardType="number-pad" value={formPointsPerEuro} onChangeText={setFormPointsPerEuro} />
                  <Input label="Puntos necesarios para el premio" placeholder="500" keyboardType="number-pad" value={formPointsToReward} onChangeText={setFormPointsToReward} />
                </>
              )}

              <Button
                title="Crear campaña"
                onPress={handleCreateCampaign}
                loading={formSaving}
                size="lg"
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
