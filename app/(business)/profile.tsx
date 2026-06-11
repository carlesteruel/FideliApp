import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, Switch, StyleSheet,
  Image, ImageBackground, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore } from '../../src/store/useAuthStore';
import { supabase } from '../../src/lib/supabase';
import { Business, BusinessCategory } from '../../src/types/database';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { colors, fonts } from '../../src/theme';
import {
  CATEGORY_COLORS, CATEGORY_EMOJI, getCoverSource,
} from '../../src/constants/businessAssets';

// ── Constantes ──────────────────────────────────────────────
const CATEGORIES: { id: BusinessCategory; emoji: string; label: string }[] = [
  { id: 'cafe',       emoji: '☕',  label: 'Cafetería' },
  { id: 'restaurant', emoji: '🍽️', label: 'Restaurante' },
  { id: 'bar',        emoji: '🍺',  label: 'Bar' },
  { id: 'bakery',     emoji: '🥐',  label: 'Panadería' },
  { id: 'fast_food',  emoji: '🍔',  label: 'Fast Food' },
  { id: 'pizza',      emoji: '🍕',  label: 'Pizzería' },
  { id: 'sushi',      emoji: '🍱',  label: 'Sushi' },
  { id: 'other',      emoji: '🏪',  label: 'Otro' },
];

const PRESET_COLORS = [
  '#6C3DF4', '#4F46E5', '#3B82F6', '#0EA5E9',
  '#14B8A6', '#10B981', '#F59E0B', '#F97316',
  '#EF4444', '#F43F5E', '#EC4899', '#6B7280',
];

// ── Helper: sube una imagen al Storage de Supabase ──────────
async function uploadImage(
  ownerId: string,
  type: 'logo' | 'cover',
  uri: string,
): Promise<string | null> {
  try {
    const path = `${ownerId}/${type}.jpg`;
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const { error } = await supabase.storage
      .from('business-assets')
      .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('business-assets').getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
  } catch (e: any) {
    Alert.alert('Error al subir imagen', e.message ?? 'Error desconocido');
    return null;
  }
}

// ── Componente principal ─────────────────────────────────────
export default function BusinessProfileScreen() {
  const { profile, signOut } = useAuthStore();
  const [business,      setBusiness]      = useState<Business | null>(null);
  const [isEditing,     setIsEditing]     = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover,setUploadingCover]= useState(false);

  // Campos del formulario
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [category,    setCategory]    = useState<BusinessCategory>('cafe');
  const [address,     setAddress]     = useState('');
  const [city,        setCity]        = useState('');
  const [phone,       setPhone]       = useState('');

  // Personalización visual
  const [logoUri,   setLogoUri]   = useState<string | null>(null);
  const [coverUri,  setCoverUri]  = useState<string | null>(null);
  const [cardColor, setCardColor] = useState<string | null>(null);

  // ── Fetch del negocio ──────────────────────────────────────
  const fetchBusiness = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('businesses').select('*').eq('owner_id', profile.id).single();
    if (data) {
      const biz = data as Business;
      setBusiness(biz);
      setName(biz.name);
      setDescription(biz.description ?? '');
      setCategory(biz.category);
      setAddress(biz.address ?? '');
      setCity(biz.city ?? '');
      setPhone(biz.phone ?? '');
      setLogoUri(biz.logo_url);
      setCoverUri(biz.cover_url);
      setCardColor(biz.card_color);
    } else {
      setIsEditing(true);
    }
  };

  useFocusEffect(useCallback(() => { fetchBusiness(); }, [profile]));

  // ── Seleccionar logo ───────────────────────────────────────
  const pickLogo = async () => {
    if (!profile) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para subir el logo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingLogo(true);
    const url = await uploadImage(profile.id, 'logo', result.assets[0].uri);
    if (url) {
      setLogoUri(url);
      if (business) {
        await supabase.from('businesses').update({ logo_url: url }).eq('id', business.id);
        setBusiness({ ...business, logo_url: url });
      }
    }
    setUploadingLogo(false);
  };

  // ── Seleccionar imagen de fondo ────────────────────────────
  const pickCover = async () => {
    if (!profile) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para subir la imagen de fondo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingCover(true);
    const url = await uploadImage(profile.id, 'cover', result.assets[0].uri);
    if (url) {
      setCoverUri(url);
      setCardColor(null);
      if (business) {
        await supabase.from('businesses')
          .update({ cover_url: url, card_color: null }).eq('id', business.id);
        setBusiness({ ...business, cover_url: url, card_color: null });
      }
    }
    setUploadingCover(false);
  };

  // ── Eliminar imagen de fondo ───────────────────────────────
  const removeCover = async () => {
    setCoverUri(null);
    if (business) {
      await supabase.from('businesses').update({ cover_url: null }).eq('id', business.id);
      setBusiness({ ...business, cover_url: null });
    }
  };

  // ── Seleccionar color ──────────────────────────────────────
  const selectColor = async (color: string) => {
    const isSame   = cardColor === color;
    const newColor = isSame ? null : color;
    setCardColor(newColor);
    if (!isSame) setCoverUri(null);
    if (business) {
      await supabase.from('businesses')
        .update({ card_color: newColor, cover_url: isSame ? business.cover_url : null })
        .eq('id', business.id);
      setBusiness({ ...business, card_color: newColor, cover_url: isSame ? business.cover_url : null });
    }
  };

  // ── Guardar cambios del formulario ─────────────────────────
  const handleSave = async () => {
    if (!name.trim() || !profile) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(), description: description.trim() || null, category,
        address: address.trim() || null, city: city.trim() || null, phone: phone.trim() || null,
      };
      if (business) {
        const { error } = await supabase.from('businesses').update(payload).eq('id', business.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('businesses').insert({ owner_id: profile.id, ...payload });
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

  const effectiveColor = cardColor ?? CATEGORY_COLORS[category] ?? colors.primary500;

  // ── RENDER ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.screen}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cabecera premium con gradiente */}
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
              <Text style={s.headerSup}>Panel de</Text>
              <Text style={s.headerTitle}>Mi negocio</Text>
              {business && (
                <View style={s.headerPill}>
                  <Ionicons name="storefront" size={12} color={colors.white} style={{ marginRight: 4, opacity: 0.85 }} />
                  <Text style={s.headerPillText}>{business.name}</Text>
                </View>
              )}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 10 }}>
              <View style={s.headerIcon}>
                <Ionicons name="storefront" size={26} color="rgba(255,255,255,0.9)" />
              </View>
              {business && !isEditing && (
                <TouchableOpacity style={s.editBtn} onPress={() => setIsEditing(true)}>
                  <Ionicons name="pencil" size={13} color={colors.white} />
                  <Text style={s.editBtnText}>Editar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </LinearGradient>

        <View style={s.content}>
          {/* ── VISTA (no edición) ─────────────────────────── */}
          {business && !isEditing && (
            <>
              {/* Tarjeta de presentación */}
              <View style={[s.card, { elevation: 2 }]}>
                <View style={s.bizRow}>
                  {business.logo_url ? (
                    <Image source={{ uri: business.logo_url }} style={s.bizLogo} />
                  ) : (
                    <View style={[s.bizIcon, {
                      backgroundColor: business.card_color
                        ?? CATEGORY_COLORS[business.category]
                        ?? colors.primary500,
                    }]}>
                      <Text style={{ fontSize: 28 }}>
                        {CATEGORY_EMOJI[business.category] ?? '🏪'}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.bizName}>{business.name}</Text>
                    <Text style={s.bizCat}>
                      {CATEGORIES.find((c) => c.id === business.category)?.label}
                    </Text>
                    {(business.card_color || business.cover_url) && (
                      <View style={s.customBadge}>
                        <Text style={s.customBadgeText}>
                          {business.cover_url ? '📸 Foto personalizada' : '🎨 Color personalizado'}
                        </Text>
                      </View>
                    )}
                    {!business.card_color && !business.cover_url && (
                      <View style={[s.customBadge, { backgroundColor: colors.gray50 }]}>
                        <Text style={[s.customBadgeText, { color: colors.gray500 }]}>
                          🖼️ Foto de categoría por defecto
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                {business.description && (
                  <Text style={s.bizDesc}>{business.description}</Text>
                )}
                <View style={s.tagsRow}>
                  {business.city  && <View style={s.tag}><Text style={s.tagText}>📍 {business.city}</Text></View>}
                  {business.phone && <View style={s.tag}><Text style={s.tagText}>📞 {business.phone}</Text></View>}
                </View>
              </View>

              {/* Interruptor activo */}
              <View style={[s.card, { elevation: 2 }]}>
                <View style={s.switchRow}>
                  <View>
                    <Text style={s.switchLabel}>Negocio activo</Text>
                    <Text style={s.switchSub}>Visible para los clientes en la app</Text>
                  </View>
                  <Switch
                    value={business.is_active}
                    onValueChange={async (v) => {
                      await supabase.from('businesses').update({ is_active: v }).eq('id', business.id);
                      fetchBusiness();
                    }}
                    trackColor={{ false: colors.gray200, true: colors.primary100 }}
                    thumbColor={business.is_active ? colors.primary500 : colors.gray400}
                  />
                </View>
              </View>

              {/* Info de cuenta */}
              <View style={[s.card, { elevation: 2, padding: 0, overflow: 'hidden' }]}>
                <View style={s.accountHeader}><Text style={s.accountLabel}>CUENTA</Text></View>
                <View style={s.accountRow}>
                  <Text style={s.accountKey}>Propietario</Text>
                  <Text style={s.accountVal}>{profile?.full_name}</Text>
                </View>
                <View style={[s.accountRow, { borderBottomWidth: 0 }]}>
                  <Text style={s.accountKey}>Email</Text>
                  <Text style={s.accountVal}>{profile?.email}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[s.card, s.signOutRow, { elevation: 2 }]}
                onPress={handleSignOut}
              >
                <View style={s.signOutIcon}>
                  <Ionicons name="log-out-outline" size={20} color={colors.red500} />
                </View>
                <Text style={s.signOutText}>Cerrar sesión</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.gray300} />
              </TouchableOpacity>
            </>
          )}

          {/* ── FORMULARIO DE EDICIÓN ──────────────────────── */}
          {isEditing && (
            <View>
              <Text style={s.editTitle}>
                {business ? 'Editar negocio' : 'Configura tu negocio'}
              </Text>

              {/* ── Logo ─────────────────────────────────── */}
              <Text style={s.fieldLabel}>Logo del negocio</Text>
              <TouchableOpacity
                style={s.logoPickerArea}
                onPress={pickLogo}
                disabled={uploadingLogo}
                activeOpacity={0.85}
              >
                {uploadingLogo ? (
                  <ActivityIndicator color={colors.primary500} size="large" />
                ) : logoUri ? (
                  <>
                    <Image source={{ uri: logoUri }} style={s.logoBig} />
                    <View style={s.logoEditBadge}>
                      <Text style={{ color: colors.white, fontSize: 12, fontWeight: '600' }}>
                        ✏️ Cambiar logo
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={s.logoPlaceholder}>
                    <Text style={{ fontSize: 40, marginBottom: 8 }}>📷</Text>
                    <Text style={s.logoPlaceholderText}>Toca para subir tu logo</Text>
                    <Text style={s.logoPlaceholderSub}>JPG o PNG · máx. 5 MB · cuadrado</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* ── Categoría ────────────────────────────── */}
              <Text style={s.fieldLabel}>Categoría</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setCategory(cat.id)}
                    style={[
                      s.catBtn,
                      category === cat.id ? s.catBtnActive : s.catBtnInactive,
                    ]}
                  >
                    <Text style={{ fontSize: 18, marginRight: 4 }}>{cat.emoji}</Text>
                    <Text style={[
                      s.catBtnText,
                      { color: category === cat.id ? colors.primary600 : colors.gray600 },
                    ]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* ── Campos de texto ──────────────────────── */}
              <Input label="Nombre del negocio *" placeholder="Café Central" value={name} onChangeText={setName} />
              <Input label="Descripción" placeholder="El mejor café del barrio" value={description} onChangeText={setDescription} />
              <Input label="Ciudad" placeholder="Barcelona" value={city} onChangeText={setCity} />
              <Input label="Dirección" placeholder="Calle Mayor 1" value={address} onChangeText={setAddress} />
              <Input label="Teléfono" placeholder="+34 600 000 000" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />

              {/* ── Color de la tarjeta ──────────────────── */}
              <Text style={s.fieldLabel}>🎨 Color de la tarjeta</Text>
              <Text style={s.fieldSub}>Elige el color de acento (se aplica sobre la imagen)</Text>
              <View style={s.colorPalette}>
                {PRESET_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => selectColor(c)}
                    style={[s.colorCircle, { backgroundColor: c }, cardColor === c && s.colorCircleSelected]}
                  >
                    {cardColor === c && <Text style={s.colorCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── Imagen de fondo ──────────────────────── */}
              <Text style={[s.fieldLabel, { marginTop: 8 }]}>🖼️ Foto de portada personalizada</Text>
              <Text style={s.fieldSub}>
                Si no subes ninguna foto, se usará automáticamente una imagen bonita
                según la categoría ({CATEGORIES.find((c) => c.id === category)?.label ?? category})
              </Text>

              {coverUri ? (
                <View style={s.coverPreviewWrapper}>
                  <TouchableOpacity
                    style={s.coverPreview}
                    onPress={pickCover}
                    disabled={uploadingCover}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri: coverUri }} style={s.coverPreviewImg} resizeMode="cover" />
                    <View style={s.coverPreviewOverlay}>
                      {uploadingCover
                        ? <ActivityIndicator color={colors.white} />
                        : <Text style={s.coverPreviewText}>✏️ Cambiar imagen</Text>}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.coverRemoveBtn} onPress={removeCover}>
                    <Text style={s.coverRemoveText}>✕ Quitar foto personalizada (usar imagen por defecto)</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={s.coverPickerBtn}
                  onPress={pickCover}
                  disabled={uploadingCover}
                  activeOpacity={0.85}
                >
                  {uploadingCover
                    ? <ActivityIndicator color={colors.primary500} style={{ marginRight: 10 }} />
                    : <Text style={{ fontSize: 22, marginRight: 10 }}>📸</Text>}
                  <Text style={s.coverPickerText}>Subir mi propia foto de portada</Text>
                </TouchableOpacity>
              )}

              {/* ── Vista previa ─────────────────────────── */}
              <View style={s.previewSection}>
                <Text style={s.previewLabel}>👁️ Vista previa de tu tarjeta</Text>
                <CardPreview
                  name={name || 'Nombre del negocio'}
                  category={category}
                  categoryEmoji={CATEGORY_EMOJI[category] ?? '🏪'}
                  color={effectiveColor}
                  logoUri={logoUri}
                  coverUri={coverUri}
                />
              </View>

              {/* ── Botones ───────────────────────────────── */}
              <View style={s.formBtns}>
                {business && (
                  <Button title="Cancelar" variant="outline" onPress={() => setIsEditing(false)} />
                )}
                <View style={{ flex: 1 }}>
                  <Button
                    title={business ? 'Guardar cambios' : 'Crear negocio'}
                    onPress={handleSave}
                    loading={saving}
                    size="lg"
                  />
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Vista previa de la tarjeta ───────────────────────────────
function CardPreview({
  name, category, categoryEmoji, color, logoUri, coverUri,
}: {
  name: string;
  category: string;
  categoryEmoji: string;
  color: string;
  logoUri: string | null;
  coverUri: string | null;
}) {
  // Usa la portada personalizada o la imagen por defecto de categoría
  const imageUri = getCoverSource(coverUri, category);
  const isCustom = !!coverUri;

  const headerContent = (
    <View style={prev.headerInner}>
      {/* Tinte de color corporativo */}
      <View style={[prev.headerTint, { backgroundColor: `${color}55` }]} />
      <View style={prev.headerRow}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={prev.bizSub} numberOfLines={1}>Tu negocio</Text>
          <Text style={prev.bizName} numberOfLines={1}>{name}</Text>
        </View>
        {logoUri ? (
          <Image source={{ uri: logoUri }} style={prev.logo} />
        ) : (
          <View style={prev.emojiBox}>
            <Text style={{ fontSize: 20 }}>{categoryEmoji}</Text>
          </View>
        )}
      </View>
      <View style={prev.progressBg}>
        <View style={[prev.progressFill, { width: '40%' }]} />
      </View>
      <View style={prev.progressFooter}>
        <Text style={prev.progressText}>4 / 10 sellos</Text>
        {!isCustom && (
          <Text style={prev.defaultBadge}>Foto de categoría</Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={prev.card}>
      {/* Siempre muestra imagen: personalizada o defecto */}
      <ImageBackground
        source={{ uri: imageUri }}
        style={[prev.header, { backgroundColor: color }]}
        imageStyle={{ opacity: isCustom ? 0.55 : 0.45, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
        resizeMode="cover"
      >
        {headerContent}
      </ImageBackground>

      {/* Sellos de muestra */}
      <View style={prev.body}>
        <View style={prev.stampsGrid}>
          {Array.from({ length: 10 }).map((_, i) => (
            <View
              key={i}
              style={[
                prev.stamp,
                i < 4
                  ? { backgroundColor: color }
                  : { backgroundColor: `${color}22`, borderWidth: 1.5, borderColor: `${color}66` },
              ]}
            >
              {i < 4
                ? <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>
                : <Text style={{ color: '#aaa', fontSize: 8 }}>{i + 1}</Text>}
            </View>
          ))}
        </View>
        <View style={prev.rewardRow}>
          <Text style={{ fontSize: 14, marginRight: 6 }}>🎁</Text>
          <Text style={prev.rewardText} numberOfLines={1}>Premio al completar la tarjeta</Text>
        </View>
      </View>
    </View>
  );
}

// ── Estilos ──────────────────────────────────────────────────
const s = StyleSheet.create({
  screen:         { flex: 1, backgroundColor: colors.background },
  // ── Header premium ────────────────────────────────────────────
  header:         { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, overflow: 'hidden', position: 'relative' },
  headerCircle1:  { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', top: -60, right: -50 },
  headerCircle2:  { position: 'absolute', width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -40, left: 40 },
  headerInner:    { flexDirection: 'row', alignItems: 'center' },
  headerSup:      { color: 'rgba(255,255,255,0.70)', fontSize: 12, fontFamily: fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.8 },
  headerTitle:    { color: colors.white, fontSize: 24, fontFamily: fonts.bold, fontWeight: '700', marginTop: 4, marginBottom: 10 },
  headerPill:     { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
  headerPillText: { color: colors.white, fontSize: 12, fontFamily: fonts.semibold },
  headerIcon:     { width: 54, height: 54, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)' },
  title:     { color: colors.accent, fontSize: 24, fontFamily: fonts.bold, fontWeight: '700' },
  editBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  editBtnText: { color: colors.white, fontFamily: fonts.semibold, fontWeight: '600', fontSize: 13 },
  content:   { paddingHorizontal: 20, paddingTop: 16 },
  card:      { backgroundColor: colors.surface, borderRadius: 18, padding: 20, marginBottom: 16, shadowColor: colors.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 },

  // Vista (no edición)
  bizRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  bizLogo:   { width: 64, height: 64, borderRadius: 16, marginRight: 16 },
  bizIcon:   { width: 64, height: 64, backgroundColor: colors.primary500, borderRadius: 16,
                alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  bizName:   { color: colors.accent, fontFamily: fonts.bold, fontSize: 20, fontWeight: '700' },
  bizCat:    { color: colors.gray500, fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },
  customBadge:     { alignSelf: 'flex-start', backgroundColor: colors.primary50, borderRadius: 99,
                     paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  customBadgeText: { color: colors.primary600, fontSize: 11, fontWeight: '600' },
  bizDesc:   { color: colors.gray600, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  tagsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag:       { backgroundColor: colors.gray100, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4 },
  tagText:   { color: colors.gray600, fontSize: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { color: colors.accent, fontFamily: fonts.semibold, fontWeight: '600' },
  switchSub: { color: colors.gray400, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  accountHeader: { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  accountLabel:  { color: colors.gray400, fontFamily: fonts.semibold, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  accountRow:    { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  accountKey:    { color: colors.gray500, fontFamily: fonts.regular, fontSize: 12 },
  accountVal:    { color: colors.accent, fontFamily: fonts.semibold, fontWeight: '600', marginTop: 2 },
  signOutRow:    { flexDirection: 'row', alignItems: 'center' },
  signOutIcon:   { width: 40, height: 40, backgroundColor: colors.red100, borderRadius: 12,
                   alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  signOutText:   { color: colors.red500, fontFamily: fonts.semibold, fontWeight: '600', flex: 1 },

  // Formulario de edición
  editTitle: { color: colors.accent, fontFamily: fonts.bold, fontWeight: '700', fontSize: 18, marginBottom: 20 },
  fieldLabel:{ color: colors.gray700, fontFamily: fonts.semibold, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  fieldSub:  { color: colors.gray400, fontFamily: fonts.regular, fontSize: 12, marginBottom: 12 },
  catBtn:    { flexDirection: 'row', alignItems: 'center', marginRight: 12, paddingHorizontal: 12,
               paddingVertical: 10, borderRadius: 12, borderWidth: 2 },
  catBtnActive:  { borderColor: colors.primary500, backgroundColor: colors.primary50 },
  catBtnInactive:{ borderColor: colors.gray200, backgroundColor: colors.gray50 },
  catBtnText:{ fontSize: 12, fontWeight: '600' },

  // Logo picker
  logoPickerArea: { alignSelf: 'center', marginBottom: 20, alignItems: 'center', justifyContent: 'center',
                    width: 120, height: 120 },
  logoBig:        { width: 120, height: 120, borderRadius: 24, backgroundColor: colors.gray100 },
  logoEditBadge:  { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.55)',
                    paddingVertical: 6, alignItems: 'center', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  logoPlaceholder:{ width: 120, height: 120, borderRadius: 24, borderWidth: 2, borderColor: colors.gray200,
                    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: colors.gray50, padding: 8 },
  logoPlaceholderText: { color: colors.gray500, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  logoPlaceholderSub:  { color: colors.gray400, fontSize: 10, textAlign: 'center', marginTop: 2 },

  // Color palette
  colorPalette:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  colorCircle:         { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  colorCircleSelected: { borderWidth: 3, borderColor: colors.gray800 },
  colorCheck:          { color: colors.white, fontSize: 16, fontWeight: '700' },

  // Cover picker
  coverPickerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray50,
                    borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1.5,
                    borderColor: colors.gray200, borderStyle: 'dashed' },
  coverPickerText:{ color: colors.gray600, fontWeight: '600', fontSize: 14 },
  coverPreviewWrapper: { marginBottom: 16 },
  coverPreview:        { borderRadius: 14, overflow: 'hidden', height: 130 },
  coverPreviewImg:     { width: '100%', height: 130 },
  coverPreviewOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0,
                         backgroundColor: 'rgba(0,0,0,0.4)', paddingVertical: 8, alignItems: 'center' },
  coverPreviewText:    { color: colors.white, fontWeight: '600', fontSize: 13 },
  coverRemoveBtn:      { alignSelf: 'stretch', marginTop: 8, paddingHorizontal: 12, paddingVertical: 8,
                         backgroundColor: colors.gray50, borderRadius: 12 },
  coverRemoveText:     { color: colors.gray500, fontSize: 12, fontWeight: '500', textAlign: 'center' },

  // Preview section
  previewSection: { marginTop: 4, marginBottom: 20, backgroundColor: colors.gray100, borderRadius: 20, padding: 16 },
  previewLabel:   { color: colors.gray600, fontSize: 13, fontWeight: '600', marginBottom: 12, textAlign: 'center' },

  // Botones del formulario
  formBtns:  { flexDirection: 'row', gap: 12, marginBottom: 32 },
});

const prev = StyleSheet.create({
  card:          { borderRadius: 20, overflow: 'hidden', backgroundColor: colors.white, elevation: 4 },
  header:        { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  headerInner:   {},
  headerTint:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  headerRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  bizSub:        { color: 'rgba(255,255,255,0.80)', fontSize: 10, fontWeight: '600',
                   textTransform: 'uppercase', letterSpacing: 0.8 },
  bizName:       { color: colors.white, fontSize: 16, fontWeight: '700', marginTop: 1 },
  logo:          { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)' },
  emojiBox:      { width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.25)',
                   borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  progressBg:    { height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 99, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: colors.white, borderRadius: 99 },
  progressFooter:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  progressText:  { color: 'rgba(255,255,255,0.85)', fontSize: 10 },
  defaultBadge:  { color: 'rgba(255,255,255,0.65)', fontSize: 9, fontStyle: 'italic' },
  body:          { backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 12 },
  stampsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'center', marginBottom: 10 },
  stamp:         { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rewardRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray50,
                   borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  rewardText:    { color: colors.gray700, fontSize: 12, fontWeight: '500' },
});
