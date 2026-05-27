import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  secureTextEntry,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isSecure, setIsSecure] = useState(secureTextEntry ?? false);

  return (
    <View className="mb-4">
      {label && (
        <Text className="text-gray-700 text-sm font-semibold mb-1.5">{label}</Text>
      )}
      <View
        className={`
          flex-row items-center
          bg-gray-50 border rounded-xl px-3 py-0
          ${isFocused ? 'border-primary-500' : error ? 'border-red-400' : 'border-gray-200'}
        `}
      >
        {leftIcon && (
          <View className="mr-2 opacity-50">{leftIcon}</View>
        )}
        <TextInput
          className="flex-1 py-3.5 text-gray-800 text-base"
          placeholderTextColor="#9CA3AF"
          secureTextEntry={isSecure}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {(rightIcon || secureTextEntry) && (
          <TouchableOpacity
            className="ml-2"
            onPress={() => {
              if (secureTextEntry) setIsSecure(!isSecure);
              onRightIconPress?.();
            }}
          >
            {rightIcon ?? (
              <Text className="text-gray-400 text-sm">
                {isSecure ? '👁' : '🙈'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text className="text-red-500 text-xs mt-1">{error}</Text>
      )}
    </View>
  );
}
