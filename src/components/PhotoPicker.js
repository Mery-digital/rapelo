import React, { useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Button from './Button';
import {
  HeroCard,
  HeroChip,
  HeroCloseButton,
  HeroSurface,
} from './HeroUI';
import { useTheme } from '../context/ThemeContext';
import { radius, shadowSoft } from '../theme';
import { pickDevicePhoto } from '../lib/photos';

export default function PhotoPicker({ uri, onChange }) {
  const { theme, isDark } = useTheme();
  const scaleCam = useRef(new Animated.Value(1)).current;
  const scaleGal = useRef(new Animated.Value(1)).current;

  const bounce = (anim, to) =>
    Animated.spring(anim, {
      toValue: to,
      useNativeDriver: true,
      speed: 30,
      bounciness: 10,
    }).start();

  const openDirect = async (source) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const pickedUri = await pickDevicePhoto(source);
    if (pickedUri) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onChange?.(pickedUri);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <HeroChip
          icon="camera"
          label="PHOTO DE L’APPAREIL"
          color={theme.accent}
          variant="flat"
          size="sm"
        />
        <Text style={[styles.optional, { color: theme.muted }]}>
          Optionnel (Preuve d’état)
        </Text>
      </View>

      {uri ? (
        <HeroCard style={styles.previewCard}>
          <Image source={{ uri }} style={styles.previewImage} resizeMode="cover" />

          <HeroCloseButton
            variant="overlay"
            size="md"
            accessibilityLabel="Retirer la photo"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onChange?.(null);
            }}
            style={styles.removeCloseBtn}
          />

          <View style={[styles.previewActions, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Button
              size="sm"
              variant="tertiary"
              icon="camera-outline"
              title="Reprendre"
              onPress={() => openDirect('camera')}
            />
            <View style={{ width: 8 }} />
            <Button
              size="sm"
              variant="tertiary"
              icon="images-outline"
              title="Galerie"
              onPress={() => openDirect('gallery')}
            />
          </View>
        </HeroCard>
      ) : (
        <HeroSurface style={[styles.pickerBox, { borderColor: isDark ? '#3F3F46' : '#CBD5E1' }]}>
          <Text style={[styles.pickerTitle, { color: theme.text }]}>
            Prendre en photo l’appareil déposé
          </Text>
          <Text style={[styles.pickerHint, { color: theme.muted }]}>
            Garde une preuve de l’état de l’écran, de la coque ou du connecteur.
          </Text>

          <View style={styles.btnRow}>
            <Animated.View style={[styles.flex, { transform: [{ scale: scaleCam }] }]}>
              <Button
                size="md"
                variant="primary"
                feedbackVariant="scale-ripple"
                icon="camera"
                title="Appareil photo"
                subtitle="Prendre en direct"
                onPress={() => openDirect('camera')}
                onPressIn={() => bounce(scaleCam, 0.94)}
                onPressOut={() => bounce(scaleCam, 1)}
              />
            </Animated.View>

            <View style={{ width: 10 }} />

            <Animated.View style={[styles.flex, { transform: [{ scale: scaleGal }] }]}>
              <Button
                size="md"
                variant="outline"
                feedbackVariant="scale-highlight"
                icon="images-outline"
                title="Galerie"
                subtitle="Choisir un fichier"
                onPress={() => openDirect('gallery')}
                onPressIn={() => bounce(scaleGal, 0.94)}
                onPressOut={() => bounce(scaleGal, 1)}
              />
            </Animated.View>
          </View>
        </HeroSurface>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  optional: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  previewCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 190,
  },
  removeCloseBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
  },
  previewActions: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
  },
  pickerBox: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: 16,
    alignItems: 'center',
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  pickerHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 3,
    marginBottom: 14,
    lineHeight: 16,
    paddingHorizontal: 8,
  },
  btnRow: {
    flexDirection: 'row',
    width: '100%',
  },
  flex: {
    flex: 1,
  },
});
