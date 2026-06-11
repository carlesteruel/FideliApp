import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { fonts } from '../../theme';

// ── Crear versión animada de Circle (react-native-svg) ─────────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CircularProgressProps {
  /** Diámetro total en dp. Por defecto 120 */
  size?: number;
  /** Grosor del arco. Por defecto 10 */
  strokeWidth?: number;
  /** Progreso entre 0.0 y 1.0 */
  progress: number;
  /** Color del arco de progreso */
  color?: string;
  /** Color de la pista de fondo */
  trackColor?: string;
  /** Número o texto en el centro */
  label?: string | number;
  /** Subtítulo debajo del label */
  sublabel?: string;
  /** Color del label central */
  labelColor?: string;
}

/**
 * Indicador de progreso circular premium.
 * SVG puro (react-native-svg) + animación de arco con Reanimated.
 * La animación de relleno se activa al montar y cuando cambia `progress`.
 */
export function CircularProgress({
  size = 120,
  strokeWidth = 10,
  progress,
  color = '#FF6B2B',
  trackColor = '#F5F0EB',
  label,
  sublabel,
  labelColor = '#1A1A2E',
}: CircularProgressProps) {
  const radius       = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center       = size / 2;

  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withTiming(
      Math.min(1, Math.max(0, progress)),
      { duration: 900, easing: Easing.out(Easing.cubic) },
    );
  }, [progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));

  const labelFontSize    = Math.round(size * 0.22);
  const sublabelFontSize = Math.round(size * 0.095);

  return (
    <View style={{ width: size, height: size }}>
      {/* SVG de los arcos */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* Pista de fondo */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Arco de progreso animado */}
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          transform={`rotate(-90, ${center}, ${center})`}
        />
      </Svg>

      {/* Contenido central */}
      {(label !== undefined || sublabel) && (
        <View style={[StyleSheet.absoluteFill, styles.centerContent]}>
          {label !== undefined && (
            <Text
              style={[
                styles.label,
                {
                  fontSize:    labelFontSize,
                  color:       labelColor,
                  fontFamily:  fonts.extrabold,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {label}
            </Text>
          )}
          {sublabel ? (
            <Text
              style={[
                styles.sublabel,
                {
                  fontSize:   sublabelFontSize,
                  fontFamily: fonts.regular,
                },
              ]}
              numberOfLines={2}
              adjustsFontSizeToFit
            >
              {sublabel}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centerContent: {
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  label: {
    fontWeight:  '800',
    textAlign:   'center',
    lineHeight:  undefined,
  },
  sublabel: {
    color:      '#9CA3AF',
    textAlign:  'center',
    marginTop:  2,
    lineHeight: undefined,
  },
});
