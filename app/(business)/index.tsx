import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';
import { supabase } from '../../src/lib/supabase';
import { Business, Campaign } from '../../src/types/database';

interface DashboardStats {
  totalClients: number;
  totalStampsToday: number;
  totalStampsMonth: number;
  totalRewardsRedeemed: number;
  activeCampaigns: number;
}

export default function BusinessDashboard() {
  const { profile } = useAuthStore();
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    totalStampsToday: 0,
    totalStampsMonth: 0,
    totalRewardsRedeemed: 0,
    activeCampaigns: 0,
  });
  const [recentStamps, setRecentStamps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    if (!profile) return;
    try {
      // Obtener negocio del dueño
      const { data: bizData } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', profile.id)
        .single();

      if (!bizData) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setBusiness(bizData);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      // Campañas activas
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('*')
        .eq('business_id', bizData.id)
        .order('created_at', { ascending: false });

      // Estadísticas de sellos
      const { count: todayStamps } = await supabase
        .from('stamps')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', bizData.id)
        .gte('created_at', today.toISOString());

      const { count: monthStamps } = await supabase
        .from('stamps')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', bizData.id)
        .gte('created_at', monthStart.toISOString());

      // Clientes únicos
      const { count: uniqueClients } = await supabase
        .from('loyalty_cards')
        .select('customer_id', { count: 'exact', head: true })
        .eq('business_id', bizData.id);

      // Premios canjeados
      const { count: redeemed } = await supabase
        .from('rewards')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', bizData.id)
        .eq('status', 'redeemed');

      // Últimos sellos
      const { data: stamps } = await supabase
        .from('stamps')
        .select(`
          id, created_at, points_added,
          profiles!stamps_customer_id_fkey (full_name),
          campaigns (name)
        `)
        .eq('business_id', bizData.id)
        .order('created_at', { ascending: false })
        .limit(8);

      if (campaignData) setCampaigns(campaignData);
      if (stamps) setRecentStamps(stamps);
      setStats({
        totalClients: uniqueClients ?? 0,
        totalStampsToday: todayStamps ?? 0,
        totalStampsMonth: monthStamps ?? 0,
        totalRewardsRedeemed: redeemed ?? 0,
        activeCampaigns: campaignData?.filter((c) => c.is_active).length ?? 0,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchDashboard(); }, [profile]));
  const onRefresh = () => { setRefreshing(true); fetchDashboard(); };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#6C3DF4" />
      </SafeAreaView>
    );
  }

  // Si no tiene negocio registrado → mostrar onboarding
  if (!business) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-6xl mb-4">🏪</Text>
          <Text className="text-gray-900 text-2xl font-bold text-center">
            Registra tu negocio
          </Text>
          <Text className="text-gray-400 text-base text-center mt-2 mb-8 leading-6">
            Para empezar a crear campañas y fidelizar clientes, primero configura los datos de tu negocio
          </Text>
          <TouchableOpacity
            className="bg-primary-500 px-8 py-4 rounded-2xl"
            onPress={() => router.push('/(business)/profile')}
          >
            <Text className="text-white font-bold text-lg">Configurar mi negocio</Text>
          </TouchableOpacity>
        </View>
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
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-gray-500 text-sm">Panel de control</Text>
              <Text className="text-gray-900 text-2xl font-bold mt-0.5">
                {business.name}
              </Text>
            </View>
            <View className="w-12 h-12 bg-primary-500 rounded-2xl items-center justify-center">
              <Text className="text-2xl">📊</Text>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View className="px-5 py-4">
          <View className="flex-row gap-3 mb-3">
            <StatCard
              emoji="👥"
              value={stats.totalClients}
              label="Clientes"
              color="#6C3DF4"
            />
            <StatCard
              emoji="✅"
              value={stats.totalStampsToday}
              label="Sellos hoy"
              color="#10B981"
            />
          </View>
          <View className="flex-row gap-3 mb-3">
            <StatCard
              emoji="📅"
              value={stats.totalStampsMonth}
              label="Sellos este mes"
              color="#F59E0B"
            />
            <StatCard
              emoji="🎁"
              value={stats.totalRewardsRedeemed}
              label="Premios canjeados"
              color="#EC4899"
            />
          </View>
        </View>

        {/* Acceso rápido al escáner */}
        <View className="px-5 mb-4">
          <TouchableOpacity
            className="bg-primary-500 rounded-2xl p-5 flex-row items-center shadow-lg"
            onPress={() => router.push('/(business)/scanner')}
            style={{ elevation: 4 }}
          >
            <View className="w-14 h-14 bg-white/20 rounded-2xl items-center justify-center mr-4">
              <Text className="text-3xl">📷</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white font-bold text-lg">Escanear cliente</Text>
              <Text className="text-white/70 text-sm mt-0.5">
                Escanea el QR y añade un sello al instante
              </Text>
            </View>
            <Text className="text-white text-2xl">›</Text>
          </TouchableOpacity>
        </View>

        {/* Campañas activas */}
        <View className="px-5 mb-2">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-gray-900 font-bold text-base">
              🎯 Mis campañas ({stats.activeCampaigns} activas)
            </Text>
            <TouchableOpacity onPress={() => router.push('/(business)/campaigns')}>
              <Text className="text-primary-500 text-sm font-semibold">Ver todas</Text>
            </TouchableOpacity>
          </View>
          {campaigns.filter((c) => c.is_active).slice(0, 3).map((campaign) => (
            <View key={campaign.id} className="bg-white rounded-2xl p-4 mb-3 shadow-sm" style={{ elevation: 2 }}>
              <View className="flex-row items-center">
                <View className="w-10 h-10 bg-primary-100 rounded-xl items-center justify-center mr-3">
                  <Text className="text-xl">
                    {campaign.type === 'punch_card' ? '🥊' :
                     campaign.type === 'points' ? '⭐' :
                     campaign.type === 'birthday' ? '🎂' : '🎯'}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-gray-800 font-semibold" numberOfLines={1}>{campaign.name}</Text>
                  <Text className="text-gray-400 text-xs">{campaign.total_redemptions} canjes</Text>
                </View>
                <View className="bg-green-100 rounded-full px-2 py-1">
                  <Text className="text-green-600 text-xs font-semibold">Activa</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Últimos sellos */}
        {recentStamps.length > 0 && (
          <View className="px-5 mb-6">
            <Text className="text-gray-900 font-bold text-base mb-3">
              🕐 Actividad reciente
            </Text>
            {recentStamps.map((stamp, index) => (
              <View key={stamp.id} className="flex-row items-center py-3 border-b border-gray-100">
                <View className="w-8 h-8 bg-primary-100 rounded-full items-center justify-center mr-3">
                  <Text className="text-sm">✓</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-gray-700 font-medium text-sm">
                    {(stamp as any).profiles?.full_name ?? 'Cliente'}
                  </Text>
                  <Text className="text-gray-400 text-xs">
                    {(stamp as any).campaigns?.name ?? 'Campaña'}
                  </Text>
                </View>
                <Text className="text-gray-300 text-xs">
                  {new Date(stamp.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  emoji, value, label, color,
}: { emoji: string; value: number; label: string; color: string }) {
  return (
    <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm" style={{ elevation: 2 }}>
      <View className="flex-row items-center mb-2">
        <View className="w-8 h-8 rounded-xl items-center justify-center mr-2" style={{ backgroundColor: `${color}20` }}>
          <Text className="text-base">{emoji}</Text>
        </View>
      </View>
      <Text className="text-gray-900 text-2xl font-bold">{value}</Text>
      <Text className="text-gray-400 text-xs">{label}</Text>
    </View>
  );
}
