import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  TouchableOpacityProps,
  View,
} from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const containerStyles: Record<string, string> = {
    primary: 'bg-primary-500',
    secondary: 'bg-secondary-500',
    outline: 'border-2 border-primary-500 bg-transparent',
    ghost: 'bg-transparent',
    danger: 'bg-danger-500',
  };

  const textStyles: Record<string, string> = {
    primary: 'text-white',
    secondary: 'text-white',
    outline: 'text-primary-500',
    ghost: 'text-primary-500',
    danger: 'text-white',
  };

  const sizeStyles: Record<string, { container: string; text: string }> = {
    sm: { container: 'px-3 py-2 rounded-lg', text: 'text-sm font-semibold' },
    md: { container: 'px-5 py-3 rounded-xl', text: 'text-base font-semibold' },
    lg: { container: 'px-6 py-4 rounded-xl', text: 'text-lg font-bold' },
  };

  return (
    <TouchableOpacity
      className={`
        flex-row items-center justify-center
        ${containerStyles[variant]}
        ${sizeStyles[size].container}
        ${isDisabled ? 'opacity-50' : 'opacity-100'}
      `}
      disabled={isDisabled}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? '#6C3DF4' : '#ffffff'}
        />
      ) : (
        <>
          {leftIcon && <View className="mr-2">{leftIcon}</View>}
          <Text className={`${textStyles[variant]} ${sizeStyles[size].text}`}>
            {title}
          </Text>
          {rightIcon && <View className="ml-2">{rightIcon}</View>}
        </>
      )}
    </TouchableOpacity>
  );
}
