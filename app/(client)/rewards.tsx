import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';
import { supabase } from '../../src/lib/supabase';
import { RewardWithDetails } from '../../src/types/database';

export default function RewardsScreen() {
  const { user } = useAuthStore();
  const [rewards, setRewards] = useState<RewardWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'redeemed' | 'expired'>('pending');

  const fetchRewards = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('rewards')
        .select(`
          *,
          campaigns (id, name, type),
          businesses (id, name, logo_url)
        `)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (data) setRewards(data as RewardWithDetails[]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchRewards(); }, [user]));
  const onRefresh = () => { setRefreshing(true); fetchRewards(); };

  const filtered = rewards.filter((r) => r.status === activeTab);
  const pendingCount = rewards.filter((r) => r.status === 'pending').length;

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
          <Text className="text-gray-900 text-2xl font-bold">Mis premios 🎁</Text>
          {pendingCount > 0 && (
            <View className="flex-row items-center mt-2 bg-secondary-500/10 rounded-full px-3 py-1 self-start">
              <Text className="text-secondary-500 text-sm font-bold">
                🎉 {pendingCount} premio{pendingCount > 1 ? 's' : ''} por canjear
              </Text>
            </View>
          )}
        </View>

        {/* Tabs */}
        <View className="flex-row bg-white border-b border-gray-100 px-5">
          {(['pending', 'redeemed', 'expired'] as const).map((tab) => {
            const labels = { pending: 'Por canjear', redeemed: 'Canjeados', expired: 'Expirados' };
            const count = rewards.filter((r) => r.status === tab).length;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                className={`flex-1 py-3 items-center border-b-2 ${activeTab === tab ? 'border-primary-500' : 'border-transparent'}`}
              >
                <Text className={`text-sm font-semibold ${activeTab === tab ? 'text-primary-500' : 'text-gray-400'}`}>
                  {labels[tab]}
                  {count > 0 && ` (${count})`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View className="pt-4">
          {filtered.length === 0 ? (
            <View className="items-center py-16 px-8">
              <Text className="text-6xl mb-4">
                {activeTab === 'pending' ? '🎯' : activeTab === 'redeemed' ? '✅' : '⏰'}
              </Text>
              <Text className="text-gray-700 font-bold text-lg text-center">
                {activeTab === 'pending' ? 'No tienes premios pendientes' :
                 activeTab === 'redeemed' ? 'Aún no has canjeado premios' :
                 'No tienes premios expirados'}
              </Text>
              {activeTab === 'pending' && (
                <Text className="text-gray-400 text-sm text-center mt-2">
                  Completa tarjetas de sellos para ganar premios
                </Text>
              )}
            </View>
          ) : (
            filtered.map((reward) => (
              <RewardCard key={reward.id} reward={reward} onRefresh={fetchRewards} />
            ))
          )}
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}

function RewardCard({
  reward,
  onRefresh,
}: {
  reward: RewardWithDetails;
  onRefresh: () => void;
}) {
  const expiresAt = reward.expires_at ? new Date(reward.expires_at) : null;
  const daysLeft = expiresAt
    ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const isExpiringSoon = daysLeft !== null && daysLeft <= 3 && daysLeft > 0;

  return (
    <View className="mx-5 mb-4 bg-white rounded-2xl overflow-hidden shadow-sm" style={{ elevation: 3 }}>
      {reward.status === 'pending' && (
        <View className="h-1.5 bg-secondary-500" />
      )}
      {reward.status === 'redeemed' && (
        <View className="h-1.5 bg-green-500" />
      )}
      {reward.status === 'expired' && (
        <View className="h-1.5 bg-gray-300" />
      )}

      <View className="p-4">
        {/* Negocio y campaña */}
        <View className="flex-row items-center mb-3">
          <View className="w-10 h-10 bg-primary-100 rounded-xl items-center justify-center mr-3">
            <Text className="text-xl">🏪</Text>
          </View>
          <View className="flex-1">
            <Text className="text-gray-500 text-xs">{reward.businesses.name}</Text>
            <Text className="text-gray-800 font-semibold text-sm">{reward.campaigns.name}</Text>
          </View>
          <View className={`rounded-full px-3 py-1 ${
            reward.status === 'pending' ? 'bg-secondary-500/10' :
            reward.status === 'redeemed' ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            <Text className={`text-xs font-bold ${
              reward.status === 'pending' ? 'text-secondary-500' :
              reward.status === 'redeemed' ? 'text-green-600' : 'text-gray-400'
            }`}>
              {reward.status === 'pending' ? '⏳ Pendiente' :
               reward.status === 'redeemed' ? '✅ Canjeado' : '❌ Expirado'}
            </Text>
          </View>
        </View>

        {/* Descripción del premio */}
        <View className="bg-gray-50 rounded-xl px-4 py-3 mb-3">
          <Text className="text-gray-500 text-xs font-medium mb-0.5">🎁 Tu premio</Text>
          <Text className="text-gray-800 font-bold">{reward.description}</Text>
        </View>

        {/* Fechas */}
        {reward.status === 'pending' && expiresAt && (
          <View className={`flex-row items-center rounded-xl px-3 py-2 ${isExpiringSoon ? 'bg-red-50' : 'bg-blue-50'}`}>
            <Text className="text-base mr-2">{isExpiringSoon ? '⚠️' : '📅'}</Text>
            <Text className={`text-xs font-semibold ${isExpiringSoon ? 'text-red-600' : 'text-blue-600'}`}>
              {isExpiringSoon
                ? `¡Expira en ${daysLeft} día${daysLeft > 1 ? 's' : ''}!`
                : `Válido hasta ${expiresAt.toLocaleDateString('es-ES')}`}
            </Text>
          </View>
        )}

        {reward.status === 'redeemed' && reward.redeemed_at && (
          <Text className="text-gray-400 text-xs mt-1">
            Canjeado el {new Date(reward.redeemed_at).toLocaleDateString('es-ES')}
          </Text>
        )}

        {/* Info para canjear */}
        {reward.status === 'pending' && (
          <View className="mt-3 bg-primary-50 rounded-xl px-4 py-3">
            <Text className="text-primary-600 text-xs font-semibold text-center">
              💡 Muestra esta pantalla en el negocio para canjear tu premio
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
