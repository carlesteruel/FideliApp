import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';
import { supabase } from '../../src/lib/supabase';
import { PunchCard } from '../../src/components/PunchCard';
import { LoyaltyCardWithCampaign } from '../../src/types/database';

export default function CardsScreen() {
  const { user } = useAuthStore();
  const [cards, setCards] = useState<LoyaltyCardWithCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCards = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('loyalty_cards')
        .select(`
          *,
          campaigns (
            *,
            businesses (id, name, logo_url, city, category)
          )
        `)
        .eq('customer_id', user.id)
        .order('updated_at', { ascending: false });

      if (data) setCards(data as LoyaltyCardWithCampaign[]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Recargar al enfocar la pantalla (cuando vuelve del escáner)
  useFocusEffect(
    useCallback(() => {
      fetchCards();
    }, [user])
  );

  const onRefresh = () => { setRefreshing(true); fetchCards(); };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#6C3DF4" />
      </SafeAreaView>
    );
  }

  const activeCards = cards.filter((c) => !c.is_completed);
  const completedCards = cards.filter((c) => c.is_completed);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C3DF4" />}
      >
        {/* Header */}
        <View className="px-5 pt-4 pb-5 bg-white">
          <Text className="text-gray-900 text-2xl font-bold">Mis tarjetas 💳</Text>
          <Text className="text-gray-400 text-sm mt-1">
            {cards.length} tarjeta{cards.length !== 1 ? 's' : ''} activa{cards.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {cards.length === 0 ? (
          <View className="items-center py-16 px-8">
            <Text className="text-6xl mb-4">🃏</Text>
            <Text className="text-gray-700 font-bold text-xl text-center">
              Aún no tienes tarjetas
            </Text>
            <Text className="text-gray-400 text-sm text-center mt-2 leading-5">
              Visita un negocio para que te sellen tu primera tarjeta y empieces a acumular premios
            </Text>
          </View>
        ) : (
          <>
            {/* Tarjetas activas */}
            {activeCards.length > 0 && (
              <>
                <View className="px-5 pt-5 pb-3">
                  <Text className="text-gray-900 font-bold text-base">
                    En progreso ({activeCards.length})
                  </Text>
                </View>
                {activeCards.map((card) => (
                  <PunchCard key={card.id} card={card} />
                ))}
              </>
            )}

            {/* Tarjetas completadas (esperando canje) */}
            {completedCards.length > 0 && (
              <>
                <View className="px-5 pt-2 pb-3">
                  <Text className="text-secondary-500 font-bold text-base">
                    🎉 ¡Completadas! ({completedCards.length})
                  </Text>
                </View>
                {completedCards.map((card) => (
                  <PunchCard key={card.id} card={card} />
                ))}
              </>
            )}
          </>
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
