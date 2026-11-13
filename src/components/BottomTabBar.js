import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '../context/NavigationContext';

export default function BottomTabBar({ activeCount = 0 }) {
  const { theme, isDark } = useTheme();
  const { activeTab, switchTab } = useNavigation();

  const TABS = [
    {
      key: 'repairs',
      label: 'Banc Atelier',
      iconInactive: 'construct-outline',
      iconActive: 'construct',
      badge: activeCount > 0 ? activeCount : null,
    },
    {
      key: 'new',
      label: 'Nouveau dépôt',
      iconInactive: 'add-circle-outline',
      iconActive: 'add-circle',
      isCenterAction: true,
    },
    {
      key: 'workshop',
      label: 'Mon Atelier',
      iconInactive: 'storefront-outline',
      iconActive: 'storefront',
    },
  ];

  return (
    <View
      style={[
        styles.barContainer,
        {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
        },
      ]}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const color = isActive ? theme.accent : theme.muted;

        if (tab.isCenterAction) {
          return (
            <Pressable
              key={tab.key}
              onPress={() => switchTab(tab.key)}
              style={styles.tabBtn}
            >
              <View
                style={[
                  styles.centerActionCircle,
                  {
                    backgroundColor: isActive ? theme.accentDark : theme.accent,
                    shadowColor: theme.accent,
                  },
                ]}
              >
                <Ionicons name="add" size={26} color="#FFFFFF" />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  { color, fontWeight: isActive ? '900' : '700' },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={tab.key}
            onPress={() => switchTab(tab.key)}
            style={styles.tabBtn}
          >
            <View style={styles.iconWrap}>
              <Ionicons
                name={isActive ? tab.iconActive : tab.iconInactive}
                size={22}
                color={color}
              />
              {tab.badge ? (
                <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                  <Text style={styles.badgeText}>{tab.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[
                styles.tabLabel,
                { color, fontWeight: isActive ? '900' : '600' },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: Platform.OS === 'ios' ? 76 : 64,
    paddingBottom: Platform.OS === 'ios' ? 18 : 6,
    paddingTop: 6,
    borderTopWidth: 1,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
  },
  centerActionCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  tabLabel: {
    fontSize: 10.5,
    marginTop: 2,
  },
});
