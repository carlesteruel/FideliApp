import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { LoyaltyCardWithCampaign } from '../types/database';

interface PunchCardProps {
  card: LoyaltyCardWithCampaign;
  onPress?: () => void;
}

export function PunchCard({ card, onPress }: PunchCardProps) {
  const campaign = card.campaigns;
  const business = campaign.businesses;
  const config = campaign.config as { total_stamps: number; reward: string };
  const totalStamps = config.total_stamps ?? 10;
  const currentStamps = card.current_stamps;
  const percentage = Math.min((currentStamps / totalStamps) * 100, 100);

  // Calcular filas y columnas de los sellos
  const cols = totalStamps <= 5 ? totalStamps : Math.ceil(Math.sqrt(totalStamps));
  const rows = Math.ceil(totalStamps / cols);

  const CATEGORY_COLORS: Record<string, string> = {
    cafe: '#6C3DF4',
    restaurant: '#EF4444',
    bar: '#F59E0B',
    bakery: '#EC4899',
    fast_food: '#F97316',
    pizza: '#10B981',
    sushi: '#3B82F6',
    other: '#6B7280',
  };

  const cardColor = CATEGORY_COLORS[business.category] ?? '#6C3DF4';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.92}
      className="mx-4 mb-4 rounded-3xl overflow-hidden shadow-lg"
      style={{ elevation: 6 }}
    >
      {/* Header de la tarjeta */}
      <View
        className="px-5 pt-5 pb-4"
        style={{ backgroundColor: cardColor }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-white/70 text-xs font-medium uppercase tracking-wider">
              {business.name}
            </Text>
            <Text className="text-white text-xl font-bold mt-0.5" numberOfLines={1}>
              {campaign.name}
            </Text>
          </View>
          <View className="w-12 h-12 bg-white/20 rounded-2xl items-center justify-center">
            <Text className="text-2xl">
              {business.category === 'cafe' ? '☕' :
               business.category === 'restaurant' ? '🍽️' :
               business.category === 'bar' ? '🍺' :
               business.category === 'bakery' ? '🥐' :
               business.category === 'pizza' ? '🍕' :
               business.category === 'sushi' ? '🍱' :
               business.category === 'fast_food' ? '🍔' : '🏪'}
            </Text>
          </View>
        </View>

        {/* Barra de progreso */}
        <View className="bg-white/20 h-2 rounded-full overflow-hidden">
          <View
            className="h-full rounded-full bg-white"
            style={{ width: `${percentage}%` }}
          />
        </View>
        <Text className="text-white/80 text-xs mt-1.5 text-right">
          {currentStamps} / {totalStamps} sellos
        </Text>
      </View>

      {/* Grid de sellos */}
      <View className="bg-white px-5 py-5">
        <View className="flex-row flex-wrap gap-2 justify-center mb-4">
          {Array.from({ length: totalStamps }).map((_, index) => {
            const isFilled = index < currentStamps;
            return (
              <View
                key={index}
                className={`
                  w-10 h-10 rounded-full items-center justify-center
                  ${isFilled
                    ? 'shadow-sm'
                    : 'border-2 border-dashed border-gray-200'}
                `}
                style={isFilled ? { backgroundColor: cardColor } : {}}
              >
                {isFilled ? (
                  <Text className="text-white text-base">✓</Text>
                ) : (
                  <Text className="text-gray-300 text-xs">{index + 1}</Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Premio */}
        <View className="flex-row items-center bg-gray-50 rounded-2xl px-4 py-3">
          <Text className="text-2xl mr-3">🎁</Text>
          <View className="flex-1">
            <Text className="text-gray-400 text-xs font-medium">Premio al completar</Text>
            <Text className="text-gray-800 font-bold text-sm">
              {campaign.reward_description}
            </Text>
          </View>
          {card.times_completed > 0 && (
            <View className="bg-primary-100 rounded-full px-2 py-1">
              <Text className="text-primary-600 text-xs font-bold">
                x{card.times_completed} canjeado
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
