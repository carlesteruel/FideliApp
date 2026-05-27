import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore';
import { supabase } from '../../src/lib/supabase';
import { Business, BusinessCategory } from '../../src/types/database';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';

const CATEGORIES: { id: BusinessCategory; emoji: string; label: string }[] = [
  { id: 'cafe', emoji: '☕', label: 'Cafetería' },
  { id: 'restaurant', emoji: '🍽️', label: 'Restaurante' },
  { id: 'bar', emoji: '🍺', label: 'Bar' },
  { id: 'bakery', emoji: '🥐', label: 'Panadería' },
  { id: 'fast_food', emoji: '🍔', label: 'Fast Food' },
  { id: 'pizza', emoji: '🍕', label: 'Pizzería' },
  { id: 'sushi', emoji: '🍱', label: 'Sushi' },
  { id: 'other', emoji: '🏪', label: 'Otro' },
];

export default function BusinessProfileScreen() {
  const { profile, signOut } = useAuthStore();
  const [business, setBusiness] = useState<Business | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<BusinessCategory>('cafe');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');

  const fetchBusiness = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', profile.id)
      .single();
    if (data) {
      const biz = data as Business;
      setBusiness(biz);
      setName(biz.name);
      setDescription(biz.description ?? '');
      setCategory(biz.category);
      setAddress(biz.address ?? '');
      setCity(biz.city ?? '');
      setPhone(biz.phone ?? '');
    } else {
      setIsEditing(true); // No tiene negocio → modo creación
    }
  };

  useFocusEffect(useCallback(() => { fetchBusiness(); }, [profile]));

  const handleSave = async () => {
    if (!name.trim() || !profile) return;
    setSaving(true);
    try {
      if (business) {
        // Actualizar
        const { error } = await supabase
          .from('businesses')
          .update({ name: name.trim(), description: description.trim() || null, category, address: address.trim() || null, city: city.trim() || null, phone: phone.trim() || null })
          .eq('id', business.id);
        if (error) throw error;
      } else {
        // Crear nuevo negocio
        const { error } = await supabase.from('businesses').insert({
          owner_id: profile.id,
          name: name.trim(),
          description: description.trim() || null,
          category,
          address: address.trim() || null,
          city: city.trim() || null,
          phone: phone.trim() || null,
        });
        if (error) throw error;
      }
      await fetchBusiness();
      setIsEditing(false);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-5 pt-4 pb-5 bg-white flex-row items-center justify-between">
          <Text className="text-gray-900 text-2xl font-bold">Mi negocio 🏪</Text>
          {business && !isEditing && (
            <TouchableOpacity
              className="bg-primary-50 rounded-xl px-4 py-2"
              onPress={() => setIsEditing(true)}
            >
              <Text className="text-primary-500 font-semibold text-sm">✏️ Editar</Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="px-5 pt-4">
          {/* Vista de solo lectura */}
          {business && !isEditing && (
            <View>
              <View className="bg-white rounded-2xl p-5 shadow-sm mb-4" style={{ elevation: 2 }}>
                <View className="flex-row items-center mb-4">
                  <View className="w-16 h-16 bg-primary-500 rounded-2xl items-center justify-center mr-4">
                    <Text className="text-3xl">
                      {CATEGORIES.find((c) => c.id === business.category)?.emoji ?? '🏪'}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-900 text-xl font-bold">{business.name}</Text>
                    <Text className="text-gray-500 text-sm mt-0.5">
                      {CATEGORIES.find((c) => c.id === business.category)?.label}
                    </Text>
                  </View>
                </View>

                {business.description && (
                  <Text className="text-gray-600 text-sm mb-3 leading-5">{business.description}</Text>
                )}

                <View className="flex-row flex-wrap gap-2">
                  {business.city && (
                    <View className="flex-row items-center bg-gray-100 rounded-full px-3 py-1">
                      <Text className="text-gray-600 text-xs">📍 {business.city}</Text>
                    </View>
                  )}
                  {business.phone && (
                    <View className="flex-row items-center bg-gray-100 rounded-full px-3 py-1">
                      <Text className="text-gray-600 text-xs">📞 {business.phone}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Estado */}
              <View className="bg-white rounded-2xl px-5 py-4 shadow-sm mb-4" style={{ elevation: 2 }}>
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-gray-800 font-semibold">Negocio activo</Text>
                    <Text className="text-gray-400 text-xs mt-0.5">
                      Visible para los clientes en la app
                    </Text>
                  </View>
                  <Switch
                    value={business.is_active}
                    onValueChange={async (val) => {
                      await supabase.from('businesses').update({ is_active: val }).eq('id', business.id);
                      fetchBusiness();
                    }}
                    trackColor={{ false: '#E5E7EB', true: '#DDD6FE' }}
                    thumbColor={business.is_active ? '#6C3DF4' : '#9CA3AF'}
                  />
                </View>
              </View>

              {/* Cuenta */}
              <View className="bg-white rounded-2xl overflow-hidden shadow-sm mb-4" style={{ elevation: 2 }}>
                <View className="px-5 py-3 border-b border-gray-50">
                  <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider">Cuenta</Text>
                </View>
                <View className="px-5 py-4 border-b border-gray-50">
                  <Text className="text-gray-500 text-xs">Propietario</Text>
                  <Text className="text-gray-800 font-semibold mt-0.5">{profile?.full_name}</Text>
                </View>
                <View className="px-5 py-4">
                  <Text className="text-gray-500 text-xs">Email</Text>
                  <Text className="text-gray-800 font-semibold mt-0.5">{profile?.email}</Text>
                </View>
              </View>

              <TouchableOpacity
                className="bg-white rounded-2xl px-5 py-4 shadow-sm flex-row items-center mb-6"
                onPress={handleSignOut}
                style={{ elevation: 2 }}
              >
                <View className="w-10 h-10 bg-red-100 rounded-2xl items-center justify-center mr-3">
                  <Text className="text-xl">🚪</Text>
                </View>
                <Text className="text-red-500 font-semibold flex-1">Cerrar sesión</Text>
                <Text className="text-gray-300 text-lg">›</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Formulario de edición / creación */}
          {isEditing && (
            <View>
              <Text className="text-gray-900 font-bold text-lg mb-4">
                {business ? 'Editar negocio' : 'Configura tu negocio'}
              </Text>

              {/* Categoría */}
              <Text className="text-gray-700 text-sm font-semibold mb-2">Categoría</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setCategory(cat.id)}
                    className={`mr-3 px-3 py-2.5 rounded-xl border-2 items-center flex-row ${category === cat.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-gray-50'}`}
                  >
                    <Text className="text-lg mr-1">{cat.emoji}</Text>
                    <Text className={`text-xs font-semibold ${category === cat.id ? 'text-primary-600' : 'text-gray-600'}`}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Input label="Nombre del negocio *" placeholder="Café Central" value={name} onChangeText={setName} />
              <Input label="Descripción" placeholder="El mejor café del barrio" value={description} onChangeText={setDescription} />
              <Input label="Ciudad" placeholder="Barcelona" value={city} onChangeText={setCity} />
              <Input label="Dirección" placeholder="Calle Mayor 1" value={address} onChangeText={setAddress} />
              <Input label="Teléfono" placeholder="+34 600 000 000" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />

              <View className="flex-row gap-3 mb-6">
                {business && (
                  <Button title="Cancelar" variant="outline" onPress={() => setIsEditing(false)} />
                )}
                <View className="flex-1">
                  <Button title={business ? 'Guardar cambios' : 'Crear negocio'} onPress={handleSave} loading={saving} size="lg" />
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
