import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Path, Circle, Ellipse, Rect, Line,
} from 'react-native-svg';
import { colors, fonts } from '../../theme';

// ═══════════════════════════════════════════════════════════
// Ilustraciones SVG inline — sin dependencias externas
// ═══════════════════════════════════════════════════════════

/** Fantasma simpático — sin premios pendientes */
function GhostSvg() {
  return (
    <Svg width="130" height="130" viewBox="0 0 130 130">
      {/* Sombra / halo */}
      <Ellipse cx="65" cy="115" rx="30" ry="8" fill="#F5F0EB" />
      {/* Cuerpo del fantasma */}
      <Path
        d="M25,60 Q25,22 65,22 Q105,22 105,60 L105,105 Q92,93 80,105 Q72,115 65,105 Q58,93 50,105 Q38,115 25,105 Z"
        fill="#FFFBF7"
        stroke="#FFE3D1"
        strokeWidth="2.5"
      />
      {/* Sombra interna sutil */}
      <Path
        d="M105,60 L105,90 Q92,78 80,90 Q72,100 65,90 Q58,78 50,90 Q38,100 25,90 L25,60"
        fill="none"
        stroke="#FFE3D1"
        strokeWidth="1"
        opacity="0.6"
      />
      {/* Ojo izquierdo */}
      <Ellipse cx="50" cy="65" rx="9" ry="11" fill="#1A1A2E" />
      {/* Ojo derecho */}
      <Ellipse cx="80" cy="65" rx="9" ry="11" fill="#1A1A2E" />
      {/* Brillo ojo izq */}
      <Circle cx="54" cy="60" r="3.5" fill="white" />
      {/* Brillo ojo der */}
      <Circle cx="84" cy="60" r="3.5" fill="white" />
      {/* Boca curiosa */}
      <Path
        d="M54,82 Q65,90 76,82"
        stroke="#1A1A2E"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Estrellas flotantes */}
      <Path d="M18,35 L19.5,30 L21,35 L26,35 L22,38 L23.5,43 L19.5,40 L15.5,43 L17,38 L13,35 Z" fill="#FFD166" opacity="0.8" />
      <Path d="M108,28 L109,24 L110,28 L114,28 L111,30.5 L112,34.5 L109,32 L106,34.5 L107,30.5 L104,28 Z" fill="#FF6B2B" opacity="0.7" />
      <Circle cx="112" cy="55" r="3" fill="#FFD166" opacity="0.6" />
      <Circle cx="18" cy="55" r="2" fill="#FF6B2B" opacity="0.5" />
    </Svg>
  );
}

/** Cofre del tesoro — sin tarjetas de fidelización */
function ChestSvg() {
  return (
    <Svg width="130" height="130" viewBox="0 0 130 130">
      {/* Sombra */}
      <Ellipse cx="65" cy="118" rx="38" ry="7" fill="#F5F0EB" />
      {/* Cuerpo del cofre (parte baja) */}
      <Rect x="18" y="68" width="94" height="44" rx="8" fill="#C23D0E" />
      {/* Parte lateral derecha */}
      <Rect x="100" y="68" width="12" height="44" rx="0" fill="#A03510" />
      {/* Franja horizontal en el cuerpo */}
      <Rect x="18" y="84" width="94" height="10" fill="#A03510" />
      {/* Tapa del cofre */}
      <Rect x="18" y="42" width="94" height="32" rx="8" fill="#E5501A" />
      {/* Parte lateral derecha de la tapa */}
      <Rect x="100" y="42" width="12" height="32" rx="0" fill="#C23D0E" />
      {/* Bisagra izq */}
      <Rect x="24" y="68" width="10" height="6" rx="3" fill="#FFD166" />
      {/* Bisagra der */}
      <Rect x="96" y="68" width="10" height="6" rx="3" fill="#FFD166" />
      {/* Refuerzo metálico tapa */}
      <Rect x="18" y="54" width="94" height="8" fill="#C23D0E" opacity="0.5" />
      {/* Cerradura — placa */}
      <Rect x="52" y="75" width="26" height="20" rx="5" fill="#FFD166" />
      {/* Cerradura — ojo */}
      <Circle cx="65" cy="82" r="5" fill="#B8891A" />
      <Rect x="62" y="82" width="6" height="7" rx="2" fill="#B8891A" />
      {/* Destellos */}
      <Path d="M28,48 L29,44 L30,48 L34,48 L31,50.5 L32,54.5 L29,52 L26,54.5 L27,50.5 L24,48 Z" fill="#FFD166" opacity="0.9" />
      <Path d="M100,46 L101,43 L102,46 L105,46 L103,48 L104,51 L101,49 L98,51 L99,48 L97,46 Z" fill="#FFD166" opacity="0.7" />
      <Circle cx="116" cy="60" r="3" fill="#FF6B2B" opacity="0.6" />
      <Circle cx="14" cy="60" r="2.5" fill="#FFD166" opacity="0.7" />
    </Svg>
  );
}

/** Copa de trofeo — sin premios canjeados todavía */
function TrophySvg() {
  return (
    <Svg width="130" height="130" viewBox="0 0 130 130">
      {/* Sombra */}
      <Ellipse cx="65" cy="120" rx="30" ry="7" fill="#F5F0EB" />
      {/* Base */}
      <Rect x="45" y="108" width="40" height="10" rx="5" fill="#FFD166" />
      {/* Tallo */}
      <Rect x="59" y="90" width="12" height="20" rx="4" fill="#F4A33D" />
      {/* Copa principal */}
      <Path
        d="M30,28 Q28,65 40,80 Q52,92 65,92 Q78,92 90,80 Q102,65 100,28 Z"
        fill="#FFD166"
      />
      {/* Brillo interno */}
      <Path
        d="M42,32 Q40,58 48,72 Q55,82 65,83"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
      {/* Asa izquierda */}
      <Path
        d="M30,35 Q14,35 14,52 Q14,68 30,68"
        stroke="#F4A33D"
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
      />
      {/* Asa derecha */}
      <Path
        d="M100,35 Q116,35 116,52 Q116,68 100,68"
        stroke="#F4A33D"
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
      />
      {/* Estrella central */}
      <Path
        d="M65,44 L68,54 L78,54 L70,60 L73,70 L65,64 L57,70 L60,60 L52,54 L62,54 Z"
        fill="#FF6B2B"
      />
      {/* Destellos */}
      <Path d="M20,18 L21,14 L22,18 L26,18 L23,20.5 L24,24.5 L21,22 L18,24.5 L19,20.5 L16,18 Z" fill="#FF6B2B" opacity="0.8" />
      <Path d="M108,20 L109,17 L110,20 L113,20 L111,22 L112,25 L109,23 L106,25 L107,22 L105,20 Z" fill="#FFD166" opacity="0.9" />
      <Circle cx="22" cy="88" r="3" fill="#FFD166" opacity="0.7" />
      <Circle cx="110" cy="85" r="2.5" fill="#FF6B2B" opacity="0.6" />
    </Svg>
  );
}

/** Tarjetas vacías — filtro de categoría sin resultados */
function CardStackSvg() {
  return (
    <Svg width="130" height="130" viewBox="0 0 130 130">
      {/* Sombra */}
      <Ellipse cx="65" cy="118" rx="40" ry="7" fill="#F5F0EB" />
      {/* Tarjeta trasera (naranja muy suave) */}
      <Rect x="22" y="35" width="86" height="54" rx="12" fill="#FFCBAA" />
      {/* Tarjeta media */}
      <Rect x="16" y="44" width="86" height="54" rx="12" fill="#FFE3D1" />
      {/* Tarjeta frontal */}
      <Rect x="10" y="54" width="86" height="54" rx="12" fill="#FFFBF7" stroke="#FFE3D1" strokeWidth="1.5" />
      {/* Banda de color superior */}
      <Rect x="10" y="54" width="86" height="16" rx="12" fill="#FF6B2B" />
      <Rect x="10" y="62" width="86" height="8" fill="#FF6B2B" />
      {/* Logo ficticio */}
      <Circle cx="28" cy="83" r="8" fill="#F5F0EB" />
      {/* Líneas de texto */}
      <Rect x="42" y="78" width="40" height="5" rx="2.5" fill="#E5E7EB" />
      <Rect x="42" y="87" width="28" height="4" rx="2" fill="#F3F4F6" />
      {/* Puntos / estrellas */}
      <Rect x="18" y="97" width="52" height="5" rx="2.5" fill="#F3F4F6" />
      {/* Lupa */}
      <Circle cx="98" cy="82" r="16" fill="#FFF4EE" stroke="#FFE3D1" strokeWidth="2" />
      <Circle cx="98" cy="80" r="9" fill="none" stroke="#FF6B2B" strokeWidth="3" />
      <Line x1="105" y1="87" x2="111" y2="93" stroke="#FF6B2B" strokeWidth="3" strokeLinecap="round" />
    </Svg>
  );
}

// ═══════════════════════════════════════════════════════════
// Componente principal EmptyState
// ═══════════════════════════════════════════════════════════

export type EmptyStateVariant = 'ghost' | 'chest' | 'trophy' | 'cards';

const ILLUSTRATIONS: Record<EmptyStateVariant, React.ReactNode> = {
  ghost:  <GhostSvg />,
  chest:  <ChestSvg />,
  trophy: <TrophySvg />,
  cards:  <CardStackSvg />,
};

interface EmptyStateProps {
  variant: EmptyStateVariant;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Estado vacío con ilustración SVG, texto ingenioso y animación de entrada.
 * La ilustración + texto entran con un suave fade-in + slide-up al montarse.
 */
export function EmptyState({
  variant,
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const translateY = useSharedValue(24);
  const opacity    = useSharedValue(0);

  useEffect(() => {
    opacity.value    = withTiming(1, { duration: 400 });
    translateY.value = withSpring(0, { damping: 18, stiffness: 120 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.container, animStyle]}>
      <View style={styles.illustration}>
        {ILLUSTRATIONS[variant]}
      </View>

      <Text style={styles.title}>{title}</Text>

      {subtitle ? (
        <Text style={styles.subtitle}>{subtitle}</Text>
      ) : null}

      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.actionBtn}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems:      'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  illustration: {
    marginBottom: 24,
  },
  title: {
    color:       colors.accent,
    fontFamily:  fonts.bold,
    fontWeight:  '700',
    fontSize:    20,
    textAlign:   'center',
    lineHeight:  28,
  },
  subtitle: {
    color:      colors.gray500,
    fontFamily: fonts.regular,
    fontSize:   14,
    textAlign:  'center',
    marginTop:  8,
    lineHeight: 20,
  },
  actionBtn: {
    marginTop:        24,
    backgroundColor:  colors.primary500,
    borderRadius:     999,
    paddingHorizontal: 28,
    paddingVertical:   13,
  },
  actionText: {
    color:      colors.white,
    fontFamily: fonts.bold,
    fontWeight: '700',
    fontSize:   15,
  },
});
