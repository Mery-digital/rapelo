import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { radius, shadowSoft } from '../theme';
import { pickDevicePhoto } from '../lib/photos';

export default function PhotoPicker({ uri, onChange }) {
  const { theme, isDark } = useTheme();
  const scaleCam = useRef(new Animated.Value(1)).current;
  const scaleGal = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const bounce = (anim, to) =>
    Animated.spring(anim, {
      toValue: to,
      useNativeDriver: true,
      speed: 30,
      bounciness: 12,
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
        <View style={[styles.titleBadge, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name="camera" size={14} color={theme.accent} />
          <Text style={[styles.label, { color: theme.accent }]}>
            PHOTO DE L'APPAREIL
          </Text>
        </View>
        <Text style={[styles.optional, { color: theme.muted }]}>
          Caméra directe
        </Text>
      </View>

      {uri ? (
        <View style={styles.previewCard}>
          <Image source={{ uri }} style={styles.previewImage} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(15,23,42,0.65)', 'transparent']}
            style={styles.previewTopOverlay}
          >
            <View style={styles.previewTag}>
              <Ionicons name="checkmark-circle" size={15} color="#FFFFFF" />
              <Text style={styles.previewTagText}>Photo de l'appareil prête</Text>
            </View>
          </LinearGradient>

          <View
            style={[
              styles.previewActions,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <Pressable
              onPress={() => openDirect('camera')}
              style={[styles.smallBtn, { backgroundColor: theme.surface }]}
            >
              <Ionicons name="camera-outline" size={16} color={theme.accent} />
              <Text style={[styles.smallBtnText, { color: theme.text }]}>
                Reprendre
              </Text>
            </Pressable>
            <Pressable
              onPress={() => openDirect('gallery')}
              style={[styles.smallBtn, { backgroundColor: theme.surface }]}
            >
              <Ionicons name="images-outline" size={16} color={theme.text} />
              <Text style={[styles.smallBtnText, { color: theme.text }]}>
                Galerie
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onChange?.(null);
              }}
              style={[styles.smallBtn, { backgroundColor: theme.dangerSoft }]}
            >
              <Ionicons name="trash-outline" size={16} color={theme.danger} />
              <Text style={[styles.removeBtnText, { color: theme.danger }]}>
                Retirer
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <LinearGradient
          colors={isDark ? ['#18181B', '#27272A'] : ['#EFF6FF', '#F8FAFC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.pickerBox,
            { borderColor: isDark ? '#338EF7' : '#93C5FD' },
          ]}
        >
          <Text style={[styles.pickerTitle, { color: theme.text }]}>
            Photographie l'appareil électronique déposé
          </Text>
          <Text style={[styles.pickerHint, { color: theme.muted }]}>
            Ouvre directement l'appareil photo de ton téléphone pour garder une preuve de l'état.
          </Text>

          <View style={styles.btnRow}>
            <Animated.View style={[styles.flex, { transform: [{ scale: scaleCam }] }]}>
              <Pressable
                onPress={() => openDirect('camera')}
                onPressIn={() => bounce(scaleCam, 0.93)}
                onPressOut={() => bounce(scaleCam, 1)}
              >
                <LinearGradient
                  colors={['#006FEE', '#004493']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.pickBtn}
                >
                  <Animated.View
                    style={[styles.camIconCircle, { transform: [{ scale: pulse }] }]}
                  >
                    <Ionicons name="camera" size={26} color="#FFFFFF" />
                  </Animated.View>
                  <Text style={styles.camBtnTitle}>Prendre une photo</Text>
                  <Text style={styles.camBtnSub}>Caméra du téléphone</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>

            <View style={{ width: 12 }} />

            <Animated.View style={[styles.flex, { transform: [{ scale: scaleGal }] }]}>
              <Pressable
                onPress={() => openDirect('gallery')}
                onPressIn={() => bounce(scaleGal, 0.93)}
                onPressOut={() => bounce(scaleGal, 1)}
                style={[
                  styles.pickBtn,
                  {
                    backgroundColor: theme.card,
                    borderWidth: 1.5,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View
                  style={[styles.camIconCircle, { backgroundColor: theme.accentSoft }]}
                >
                  <Ionicons name="images" size={24} color={theme.accent} />
                </View>
                <Text style={[styles.galBtnTitle, { color: theme.text }]}>
                  Galerie photo
                </Text>
                <Text style={[styles.galBtnSub, { color: theme.muted }]}>
                  Choisir une image
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  flex: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  label: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
    marginLeft: 6,
  },
  optional: { fontSize: 12, fontWeight: '600' },
  pickerBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    padding: 16,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  pickerHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  btnRow: { flexDirection: 'row' },
  pickBtn: {
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 126,
    ...shadowSoft,
  },
  camIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  camBtnTitle: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  camBtnSub: { fontSize: 11, color: '#DBEAFE', marginTop: 2, textAlign: 'center' },
  galBtnTitle: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  galBtnSub: { fontSize: 11, marginTop: 2, textAlign: 'center' },
  previewCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    ...shadowSoft,
  },
  previewImage: {
    width: '100%',
    height: 215,
  },
  previewTopOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  previewTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(23, 201, 100, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  previewTagText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', marginLeft: 5 },
  previewActions: {
    flexDirection: 'row',
    padding: 8,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  smallBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 9,
    marginHorizontal: 3,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: { fontSize: 13, fontWeight: '700', marginLeft: 5 },
  removeBtnText: { fontSize: 13, fontWeight: '700', marginLeft: 5 },
});
