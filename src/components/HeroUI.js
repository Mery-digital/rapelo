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
        onPressIn={() => bounce(0.94)}
        onPressOut={() => bounce(1)}
      >
        {inner}
      </Pressable>
    );
  }
  return inner;
}

/* ============================================================================
   2. HERO CHIP (Badge moderne flat / dot / bordered)
   ============================================================================ */
export function HeroChip({
  label,
  icon,
  color = 'primary', // 'primary' | 'success' | 'danger' | 'warning' | 'neutral'
  variant = 'flat', // 'flat' | 'solid' | 'dot'
  pulse = false,
  animatedIcon = null,
  style,
}) {
  const { theme } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.35,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, pulseAnim]);

  const palette = {
    primary: { fg: theme.accent, bg: theme.badgeBlue, solid: theme.accent },
    success: { fg: theme.success, bg: theme.badgeGreen, solid: theme.whatsapp },
    danger: { fg: theme.danger, bg: theme.badgeRed, solid: theme.danger },
    warning: { fg: theme.warningDark, bg: theme.badgeAmber, solid: theme.warning },
    neutral: {
      fg: theme.textSecondary,
      bg: theme.chipNeutralBg,
      solid: theme.textSecondary,
    },
  }[color] || { fg: theme.accent, bg: theme.badgeBlue, solid: theme.accent };

  const isSolid = variant === 'solid';
  const textColor = isSolid ? '#FFFFFF' : palette.fg;

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: isSolid ? palette.solid : palette.bg,
          borderColor: isSolid ? palette.solid : `${palette.fg}25`,
        },
        style,
      ]}
    >
      {variant === 'dot' || pulse ? (
        <Animated.View
          style={[
            styles.chipDot,
            {
              backgroundColor: textColor,
              transform: [{ scale: pulse ? pulseAnim : 1 }],
            },
          ]}
        />
      ) : null}

      {icon ? (
        <Animated.View style={animatedIcon || undefined}>
          <Ionicons
            name={icon}
            size={13}
            color={textColor}
            style={{ marginRight: 5 }}
          />
        </Animated.View>
      ) : null}

      <Text style={[styles.chipText, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/* ============================================================================
   3. HERO SWITCH (Interrupteur Jour / Nuit animé)
   ============================================================================ */
export function HeroSwitch({ value, onValueChange, activeColor }) {
  const { theme } = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0,
      useNativeDriver: false,
      speed: 24,
      bounciness: 10,
    }).start();
  }, [value, anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 25],
  });

  const trackBg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.border, activeColor || theme.accent],
  });

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onValueChange?.(!value);
      }}
      hitSlop={8}
    >
      <Animated.View style={[styles.switchTrack, { backgroundColor: trackBg }]}>
        <Animated.View
          style={[styles.switchThumb, { transform: [{ translateX }] }]}
        >
          <Ionicons
            name={value ? 'moon' : 'sunny'}
            size={12}
            color={value ? theme.accent : '#F59E0B'}
          />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

/* ============================================================================
   4. HERO TABS (Curseur glissant animé style HeroUI)
   ============================================================================ */
export function HeroTabs({ items, activeKey, onChange }) {
  const { theme } = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);
  const activeIdx = Math.max(
    0,
    items.findIndex((i) => i.key === activeKey)
  );
  const pillX = useRef(new Animated.Value(0)).current;

  const padding = 5;
  const tabWidth =
    containerWidth > 0 ? (containerWidth - padding * 2) / items.length : 0;

  useEffect(() => {
    if (tabWidth <= 0) return;
    Animated.spring(pillX, {
      toValue: activeIdx * tabWidth,
      useNativeDriver: true,
      speed: 24,
      bounciness: 9,
    }).start();
  }, [activeIdx, tabWidth, pillX]);

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
   5. HERO SEARCH FIELD (Champ de recherche animé au focus)
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
   6. HERO BOTTOM SHEET (Panneau glissant depuis le bas avec poignée HeroUI)
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
   7. HERO SKELETON (Aperçu de chargement animé style HeroUI)
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
        <HeroSkeleton width={56} height={56} borderRadius={18} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <HeroSkeleton width="60%" height={18} borderRadius={6} />
          <HeroSkeleton
            width="42%"
            height={13}
            borderRadius={6}
            style={{ marginTop: 8 }}
          />
          <HeroSkeleton
            width="52%"
            height={22}
            borderRadius={11}
            style={{ marginTop: 8 }}
          />
        </View>
      </View>
      <HeroSkeleton
        width="100%"
        height={34}
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
   8. HERO TOAST (Notifications flottantes en haut de l'écran)
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

  const tone =
    toast?.type === 'danger'
      ? { color: theme.danger, bg: theme.dangerSoft, icon: 'alert-circle' }
      : toast?.type === 'warning'
      ? { color: theme.warning, bg: theme.warningSoft, icon: 'notifications' }
      : toast?.type === 'info'
      ? { color: theme.accent, bg: theme.accentSoft, icon: 'information-circle' }
      : { color: theme.success, bg: theme.badgeGreen, icon: 'checkmark-circle' };

  return (
    <ToastContext.Provider value={{ showToast }}>
      <View style={{ flex: 1 }}>
        {children}

        {toast ? (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.toastPortal,
              { opacity, transform: [{ translateY }] },
            ]}
          >
            <Pressable
              onPress={hideToast}
              style={[
                styles.toastCard,
                {
                  backgroundColor: theme.card,
                  borderColor: `${tone.color}55`,
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
  searchClear: {
    padding: 4,
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
});
