import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { Animated, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';

const NavigationContext = createContext(null);

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error('useNavigation doit être utilisé dans un <NavigationProvider>');
  }
  return ctx;
}

export function NavigationProvider({ children, initialTab = 'repairs' }) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'repairs' | 'new' | 'workshop'
  const [stack, setStack] = useState([{ name: 'tabs', params: {} }]);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const currentRoute = stack[stack.length - 1] || { name: 'tabs', params: {} };
  const canGoBack = stack.length > 1;

  const navigate = useCallback(
    (name, params = {}) => {
      Haptics.selectionAsync().catch(() => {});
      slideAnim.setValue(1);

      setStack((prev) => [...prev, { name, params }]);

      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [slideAnim]
  );

  const goBack = useCallback(() => {
    if (stack.length <= 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setStack((prev) => prev.slice(0, prev.length - 1));
      slideAnim.setValue(0);
    });
  }, [stack.length, slideAnim]);

  const switchTab = useCallback(
    (tab) => {
      Haptics.selectionAsync().catch(() => {});
      setActiveTab(tab);
      // Reset stack to root tabs when changing tab
      setStack([{ name: 'tabs', params: {} }]);
    },
    []
  );

  return (
    <NavigationContext.Provider
      value={{
        currentRoute,
        canGoBack,
        navigate,
        goBack,
        activeTab,
        switchTab,
        slideAnim,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}
