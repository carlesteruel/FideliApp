import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/useAuthStore';
import { supabase } from '../../src/lib/supabase';
import { Business, CampaignWithBusiness } from '../../src/types/database';

const CATEGORY_FILTERS = [
  { id: 'all', label: '🌟 Todos' },
  { id: 'cafe', label: '☕ Cafés' },
  { id: 'restaurant', label: '🍽️ Restaurantes' },
  { id: 'bar', label: '🍺 Bares' },
  { id: 'bakery', label: '🥐 Panaderías' },
  { id: 'pizza', label: '🍕 Pizzerías' },
  { id: 'fast_food', label: '🍔 Fast food' },
];

export default function HomeScreen() {
  const { profile } = useAuthStore();
  const [campaigns, setCampaigns] = useState<CampaignWithBusiness[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  const fetchData = async () => {
    try {
      // Obtener campañas activas con datos del negocio
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select(`
          *,
          businesses (id, name, logo_url, city, category)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20);

      // Obtener negocios destacados
      const { data: businessData } = await supabase
        .from('businesses')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (campaignData) setCampaigns(campaignData as CampaignWithBusiness[]);
      if (businessData) setBusinesses(businessData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const filteredCampaigns = activeFilter === 'all'
    ? campaigns
    : campaigns.filter((c) => c.businesses.category === activeFilter);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '🌅 Buenos días';
    if (hour < 20) return '☀️ Buenas tardes';
    return '🌙 Buenas noches';
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
        <View className="px-5 pt-4 pb-5 bg-white">
          <Text className="text-gray-500 text-sm">{greeting()}</Text>
          <Text className="text-gray-900 text-2xl font-bold mt-0.5">
            {profile?.full_name?.split(' ')[0]} 👋
          </Text>
          <Text className="text-gray-400 text-sm mt-1">
            Descubre campañas y acumula premios
          </Text>
        </View>

        {/* Stats rápidas */}
        <View className="px-5 py-4 flex-row gap-3">
          <View className="flex-1 bg-primary-500 rounded-2xl p-4">
            <Text className="text-white/70 text-xs font-medium">Negocios</Text>
            <Text className="text-white text-2xl font-bold">{businesses.length}</Text>
            <Text className="text-white/70 text-xs">participantes</Text>
          </View>
          <View className="flex-1 bg-secondary-500 rounded-2xl p-4">
            <Text className="text-white/70 text-xs font-medium">Campañas</Text>
            <Text className="text-white text-2xl font-bold">{campaigns.length}</Text>
            <Text className="text-white/70 text-xs">activas ahora</Text>
          </View>
        </View>

        {/* Filtros de categoría */}
        <View className="mb-2">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            {CATEGORY_FILTERS.map((filter) => (
              <TouchableOpacity
                key={filter.id}
                onPress={() => setActiveFilter(filter.id)}
                className={`
                  px-4 py-2.5 rounded-full border
                  ${activeFilter === filter.id
                    ? 'bg-primary-500 border-primary-500'
                    : 'bg-white border-gray-200'}
                `}
              >
                <Text className={`text-sm font-semibold ${activeFilter === filter.id ? 'text-white' : 'text-gray-600'}`}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Campañas destacadas */}
        <View className="px-5 mt-4">
          <Text className="text-gray-900 text-lg font-bold mb-4">
            🔥 Campañas activas
          </Text>
        </View>

        {filteredCampaigns.length === 0 ? (
          <View className="items-center py-12 px-8">
            <Text className="text-5xl mb-4">🔍</Text>
            <Text className="text-gray-700 font-bold text-lg text-center">
              No hay campañas en esta categoría
            </Text>
            <Text className="text-gray-400 text-sm text-center mt-2">
              Prueba con otra categoría
            </Text>
          </View>
        ) : (
          filteredCampaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}

function CampaignCard({ campaign }: { campaign: CampaignWithBusiness }) {
  const business = campaign.businesses;
  const config = campaign.config as { total_stamps?: number };

  const CATEGORY_COLORS: Record<string, string> = {
    cafe: '#6C3DF4', restaurant: '#EF4444', bar: '#F59E0B',
    bakery: '#EC4899', fast_food: '#F97316', pizza: '#10B981',
    sushi: '#3B82F6', other: '#6B7280',
  };
  const cardColor = CATEGORY_COLORS[business.category] ?? '#6C3DF4';

  return (
    <TouchableOpacity
      className="mx-5 mb-4 bg-white rounded-2xl overflow-hidden shadow-sm"
      activeOpacity={0.88}
      style={{ elevation: 3 }}
    >
      {/* Banda de color */}
      <View className="h-2" style={{ backgroundColor: cardColor }} />

      <View className="p-4">
        <View className="flex-row items-center mb-3">
          <View
            className="w-10 h-10 rounded-xl items-center justify-center mr-3"
            style={{ backgroundColor: `${cardColor}20` }}
          >
            <Text className="text-xl">
              {business.category === 'cafe' ? '☕' :
               business.category === 'restaurant' ? '🍽️' :
               business.category === 'bar' ? '🍺' :
               business.category === 'bakery' ? '🥐' :
               business.category === 'pizza' ? '🍕' :
               business.category === 'sushi' ? '🍱' :
               business.category === 'fast_food' ? '🍔' : '🏪'}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-gray-500 text-xs">{business.name}</Text>
            <Text className="text-gray-900 font-bold" numberOfLines={1}>{campaign.name}</Text>
          </View>
          <View className="bg-green-100 rounded-full px-2 py-1">
            <Text className="text-green-700 text-xs font-semibold">Activa</Text>
          </View>
        </View>

        {campaign.description && (
          <Text className="text-gray-500 text-sm mb-3" numberOfLines={2}>
            {campaign.description}
          </Text>
        )}

        <View className="flex-row items-center bg-gray-50 rounded-xl px-3 py-2">
          <Text className="text-xl mr-2">🎁</Text>
          <Text className="text-gray-700 text-sm font-medium flex-1" numberOfLines={1}>
            {campaign.reward_description}
          </Text>
          {config.total_stamps && (
            <Text className="text-gray-400 text-xs ml-2">
              {config.total_stamps} sellos
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
