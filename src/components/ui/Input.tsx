import React, { useState } from 'react';
import { View, Text, TextInput, TextInputProps, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
}

export function Input({ label, error, leftIcon, rightIcon, onRightIconPress, secureTextEntry, ...props }: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isSecure, setIsSecure] = useState(secureTextEntry ?? false);

  const borderColor = isFocused ? colors.primary500 : error ? colors.red400 : colors.gray200;

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputRow, { borderColor }]}>
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.gray400}
          secureTextEntry={isSecure}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {(rightIcon || secureTextEntry) && (
          <TouchableOpacity style={styles.rightIcon} onPress={() => { if (secureTextEntry) setIsSecure(!isSecure); onRightIconPress?.(); }}>
            {rightIcon ?? <Text style={styles.eyeIcon}>{isSecure ? '👁' : '🙈'}</Text>}
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:  { marginBottom: 16 },
  label:    { color: colors.gray700, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  leftIcon: { marginRight: 8, opacity: 0.5 },
  rightIcon:{ marginLeft: 8 },
  input:    { flex: 1, paddingVertical: 14, color: colors.gray800, fontSize: 16 },
  eyeIcon:  { color: colors.gray400, fontSize: 14 },
  error:    { color: colors.red500, fontSize: 12, marginTop: 4 },
});
