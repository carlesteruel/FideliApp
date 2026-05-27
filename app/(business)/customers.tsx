import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';
import { supabase } from '../../src/lib/supabase';

interface CustomerStat {
  customer_id: string;
  full_name: string;
  total_stamps: number;
  last_visit: string;
  times_completed: number;
}

export default function CustomersScreen() {
  const { profile } = useAuthStore();
  const [customers, setCustomers] = useState<CustomerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);

  const fetchCustomers = async () => {
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

      // Obtener tarjetas de fidelización con info del cliente
      const { data } = await supabase
        .from('loyalty_cards')
        .select(`
          customer_id,
          total_stamps_ever,
          times_completed,
          last_visit_at,
          profiles!loyalty_cards_customer_id_fkey (full_name, email)
        `)
        .eq('business_id', bId)
        .order('last_visit_at', { ascending: false });

      if (data) {
        // Agrupar por cliente (puede tener tarjetas en varias campañas)
        const customerMap = new Map<string, CustomerStat>();
        data.forEach((card: any) => {
          const existing = customerMap.get(card.customer_id);
          if (existing) {
            existing.total_stamps += card.total_stamps_ever;
            existing.times_completed += card.times_completed;
            if (card.last_visit_at > existing.last_visit) {
              existing.last_visit = card.last_visit_at;
            }
          } else {
            customerMap.set(card.customer_id, {
              customer_id: card.customer_id,
              full_name: card.profiles?.full_name ?? 'Cliente',
              total_stamps: card.total_stamps_ever,
              last_visit: card.last_visit_at ?? '',
              times_completed: card.times_completed,
            });
          }
        });
        setCustomers(Array.from(customerMap.values()));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchCustomers(); }, [profile]));
  const onRefresh = () => { setRefreshing(true); fetchCustomers(); };

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
        <View className="px-5 pt-4 pb-5 bg-white">
          <Text className="text-gray-900 text-2xl font-bold">Clientes 👥</Text>
          <Text className="text-gray-400 text-sm mt-1">
            {customers.length} cliente{customers.length !== 1 ? 's' : ''} fidelizados
          </Text>
        </View>

        {customers.length === 0 ? (
          <View className="items-center py-16 px-8">
            <Text className="text-6xl mb-4">👥</Text>
            <Text className="text-gray-700 font-bold text-xl text-center">
              Aún no tienes clientes
            </Text>
            <Text className="text-gray-400 text-sm text-center mt-2">
              Empieza a escanear QRs para que los clientes aparezcan aquí
            </Text>
          </View>
        ) : (
          <View className="pt-4">
            {/* Top clientes */}
            <View className="px-5 mb-3">
              <Text className="text-gray-900 font-bold text-base">
                🏆 Clientes más fieles
              </Text>
            </View>
            {customers
              .sort((a, b) => b.total_stamps - a.total_stamps)
              .map((customer, index) => (
                <View key={customer.customer_id} className="mx-5 mb-3 bg-white rounded-2xl p-4 shadow-sm flex-row items-center" style={{ elevation: 2 }}>
                  <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                    index === 0 ? 'bg-yellow-100' : index === 1 ? 'bg-gray-100' : index === 2 ? 'bg-orange-100' : 'bg-primary-100'
                  }`}>
                    <Text className="text-lg font-bold">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : customer.full_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-900 font-semibold">{customer.full_name}</Text>
                    <Text className="text-gray-400 text-xs mt-0.5">
                      {customer.total_stamps} sellos · {customer.times_completed} premios canjeados
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-primary-500 font-bold text-base">{customer.total_stamps}</Text>
                    <Text className="text-gray-400 text-xs">sellos</Text>
                  </View>
                </View>
              ))}
          </View>
        )}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
