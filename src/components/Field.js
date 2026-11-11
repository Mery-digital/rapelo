import React, { useRef, useState } from 'react';
import { View, Text, TextInput, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';

export default function Field({
  label,
  icon,
  hint,
  rightSuffix,
  style,
  multiline,
  onFocus,
  onBlur,
  ...inputProps
}) {
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const handleFocus = (e) => {
    setFocused(true);
    Animated.spring(scale, {
      toValue: 1.015,
      useNativeDriver: true,
      speed: 28,
      bounciness: 8,
    }).start();
    onFocus?.(e);
  };

  const handleBlur = (e) => {
    setFocused(false);
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 28,
      bounciness: 8,
    }).start();
    onBlur?.(e);
  };

  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
      ) : null}
      <Animated.View
        style={[
          styles.inputBox,
          multiline && styles.multilineBox,
          focused && styles.inputBoxFocused,
          { transform: [{ scale }] },
        ]}
      >
        {icon ? (
          <View style={[styles.iconWrap, focused && styles.iconWrapFocused]}>
            <Ionicons
              name={icon}
              size={18}
              color={focused ? colors.accent : colors.muted}
            />
          </View>
        ) : null}
        <TextInput
          placeholderTextColor="#94A3B8"
          style={[styles.input, multiline && styles.multiline]}
          multiline={multiline}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...inputProps}
        />
        {rightSuffix ? (
          <View style={styles.suffixBadge}>
            <Text style={styles.suffixText}>{rightSuffix}</Text>
          </View>
        ) : null}
      </Animated.View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 15 },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 7,
    letterSpacing: 0.2,
  },
  labelFocused: { color: colors.accent },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
  },
  multilineBox: {
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  inputBoxFocused: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  iconWrapFocused: {
    backgroundColor: colors.accentSoft,
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  multiline: { minHeight: 82, textAlignVertical: 'top' },
  suffixBadge: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginLeft: 8,
  },
  suffixText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.accent,
  },
  hint: { fontSize: 12, color: colors.muted, marginTop: 5 },
});
