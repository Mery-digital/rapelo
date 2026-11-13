import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  TextInput,
  Modal,
  Animated,
  Easing,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { radius, shadow, shadowSoft } from '../theme';

/* ============================================================================
   1. HERO AVATAR (Photo ou initiales avec bordure colorée & badge statut)
   ============================================================================ */
export function HeroAvatar({
  uri,
  name = '',
  fallbackIcon = 'person-outline',
  size = 54,
  ringColor,
  statusColor,
  onPress,
}) {
  const { theme } = useTheme();
  const initials = String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const scale = useRef(new Animated.Value(1)).current;
  const bounce = (to) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 28,
      bounciness: 10,
    }).start();

  const inner = (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.34),
          borderWidth: 2,
          borderColor: ringColor || theme.accent,
          padding: 2,
          backgroundColor: theme.card,
          transform: [{ scale }],
        },
      ]}
    >
      <View
        style={{
          flex: 1,
          borderRadius: Math.round(size * 0.28),
          overflow: 'hidden',
          backgroundColor: theme.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : initials ? (
          <Text
            style={{
              fontSize: Math.round(size * 0.34),
              fontWeight: '900',
              color: ringColor || theme.accent,
              letterSpacing: 0.5,
            }}
          >
            {initials}
          </Text>
        ) : (
          <Ionicons
            name={fallbackIcon}
            size={Math.round(size * 0.44)}
            color={ringColor || theme.accent}
          />
        )}
      </View>

      {uri ? (
        <View
          style={[
            styles.avatarZoomIcon,
            { backgroundColor: 'rgba(15, 23, 42, 0.78)' },
          ]}
        >
          <Ionicons name="expand" size={10} color="#FFFFFF" />
        </View>
      ) : null}

      {statusColor ? (
        <View
          style={[
            styles.avatarStatusDot,
            {
              backgroundColor: statusColor,
              borderColor: theme.card,
            },
          ]}
        />
      ) : null}
    </Animated.View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={() => bounce(0.92)}
        onPressOut={() => bounce(1)}
      >
        {inner}
      </Pressable>
    );
  }
  return inner;
}

/* ============================================================================
   2. HERO CHIP (Badge capsule avec variante solid, bordered, flat)
   ============================================================================ */
export function HeroChip({
  label,
  icon,
  color,
  textColor,
  variant = 'flat', // 'flat' | 'bordered' | 'solid'
  pulse = false,
  toolRotate = false,
  size = 'md', // 'sm' | 'md'
  style,
}) {
  const { theme } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (pulse) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [pulse, pulseAnim]);

  useEffect(() => {
    if (toolRotate) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: -1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [toolRotate, rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-14deg', '14deg'],
  });

  const baseColor = color || theme.accent;

  let bg = `${baseColor}1F`;
  let border = 'transparent';
  let fg = textColor || baseColor;

  if (variant === 'solid') {
    bg = baseColor;
    border = baseColor;
    fg = '#FFFFFF';
  } else if (variant === 'bordered') {
    bg = 'transparent';
    border = baseColor;
    fg = textColor || baseColor;
  }

  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: bg,
          borderColor: border,
          paddingHorizontal: isSmall ? 8 : 10,
          paddingVertical: isSmall ? 3 : 5,
        },
        style,
      ]}
    >
      {pulse ? (
        <Animated.View
          style={[
            styles.chipDot,
            {
              backgroundColor: baseColor,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
      ) : null}

      {icon ? (
        <Animated.View
          style={toolRotate ? { transform: [{ rotate: spin }] } : undefined}
        >
          <Ionicons
            name={icon}
            size={isSmall ? 11 : 13}
            color={fg}
            style={{ marginRight: 4 }}
          />
        </Animated.View>
      ) : null}

      <Text
        style={[
          styles.chipText,
          { color: fg, fontSize: isSmall ? 10 : 11.5 },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/* ============================================================================
   3. HERO SWITCH (Interrupteur avec animation de glissement)
   ============================================================================ */
export function HeroSwitch({
  value,
  onValueChange,
  thumbIconOn = 'moon',
  thumbIconOff = 'sunny',
  color,
}) {
  const { theme } = useTheme();
  const activeColor = color || theme.accent;
  const translateX = useRef(new Animated.Value(value ? 22 : 2)).current;

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: value ? 22 : 2,
      useNativeDriver: true,
      speed: 26,
      bounciness: 9,
    }).start();
  }, [value, translateX]);

  const toggle = () => {
    Haptics.selectionAsync().catch(() => {});
    onValueChange?.(!value);
  };

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={[
        styles.switchTrack,
        {
          backgroundColor: value ? activeColor : theme.border,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.switchThumb,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        <Ionicons
          name={value ? thumbIconOn : thumbIconOff}
          size={12}
          color={value ? activeColor : '#F59E0B'}
        />
      </Animated.View>
    </Pressable>
  );
}

/* ============================================================================
   4. HERO TABS (Onglets avec curseur fluide animé)
   ============================================================================ */
export function HeroTabs({ items = [], activeKey, onChange }) {
  const { theme } = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const pillX = useRef(new Animated.Value(0)).current;

  const activeIndex = Math.max(
    0,
    items.findIndex((it) => it.key === activeKey)
  );

  const padding = 5;
  const tabWidth =
    containerWidth > 0 && items.length > 0
      ? (containerWidth - padding * 2) / items.length
      : 0;

  useEffect(() => {
    if (tabWidth > 0) {
      Animated.spring(pillX, {
        toValue: activeIndex * tabWidth,
        useNativeDriver: true,
        speed: 26,
        bounciness: 8,
      }).start();
    }
  }, [activeIndex, tabWidth, pillX]);

  return (
    <View
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      style={[
        styles.tabsWrap,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          padding,
        },
        shadowSoft,
      ]}
    >
      {tabWidth > 0 ? (
        <Animated.View
          style={[
            styles.tabCursor,
            {
              width: tabWidth,
              backgroundColor: theme.accent,
              transform: [{ translateX: pillX }],
            },
          ]}
        />
      ) : null}

      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Pressable
            key={item.key}
            onPress={() => {
              if (!active) {
                Haptics.selectionAsync().catch(() => {});
                onChange?.(item.key);
              }
            }}
            style={styles.tabBtn}
          >
            <Ionicons
              name={item.icon}
              size={17}
              color={active ? '#FFFFFF' : theme.muted}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: active ? '#FFFFFF' : theme.muted },
              ]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ============================================================================
   5. HERO SEARCH FIELD (Champ de recherche avec clear button)
   ============================================================================ */
export function HeroSearchField({ value, onChangeText, placeholder }) {
  const { theme } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.searchBox,
        {
          backgroundColor: theme.card,
          borderColor: focused ? theme.accent : theme.border,
        },
        focused && {
          shadowColor: theme.accent,
          shadowOpacity: 0.14,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 3,
        },
      ]}
    >
      <Ionicons
        name="search"
        size={19}
        color={focused ? theme.accent : theme.muted}
        style={{ marginRight: 9 }}
      />
      <TextInput
        style={[styles.searchInput, { color: theme.text }]}
        placeholder={placeholder || 'Rechercher...'}
        placeholderTextColor={theme.muted}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCorrect={false}
        returnKeyType="search"
      />
      {value ? (
        <HeroCloseButton
          size="sm"
          variant="ghost"
          accessibilityLabel="Effacer la recherche"
          onPress={() => onChangeText?.('')}
          style={{ marginLeft: 4 }}
        >
          <Ionicons name="close-circle" size={19} color={theme.muted} />
        </HeroCloseButton>
      ) : null}
    </View>
  );
}

/* ============================================================================
   6. HERO BOTTOM SHEET (Panneau glissant avec poignée HeroUI)
   ============================================================================ */
export function HeroBottomSheet({
  visible,
  onClose,
  children,
  maxWidth = 520,
}) {
  const { theme } = useTheme();
  const slideY = useRef(new Animated.Value(320)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slideY.setValue(320);
      backdropOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(slideY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 18,
          bounciness: 6,
        }),
      ]).start();
    }
  }, [visible, slideY, backdropOpacity]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View
          style={[
            styles.sheetBackdrop,
            { opacity: backdropOpacity },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

          <Animated.View
            style={[
              styles.sheetCard,
              {
                maxWidth,
                backgroundColor: theme.card,
                borderColor: theme.border,
                transform: [{ translateY: slideY }],
              },
              shadow,
            ]}
          >
            {/* Poignée glissante HeroUI */}
            <Pressable onPress={onClose} style={styles.sheetHandleZone}>
              <View
                style={[styles.sheetHandle, { backgroundColor: theme.border }]}
              />
            </Pressable>

            {children}
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ============================================================================
   7. HERO SKELETON (Chargement animé shimmer HeroUI)
   ============================================================================ */
export function HeroSkeleton({ width = '100%', height = 16, borderRadius = 8, style }) {
  const { theme, isDark } = useTheme();
  const shimmer = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0.45,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: isDark ? '#27272A' : '#E4E4E7',
          opacity: shimmer,
        },
        style,
      ]}
    />
  );
}

export function RepairCardSkeleton() {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.skeletonCard,
        { backgroundColor: theme.card, borderColor: theme.border },
        shadowSoft,
      ]}
    >
      <View style={styles.skeletonTop}>
        <HeroSkeleton width={52} height={52} borderRadius={18} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <HeroSkeleton width="60%" height={16} borderRadius={6} />
          <HeroSkeleton
            width="40%"
            height={12}
            borderRadius={5}
            style={{ marginTop: 7 }}
          />
        </View>
        <HeroSkeleton width={74} height={26} borderRadius={999} />
      </View>
      <HeroSkeleton
        width="100%"
        height={38}
        borderRadius={10}
        style={{ marginTop: 14 }}
      />
      <HeroSkeleton
        width="100%"
        height={64}
        borderRadius={12}
        style={{ marginTop: 10 }}
      />
      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        <HeroSkeleton
          width="48%"
          height={42}
          borderRadius={12}
          style={{ marginRight: 10 }}
        />
        <HeroSkeleton width="48%" height={42} borderRadius={12} />
      </View>
    </View>
  );
}

/* ============================================================================
   8. HERO TOAST (Notifications flottantes)
   ============================================================================ */
const ToastContext = createContext({
  showToast: () => {},
});

export function ToastProvider({ children }) {
  const { theme } = useTheme();
  const [toast, setToast] = useState(null);
  const translateY = useRef(new Animated.Value(-110)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -110,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => setToast(null));
  }, [translateY, opacity]);

  const showToast = useCallback(
    ({ title, message, type = 'success', duration = 3000 }) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast({ title, message, type });
      translateY.setValue(-110);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 20,
          bounciness: 9,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(hideToast, duration);
    },
    [translateY, opacity, hideToast]
  );

  const TONES = {
    success: {
      color: theme.success,
      bg: theme.badgeGreen,
      border: theme.whatsappSoft,
      icon: 'checkmark-circle',
    },
    error: {
      color: theme.danger,
      bg: theme.dangerSoft,
      border: theme.dangerSoft,
      icon: 'alert-circle',
    },
    info: {
      color: theme.accent,
      bg: theme.accentSoft,
      border: theme.accentSoft,
      icon: 'information-circle',
    },
  };

  const tone = toast ? TONES[toast.type] || TONES.success : TONES.success;

  return (
    <ToastContext.Provider value={{ showToast }}>
      <View style={{ flex: 1 }}>
        {children}

        {toast ? (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.toastPortal,
              {
                opacity,
                transform: [{ translateY }],
              },
            ]}
          >
            <Pressable
              onPress={hideToast}
              style={[
                styles.toastCard,
                {
                  backgroundColor: theme.card,
                  borderColor: tone.color,
                },
                shadow,
              ]}
            >
              <View style={[styles.toastIconWrap, { backgroundColor: tone.bg }]}>
                <Ionicons name={tone.icon} size={20} color={tone.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toastTitle, { color: theme.text }]}>
                  {toast.title}
                </Text>
                {toast.message ? (
                  <Text
                    style={[styles.toastMsg, { color: theme.muted }]}
                    numberOfLines={2}
                  >
                    {toast.message}
                  </Text>
                ) : null}
              </View>
              <HeroCloseButton
                size="sm"
                variant="ghost"
                accessibilityLabel="Fermer la notification"
                onPress={hideToast}
              />
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

/* ============================================================================
   9. HERO CLOSE BUTTON (Inspiré de CloseButton de HeroUI Native)
   ============================================================================ */
export function HeroCloseButton({
  onPress,
  variant = 'default',
  size = 'md',
  iconProps = {},
  children,
  isDisabled = false,
  accessibilityLabel = 'Fermer',
  style,
}) {
  const { theme, isDark } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const sizeMap = {
    sm: { box: 28, icon: 16 },
    md: { box: 36, icon: 20 },
    lg: { box: 44, icon: 23 },
  };
  const dims = sizeMap[size] || sizeMap.md;

  const variantStyles = {
    default: {
      bg: isDark ? '#27272A' : '#F4F4F5',
      border: theme.border,
      iconColor: theme.text,
    },
    ghost: {
      bg: 'transparent',
      border: 'transparent',
      iconColor: theme.muted,
    },
    overlay: {
      bg: 'rgba(255, 255, 255, 0.2)',
      border: 'rgba(255, 255, 255, 0.28)',
      iconColor: '#FFFFFF',
    },
    danger: {
      bg: theme.dangerSoft,
      border: isDark ? '#7F1D1D' : '#FECDD3',
      iconColor: theme.danger,
    },
  };
  const v = variantStyles[variant] || variantStyles.default;

  const animateTo = (to) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 32,
      bounciness: 10,
    }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={8}
        onPressIn={() => {
          if (!isDisabled) animateTo(0.88);
        }}
        onPressOut={() => {
          if (!isDisabled) animateTo(1);
        }}
        onPress={() => {
          if (isDisabled) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress?.();
        }}
        style={[
          styles.closeBtnBase,
          {
            width: dims.box,
            height: dims.box,
            borderRadius: dims.box / 2,
            backgroundColor: v.bg,
            borderColor: v.border,
            borderWidth: v.border === 'transparent' ? 0 : 1,
            opacity: isDisabled ? 0.45 : 1,
          },
        ]}
      >
        {children || (
          <Ionicons
            name={iconProps.name || 'close'}
            size={iconProps.size || dims.icon}
            color={iconProps.color || v.iconColor}
          />
        )}
      </Pressable>
    </Animated.View>
  );
}

/* ============================================================================
   10. HERO CARD (Composant Card HeroUI avec sections Header, Body, Footer)
   ============================================================================ */
export function HeroCard({ children, style, isPressable = false, onPress }) {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const bounce = (to) => {
    if (!isPressable) return;
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  };

  const content = (
    <Animated.View
      style={[
        styles.cardBase,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          transform: [{ scale }],
        },
        shadowSoft,
        style,
      ]}
    >
      {children}
    </Animated.View>
  );

  if (isPressable) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={() => bounce(0.98)}
        onPressOut={() => bounce(1)}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

HeroCard.Header = function HeroCardHeader({ children, style }) {
  return <View style={[styles.cardHeader, style]}>{children}</View>;
};

HeroCard.Body = function HeroCardBody({ children, style }) {
  return <View style={[styles.cardBody, style]}>{children}</View>;
};

HeroCard.Footer = function HeroCardFooter({ children, style }) {
  return <View style={[styles.cardFooter, style]}>{children}</View>;
};

/* ============================================================================
   11. HERO SEPARATOR & HERO SURFACE
   ============================================================================ */
export function HeroSeparator({ style }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.separator,
        { backgroundColor: theme.border },
        style,
      ]}
    />
  );
}

export function HeroSurface({ children, style }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.surfaceBase,
        { backgroundColor: theme.surface, borderColor: theme.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* ============================================================================
   12. HERO DIALOG (Modale de dialogue centrée)
   ============================================================================ */
export function HeroDialog({
  visible,
  onClose,
  title,
  description,
  icon,
  iconColor,
  iconBg,
  children,
  maxWidth = 420,
}) {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.dialogBackdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.dialogCard,
            { maxWidth, backgroundColor: theme.card, borderColor: theme.border },
            shadow,
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <HeroCloseButton
            variant="ghost"
            size="sm"
            accessibilityLabel="Fermer"
            onPress={onClose}
            style={styles.dialogCloseBtn}
          />

          {icon ? (
            <View
              style={[
                styles.dialogIconCircle,
                { backgroundColor: iconBg || theme.accentSoft },
              ]}
            >
              <Ionicons
                name={icon}
                size={28}
                color={iconColor || theme.accent}
              />
            </View>
          ) : null}

          {title ? (
            <Text style={[styles.dialogTitle, { color: theme.text }]}>
              {title}
            </Text>
          ) : null}

          {description ? (
            <Text
              style={[styles.dialogDescription, { color: theme.textSecondary }]}
            >
              {description}
            </Text>
          ) : null}

          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ============================================================================
   13. HERO ALERT (Bandeau de notification / alerte HeroUI)
   ============================================================================ */
export function HeroAlert({
  title,
  description,
  variant = 'primary', // 'primary' | 'success' | 'warning' | 'danger'
  style,
}) {
  const { theme } = useTheme();

  const MAP = {
    primary: {
      bg: theme.accentSoft,
      border: theme.accent,
      icon: 'information-circle',
      color: theme.accent,
    },
    success: {
      bg: theme.whatsappSoft,
      border: theme.whatsapp,
      icon: 'checkmark-circle',
      color: theme.whatsapp,
    },
    warning: {
      bg: theme.warningSoft,
      border: theme.warning,
      icon: 'warning',
      color: theme.warning,
    },
    danger: {
      bg: theme.dangerSoft,
      border: theme.danger,
      icon: 'alert-circle',
      color: theme.danger,
    },
  };

  const m = MAP[variant] || MAP.primary;

  return (
    <View
      style={[
        styles.alertBox,
        {
          backgroundColor: m.bg,
          borderColor: `${m.border}44`,
        },
        style,
      ]}
    >
      <Ionicons
        name={m.icon}
        size={20}
        color={m.color}
        style={{ marginRight: 10, marginTop: 1 }}
      />
      <View style={{ flex: 1 }}>
        {title ? (
          <Text style={[styles.alertTitle, { color: m.color }]}>{title}</Text>
        ) : null}
        {description ? (
          <Text
            style={[
              styles.alertDesc,
              { color: theme.textSecondary, marginTop: title ? 2 : 0 },
            ]}
          >
            {description}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export { default as HeroButton, useButton } from './Button';

const styles = StyleSheet.create({
  closeBtnBase: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarZoomIcon: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarStatusDot: {
    position: 'absolute',
    left: -2,
    bottom: -2,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '800',
  },
  switchTrack: {
    width: 50,
    height: 28,
    borderRadius: 999,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabsWrap: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    position: 'relative',
    alignItems: 'center',
  },
  tabCursor: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 5,
    borderRadius: radius.sm,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    zIndex: 1,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    borderWidth: 1.5,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 11,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.68)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheetCard: {
    width: '100%',
    maxHeight: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  sheetHandleZone: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
  },
  skeletonCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 15,
    marginBottom: 14,
  },
  skeletonTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toastPortal: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 48,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastCard: {
    width: '100%',
    maxWidth: 440,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toastIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  toastMsg: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  cardBase: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cardFooter: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },
  separator: {
    height: 1,
    width: '100%',
    marginVertical: 12,
  },
  surfaceBase: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 14,
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogCard: {
    width: '100%',
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
    position: 'relative',
  },
  dialogCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  dialogIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  dialogDescription: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 18,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 12,
    marginVertical: 8,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  alertDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
});
