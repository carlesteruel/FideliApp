import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const CONFETTI_COLORS = [
  '#FF6B2B', // primary naranja
  '#FFD166', // highlight dorado
  '#F4A33D', // secondary ámbar
  '#FF9F68', // naranja claro
  '#FFFBF7', // crema
  '#06D6A0', // verde menta
  '#118AB2', // azul
  '#EF476F', // rosa
];

const PARTICLE_COUNT = 45;

interface ParticleConfig {
  id:    number;
  x:     number;
  color: string;
  size:  number;
  delay: number;
  duration: number;
  rotSpeed: number;
  isRect: boolean;
}

interface ConfettiParticleProps {
  config: ParticleConfig;
  onDone?: () => void;
}

function ConfettiParticle({ config }: ConfettiParticleProps) {
  const { x, color, size, delay, duration, rotSpeed, isRect } = config;

  const translateY = useSharedValue(-size * 2 - 40);
  const rotation   = useSharedValue(0);
  const opacity    = useSharedValue(0);

  useEffect(() => {
    // Fade in rápido al arrancar
    opacity.value = withDelay(delay, withTiming(1, { duration: 150 }));

    // Caída lineal
    translateY.value = withDelay(
      delay,
      withTiming(SCREEN_H + 60, {
        duration,
        easing: Easing.linear,
      }),
    );

    // Rotación continua (da sensación de papel cayendo)
    rotation.value = withDelay(
      delay,
      withRepeat(
        withTiming(360, { duration: rotSpeed, easing: Easing.linear }),
        -1,
        false,
      ),
    );

    // Fade out antes de salir de pantalla
    opacity.value = withDelay(
      delay + duration - 500,
      withTiming(0, { duration: 500 }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          position:        'absolute',
          left:            x,
          top:             0,
          width:           isRect ? size * 1.6 : size,
          height:          isRect ? size * 0.6 : size,
          backgroundColor: color,
          borderRadius:    isRect ? 2 : size / 2,
        },
      ]}
    />
  );
}

interface ConfettiOverlayProps {
  visible: boolean;
}

/**
 * Overlay de confeti animado con Reanimated.
 * Se monta encima de cualquier pantalla con `position: absolute`.
 * Pasar `visible={true}` dispara la animación.
 */
export function ConfettiOverlay({ visible }: ConfettiOverlayProps) {
  const particles = useMemo<ParticleConfig[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id:       i,
      x:        Math.random() * (SCREEN_W - 12),
      color:    CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size:     6 + Math.random() * 8,
      delay:    Math.random() * 1200,
      duration: 2000 + Math.random() * 1500,
      rotSpeed: 400 + Math.random() * 600,
      isRect:   Math.random() > 0.5,
    }));
  }, []);

  if (!visible) return null;

  return (
    <Animated.View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {particles.map((p) => (
        <ConfettiParticle key={p.id} config={p} />
      ))}
    </Animated.View>
  );
}
