import React, { useRef, useState } from 'react';
import { View, Text, TextInput, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { radius } from '../theme';

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
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const handleFocus = (e) => {
    setFocused(true);
    Animated.spring(scale, {
      toValue: 1.01,
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
        <Text
          style={[
            styles.label,
            { color: focused ? theme.accent : theme.textSecondary },
          ]}
        >
          {label}
        </Text>
      ) : null}
      <Animated.View
        style={[
          styles.inputBox,
          {
            backgroundColor: focused ? theme.inputBgFocus : theme.inputBg,
            borderColor: focused ? theme.accent : theme.border,
          },
          multiline && styles.multilineBox,
          focused && {
            shadowColor: theme.accent,
            shadowOpacity: 0.14,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 },
            elevation: 2,
          },
          { transform: [{ scale }] },
        ]}
      >
        {icon ? (
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: focused ? theme.accentSoft : theme.border },
            ]}
          >
            <Ionicons
              name={icon}
              size={18}
              color={focused ? theme.accent : theme.muted}
            />
          </View>
        ) : null}
        <TextInput
          placeholderTextColor={theme.muted}
          style={[
            styles.input,
            { color: theme.text },
            multiline && styles.multiline,
          ]}
          multiline={multiline}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...inputProps}
        />
        {rightSuffix ? (
          <View style={[styles.suffixBadge, { backgroundColor: theme.accentSoft }]}>
            <Text style={[styles.suffixText, { color: theme.accent }]}>
              {rightSuffix}
            </Text>
          </View>
        ) : null}
      </Animated.View>
      {hint ? <Text style={[styles.hint, { color: theme.muted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 12,
  },
  multilineBox: {
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  suffixBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginLeft: 8,
  },
  suffixText: {
    fontSize: 12,
    fontWeight: '800',
  },
  hint: { fontSize: 12, marginTop: 5 },
});
