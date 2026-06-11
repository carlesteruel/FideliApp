// ══════════════════════════════════════════════════════════════
// Tema global — Personalidad "Local Cálido Premium"
// Paleta: naranja vibrante · beige cálido · negro azulado
// ══════════════════════════════════════════════════════════════
export const colors = {
  // ── Primary — Naranja vibrante, energético, confiable ────────
  primary50:   '#FFF4EE',
  primary100:  '#FFE3D1',
  primary200:  '#FFCBAA',
  primary500:  '#FF6B2B',
  primary600:  '#E5501A',
  primary700:  '#C23D0E',

  // ── Accent — Casi negro azulado (contraste máximo) ────────────
  accent:      '#1A1A2E',
  accentLight: '#2D2D4E',

  // ── Highlight — Ámbar dorado (puntos, estrellas) ─────────────
  highlight:    '#FFD166',
  highlight100: '#FFF5CC',
  highlight600: '#B8891A',

  // ── Surfaces (regla del 60%) ──────────────────────────────────
  surface:    '#FFFBF7',   // Blanco crema (no #FFFFFF puro)
  background: '#F5F0EB',   // Beige muy suave — el 60% de pantalla
  white:      '#FFFFFF',
  black:      '#000000',

  // ── Secondary (naranja dorado, 30%) ──────────────────────────
  secondary500: '#F4A33D',
  secondary600: '#D4891E',

  // ── Grays ─────────────────────────────────────────────────────
  gray50:  '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  // ── Semantic ──────────────────────────────────────────────────
  success500: '#22C55E',
  danger500:  '#EF4444',

  green100: '#DCFCE7',
  green500: '#22C55E',
  green600: '#16A34A',
  green700: '#15803D',

  blue50:  '#EFF6FF',
  blue600: '#2563EB',

  red50:   '#FEF2F2',
  red100:  '#FEE2E2',
  red400:  '#F87171',
  red500:  '#EF4444',
  red600:  '#DC2626',

  yellow400: '#FACC15',
};

export const radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  28,
  full: 999,
};

export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
};

/**
 * Familia tipográfica Poppins — cargada en app/_layout.tsx con expo-google-fonts.
 * Fallback automático a la fuente del sistema si aún no está cargada.
 */
export const fonts = {
  regular:   'Poppins_400Regular',
  semibold:  'Poppins_600SemiBold',
  bold:      'Poppins_700Bold',
  extrabold: 'Poppins_800ExtraBold',
};
