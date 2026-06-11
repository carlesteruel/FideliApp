import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View, StyleSheet, TouchableOpacityProps } from 'react-native';
import { colors } from '../../theme';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({ title, variant = 'primary', size = 'md', loading = false, leftIcon, rightIcon, disabled, style, ...props }: ButtonProps) {
  const isDisabled = disabled || loading;

  const containerStyle = [
    styles.base,
    styles[`variant_${variant}`],
    styles[`size_${size}`],
    isDisabled && styles.disabled,
    style,
  ];

  const textStyle = [styles.text, styles[`text_${variant}`], styles[`textSize_${size}`]];
  const loaderColor = variant === 'outline' || variant === 'ghost' ? colors.primary500 : colors.white;

  return (
    <TouchableOpacity style={containerStyle} disabled={isDisabled} activeOpacity={0.8} {...props}>
      {loading ? (
        <ActivityIndicator size="small" color={loaderColor} />
      ) : (
        <>
          {leftIcon && <View style={{ marginRight: 8 }}>{leftIcon}</View>}
          <Text style={textStyle}>{title}</Text>
          {rightIcon && <View style={{ marginLeft: 8 }}>{rightIcon}</View>}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  // Variantes de contenedor
  variant_primary:   { backgroundColor: colors.primary500 },
  variant_secondary: { backgroundColor: colors.secondary500 },
  variant_outline:   { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.primary500 },
  variant_ghost:     { backgroundColor: 'transparent' },
  variant_danger:    { backgroundColor: colors.danger500 },
  // Tamaños de contenedor
  size_sm: { paddingHorizontal: 12, paddingVertical: 8,  borderRadius: 10 },
  size_md: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  size_lg: { paddingHorizontal: 24, paddingVertical: 16, borderRadius: 14 },
  // Texto base
  text: { fontWeight: '600' },
  // Colores de texto por variante
  text_primary:   { color: colors.white },
  text_secondary: { color: colors.white },
  text_outline:   { color: colors.primary500 },
  text_ghost:     { color: colors.primary500 },
  text_danger:    { color: colors.white },
  // Tamaños de texto
  textSize_sm: { fontSize: 14 },
  textSize_md: { fontSize: 16 },
  textSize_lg: { fontSize: 18, fontWeight: '700' },
});
