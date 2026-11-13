import React, { useRef, useState } from 'react';
import { View, Text, TextInput, Animated, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { radius } from '../theme';

/**
 * Composant de formulaire moderne style HeroUI Native (TextField / Input / TextArea)
 */
export default function Field({
  label,
  icon,
  hint,
  description,
  error,
  rightSuffix,
  style,
  multiline,
  onFocus,
  onBlur,
  isRequired = false,
  ...inputProps
}) {
  const { theme, isDark } = useTheme();
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const handleFocus = (e) => {
    setFocused(true);
    Animated.spring(scale, {
      toValue: 1.008,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
    onFocus?.(e);
  };

  const handleBlur = (e) => {
    setFocused(false);
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
    onBlur?.(e);
  };

  const hasError = Boolean(error);
  const borderColor = hasError
    ? theme.danger
    : focused
    ? theme.accent
    : theme.border;

  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text
            style={[
              styles.label,
              {
                color: hasError
                  ? theme.danger
                  : focused
                  ? theme.accent
                  : theme.text,
              },
            ]}
          >
            {label}
          </Text>
          {isRequired ? (
            <Text style={[styles.requiredStar, { color: theme.danger }]}>*</Text>
          ) : null}
        </View>
      ) : null}

      <Animated.View
        style={[
          styles.inputBox,
          {
            backgroundColor: focused ? theme.inputBgFocus : theme.inputBg,
            borderColor,
          },
          multiline && styles.multilineBox,
          focused && {
            shadowColor: hasError ? theme.danger : theme.accent,
            shadowOpacity: 0.16,
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
              {
                backgroundColor: hasError
                  ? theme.dangerSoft
                  : focused
                  ? theme.accentSoft
                  : isDark
                  ? '#27272A'
                  : '#E4E4E7',
              },
            ]}
          >
            <Ionicons
              name={icon}
              size={17}
              color={
                hasError
                  ? theme.danger
                  : focused
                  ? theme.accent
                  : theme.muted
              }
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
          <View style={styles.suffixWrap}>{rightSuffix}</View>
        ) : null}
      </Animated.View>

      {/* Description / Hint */}
      {(hint || description) && !hasError ? (
        <Text style={[styles.hint, { color: theme.muted }]}>
          {hint || description}
        </Text>
      ) : null}

      {/* Field Error */}
      {hasError ? (
        <View style={styles.errorRow}>
          <Ionicons
            name="alert-circle"
            size={13}
            color={theme.danger}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.errorText, { color: theme.danger }]}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function HeroTextArea(props) {
  return <Field multiline numberOfLines={3} {...props} />;
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  requiredStar: {
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 3,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    minHeight: 50,
    paddingHorizontal: 12,
  },
  multilineBox: {
    alignItems: 'flex-start',
    paddingVertical: 10,
    minHeight: 88,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 10,
  },
  multiline: {
    textAlignVertical: 'top',
    minHeight: 64,
  },
  suffixWrap: {
    marginLeft: 8,
  },
  hint: {
    fontSize: 11.5,
    marginTop: 5,
    marginLeft: 4,
    lineHeight: 16,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    marginLeft: 4,
  },
  errorText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
});
