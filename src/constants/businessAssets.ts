// ============================================================
// Recursos visuales por categoría de negocio
// Imágenes de Unsplash (libres de uso, sin autenticación)
// Prioridad: cover_url del negocio  >  imagen por defecto de categoría
// ============================================================

/** Imagen de portada por defecto según el tipo de negocio */
export const CATEGORY_DEFAULT_COVERS: Record<string, string> = {
  cafe:       'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900&q=80&auto=format&fit=crop',
  restaurant: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&q=80&auto=format&fit=crop',
  bar:        'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=900&q=80&auto=format&fit=crop',
  bakery:     'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=900&q=80&auto=format&fit=crop',
  fast_food:  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=900&q=80&auto=format&fit=crop',
  pizza:      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=900&q=80&auto=format&fit=crop',
  sushi:      'https://images.unsplash.com/photo-1553621042-f6e147245754?w=900&q=80&auto=format&fit=crop',
  other:      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&q=80&auto=format&fit=crop',
};

/** Colores corporativos por categoría */
export const CATEGORY_COLORS: Record<string, string> = {
  cafe:       '#6C3DF4',
  restaurant: '#EF4444',
  bar:        '#F59E0B',
  bakery:     '#EC4899',
  fast_food:  '#F97316',
  pizza:      '#10B981',
  sushi:      '#3B82F6',
  other:      '#6B7280',
};

/** Emoji representativo por categoría */
export const CATEGORY_EMOJI: Record<string, string> = {
  cafe:       '☕',
  restaurant: '🍽️',
  bar:        '🍺',
  bakery:     '🥐',
  pizza:      '🍕',
  sushi:      '🍱',
  fast_food:  '🍔',
  other:      '🏪',
};

/** Etiqueta legible por categoría */
export const CATEGORY_LABEL: Record<string, string> = {
  cafe:       'Cafetería',
  restaurant: 'Restaurante',
  bar:        'Bar',
  bakery:     'Panadería',
  pizza:      'Pizzería',
  sushi:      'Sushi',
  fast_food:  'Fast food',
  other:      'Negocio',
};

/** Devuelve la URL de portada: personalizada o por defecto de categoría */
export function getCoverSource(coverUrl: string | null | undefined, category: string): string {
  return coverUrl ?? CATEGORY_DEFAULT_COVERS[category] ?? CATEGORY_DEFAULT_COVERS.other;
}
