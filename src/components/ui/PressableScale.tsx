import React, { useCallback } from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface PressableScaleProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Escala al presionar (0-1). Por defecto 0.95 */
  scaleValue?: number;
  /** Feedback háptico al presionar. Por defecto true */
  haptic?: boolean;
  disabled?: boolean;
}

/**
 * Sustituto de TouchableOpacity con micro-animación de escala (spring)
 * y feedback háptico integrado. Usa Reanimated para que la animación
 * corra en el hilo de UI y sea completamente fluida.
 */
export function PressableScale({
  children,
  onPress,
  style,
  scaleValue = 0.95,
  haptic = true,
  disabled = false,
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    scale.value = withSpring(scaleValue, { damping: 15, stiffness: 300 });
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [scaleValue, haptic, disabled]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, []);

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View style={[animatedStyle, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
