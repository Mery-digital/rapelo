import React, { useRef } from 'react';
import {
  Pressable,
  Animated,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { radius, shadowSoft } from '../theme';

export default function Button({
  title,
  subtitle,
  icon,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  small = false,
  style,
}) {
  const { theme } = useTheme();

  const VARIANTS = {
    whatsapp: {
      colors: ['#17C964', '#12A150'],
      fg: '#FFFFFF',
      shadowColor: '#12A150',
    },
    sms: {
      colors: ['#006FEE', '#004493'],
      fg: '#FFFFFF',
      shadowColor: '#004493',
    },
    primary: {
      colors: ['#006FEE', '#005BC4'],
      fg: '#FFFFFF',
      shadowColor: '#005BC4',
    },
    dark: {
      colors: ['#27272A', '#18181B'],
      fg: '#FFFFFF',
      shadowColor: '#09090B',
    },
    outline: {
      bg: theme.card,
      fg: theme.text,
      border: theme.border,
    },
    danger: {
      bg: theme.dangerSoft,
      fg: theme.danger,
      border: `${theme.danger}55`,
    },
  };

  const v = VARIANTS[variant] || VARIANTS.primary;
  const isDisabled = disabled || loading;
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const animatePress = (pressed) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: pressed ? 0.94 : 1,
        useNativeDriver: true,
        speed: 32,
        bounciness: 12,
      }),
      Animated.spring(translateY, {
        toValue: pressed ? 2 : 0,
        useNativeDriver: true,
        speed: 32,
        bounciness: 10,
      }),
    ]).start();
  };

  const handlePressIn = () => {
    if (isDisabled) return;
    animatePress(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const handlePressOut = () => {
    animatePress(false);
  };

  const inner = loading ? (
    <ActivityIndicator color={v.fg} />
  ) : (
    <View style={styles.contentRow}>
      {icon ? (
        <Ionicons
          name={icon}
          size={small ? 18 : 21}
          color={v.fg}
          style={{ marginRight: 8 }}
        />
      ) : null}
      <View style={{ alignItems: subtitle ? 'flex-start' : 'center' }}>
        <Text style={[styles.text, small && styles.textSmall, { color: v.fg }]}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );

  return (
    <Animated.View
      style={[
        styles.outer,
        v.shadowColor && { shadowColor: v.shadowColor, shadowOpacity: 0.22 },
        { transform: [{ scale }, { translateY }] },
        isDisabled && styles.disabled,
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
      >
        {v.colors ? (
          <LinearGradient
            colors={v.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.base, small && styles.small]}
          >
            {inner}
          </LinearGradient>
        ) : (
          <View
            style={[
              styles.base,
              small && styles.small,
              { backgroundColor: v.bg },
              v.border && { borderWidth: 1.5, borderColor: v.border },
            ]}
          >
            {inner}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    borderRadius: radius.md,
    ...shadowSoft,
  },
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  small: { minHeight: 44, paddingVertical: 8 },
  disabled: { opacity: 0.55 },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  textSmall: { fontSize: 14 },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
});
