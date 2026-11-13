import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  Animated,
  Easing,
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

/* ============================================================================
   HEROUI NATIVE BUTTON CONTEXT & HOOK (useButton)
   ============================================================================ */
const ButtonContext = createContext(null);

export function useButton() {
  const ctx = useContext(ButtonContext);
  if (!ctx) {
    throw new Error('useButton doit être utilisé à l’intérieur d’un composant <Button>.');
  }
  return ctx;
}

const SIZE_MAP = {
  sm: {
    minHeight: 42,
    iconBox: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13.5,
    iconSize: 17,
    borderRadius: 12,
  },
  md: {
    minHeight: 50,
    iconBox: 48,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 15,
    iconSize: 20,
    borderRadius: radius.md,
  },
  lg: {
    minHeight: 56,
    iconBox: 54,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 16,
    iconSize: 22,
    borderRadius: 16,
  },
};

function ButtonLabel({ children, style, ...rest }) {
  const { fg, dims } = useButton();
  return (
    <Text
      style={[
        styles.text,
        { color: fg, fontSize: dims.fontSize },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

function ButtonBackground({ children, style, ...rest }) {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

/**
 * Bouton style HeroUI Native (pur React Native, compatible Web & Android APK)
 * Supporte :
 * - Les 7 variantes HeroUI ('primary', 'secondary', 'tertiary', 'outline', 'ghost', 'danger', 'danger-soft')
 *   + variantes RAPELO ('whatsapp', 'sms', 'dark')
 * - Tailles ('sm' | 'md' | 'lg' ou small={true}) et isIconOnly
 * - feedbackVariant ('scale-highlight' | 'scale-ripple' | 'scale' | 'none') + prop animation
 * - Composition (<Button.Label>, <Button.Background>, children) et props classiques (title, subtitle, icon, loading)
 */
function Button({
  title,
  subtitle,
  icon,
  children,
  onPress,
  variant = 'primary',
  size: sizeProp,
  small = false,
  isIconOnly = false,
  fullWidth,
  feedbackVariant = 'scale-highlight',
  animation,
  background,
  loading = false,
  disabled = false,
  isDisabled: isDisabledProp = false,
  accessibilityLabel,
  style,
  ...rest
}) {
  const { theme, isDark } = useTheme();
  const resolvedSize = sizeProp || (small ? 'sm' : 'md');
  const dims = SIZE_MAP[resolvedSize] || SIZE_MAP.md;

  const VARIANTS = useMemo(
    () => ({
      primary: {
        colors: ['#006FEE', '#005BC4'],
        fg: '#FFFFFF',
        shadowColor: '#005BC4',
        highlightColor: '#FFFFFF',
      },
      secondary: {
        bg: theme.accentSoft,
        fg: theme.accent,
        border: `${theme.accent}33`,
        highlightColor: theme.accent,
      },
      tertiary: {
        bg: theme.surface,
        fg: theme.text,
        border: theme.border,
        highlightColor: isDark ? '#FFFFFF' : '#09090B',
      },
      outline: {
        bg: theme.card,
        fg: theme.text,
        border: theme.border,
        highlightColor: isDark ? '#FFFFFF' : '#09090B',
      },
      ghost: {
        bg: 'transparent',
        fg: theme.text,
        highlightColor: isDark ? '#FFFFFF' : '#09090B',
      },
      danger: {
        colors: ['#F31260', '#C20E4D'],
        fg: '#FFFFFF',
        shadowColor: '#C20E4D',
        highlightColor: '#FFFFFF',
      },
      'danger-soft': {
        bg: theme.dangerSoft,
        fg: theme.danger,
        border: `${theme.danger}55`,
        highlightColor: theme.danger,
      },
      whatsapp: {
        colors: ['#17C964', '#12A150'],
        fg: '#FFFFFF',
        shadowColor: '#12A150',
        highlightColor: '#FFFFFF',
      },
      sms: {
        colors: ['#006FEE', '#004493'],
        fg: '#FFFFFF',
        shadowColor: '#004493',
        highlightColor: '#FFFFFF',
      },
      dark: {
        colors: ['#27272A', '#18181B'],
        fg: '#FFFFFF',
        shadowColor: '#09090B',
        highlightColor: '#FFFFFF',
      },
    }),
    [theme, isDark]
  );

  const v = VARIANTS[variant] || VARIANTS.primary;
  const isDisabled = Boolean(disabled || isDisabledProp || loading);
  const shouldFlex = fullWidth !== undefined ? fullWidth : !isIconOnly;

  const animDisabled =
    feedbackVariant === 'none' ||
    animation === false ||
    animation === 'disabled' ||
    animation === 'disable-all' ||
    animation?.state === false ||
    animation?.state === 'disabled' ||
    animation?.state === 'disable-all';

  const scaleEnabled = !animDisabled && animation?.scale !== false;
  const pressedScaleValue =
    typeof animation?.scale?.value === 'number' ? animation.scale.value : 0.96;

  const highlightEnabled =
    !animDisabled &&
    feedbackVariant === 'scale-highlight' &&
    animation?.highlight !== false;

  const rippleEnabled =
    !animDisabled &&
    feedbackVariant === 'scale-ripple' &&
    animation?.ripple !== false;

  const scale = useRef(new Animated.Value(1)).current;
  const highlightOpacity = useRef(new Animated.Value(0)).current;
  const rippleScale = useRef(new Animated.Value(0)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;
  const [btnLayout, setBtnLayout] = useState({ width: 120, height: 50 });
  const [rippleOrigin, setRippleOrigin] = useState({ x: 60, y: 25 });

  const handlePressIn = (e) => {
    if (isDisabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    if (scaleEnabled) {
      Animated.spring(scale, {
        toValue: pressedScaleValue,
        useNativeDriver: true,
        speed: 34,
        bounciness: 10,
      }).start();
    }

    if (highlightEnabled) {
      const targetOpacity = Array.isArray(animation?.highlight?.opacity?.value)
        ? animation.highlight.opacity.value[1]
        : 0.16;
      Animated.timing(highlightOpacity, {
        toValue: targetOpacity,
        duration: 110,
        useNativeDriver: true,
      }).start();
    }

    if (rippleEnabled) {
      const lx = e?.nativeEvent?.locationX;
      const ly = e?.nativeEvent?.locationY;
      setRippleOrigin({
        x: typeof lx === 'number' ? lx : btnLayout.width / 2,
        y: typeof ly === 'number' ? ly : btnLayout.height / 2,
      });
      rippleScale.setValue(0.05);
      const peak = Array.isArray(animation?.ripple?.opacity?.value)
        ? animation.ripple.opacity.value[1]
        : 0.28;
      rippleOpacity.setValue(peak);
      Animated.parallel([
        Animated.timing(rippleScale, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(rippleOpacity, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handlePressOut = () => {
    if (scaleEnabled) {
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 30,
        bounciness: 10,
      }).start();
    }
    if (highlightEnabled) {
      Animated.timing(highlightOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start();
    }
  };

  const contextValue = useMemo(
    () => ({
      size: resolvedSize,
      variant,
      isDisabled,
      fg: v.fg,
      dims,
    }),
    [resolvedSize, variant, isDisabled, v.fg, dims]
  );

  const renderInner = () => {
    if (loading) {
      return <ActivityIndicator color={v.fg} />;
    }

    if (children !== undefined && children !== null) {
      if (typeof children === 'string' || typeof children === 'number') {
        return <ButtonLabel>{children}</ButtonLabel>;
      }
      return <View style={styles.contentRow}>{children}</View>;
    }

    return (
      <View style={styles.contentRow}>
        {icon ? (
          <Ionicons
            name={icon}
            size={dims.iconSize}
            color={v.fg}
            style={title ? { marginRight: 8 } : undefined}
          />
        ) : null}
        {title ? (
          <View style={{ alignItems: subtitle ? 'flex-start' : 'center' }}>
            <Text
              style={[
                styles.text,
                { color: v.fg, fontSize: dims.fontSize },
              ]}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={[
                  styles.subtitle,
                  {
                    color:
                      v.fg === '#FFFFFF'
                        ? 'rgba(255,255,255,0.85)'
                        : theme.muted,
                  },
                ]}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const rippleMaxDim = Math.max(btnLayout.width, btnLayout.height) * 2.2;
  const highlightColor =
    animation?.highlight?.backgroundColor?.value || v.highlightColor || '#FFFFFF';
  const rippleColor =
    animation?.ripple?.backgroundColor?.value || v.highlightColor || '#FFFFFF';

  const containerDimensions = isIconOnly
    ? {
        width: dims.iconBox,
        height: dims.iconBox,
        borderRadius: dims.borderRadius,
        paddingHorizontal: 0,
        paddingVertical: 0,
      }
    : {
        minHeight: dims.minHeight,
        borderRadius: dims.borderRadius,
        paddingHorizontal: dims.paddingHorizontal,
        paddingVertical: dims.paddingVertical,
      };

  const surfaceOverlays = (
    <>
      {background ? <ButtonBackground>{background}</ButtonBackground> : null}

      {highlightEnabled ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: highlightColor,
              opacity: highlightOpacity,
            },
          ]}
        />
      ) : null}

      {rippleEnabled ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: rippleMaxDim,
            height: rippleMaxDim,
            borderRadius: rippleMaxDim / 2,
            left: rippleOrigin.x - rippleMaxDim / 2,
            top: rippleOrigin.y - rippleMaxDim / 2,
            backgroundColor: rippleColor,
            opacity: rippleOpacity,
            transform: [{ scale: rippleScale }],
          }}
        />
      ) : null}
    </>
  );

  const hasShadow = v.shadowColor || (variant !== 'ghost' && variant !== 'tertiary');

  return (
    <ButtonContext.Provider value={contextValue}>
      <Animated.View
        style={[
          shouldFlex ? styles.outerFlex : styles.outerSelf,
          { borderRadius: dims.borderRadius },
          hasShadow && {
            ...shadowSoft,
            shadowColor: v.shadowColor || '#09090B',
            shadowOpacity: variant === 'ghost' ? 0 : v.shadowColor ? 0.22 : 0.08,
          },
          { transform: [{ scale }] },
          isDisabled && styles.disabled,
          style,
        ]}
      >
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onLayout={(e) => setBtnLayout(e.nativeEvent.layout)}
          disabled={isDisabled}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel || (typeof title === 'string' ? title : undefined)}
          {...rest}
        >
          {v.colors && background !== null ? (
            <LinearGradient
              colors={v.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.base, containerDimensions]}
            >
              {surfaceOverlays}
              {renderInner()}
            </LinearGradient>
          ) : (
            <View
              style={[
                styles.base,
                containerDimensions,
                { backgroundColor: v.bg || 'transparent' },
                v.border && { borderWidth: 1.5, borderColor: v.border },
              ]}
            >
              {surfaceOverlays}
              {renderInner()}
            </View>
          )}
        </Pressable>
      </Animated.View>
    </ButtonContext.Provider>
  );
}

Button.Label = ButtonLabel;
Button.Background = ButtonBackground;

export default Button;

const styles = StyleSheet.create({
  outerFlex: {
    flex: 1,
  },
  outerSelf: {
    alignSelf: 'flex-start',
  },
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.52,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  text: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
    fontWeight: '600',
  },
});
