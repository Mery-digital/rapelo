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
import { colors, radius, shadowSoft } from '../theme';
import { pickDevicePhoto } from '../lib/photos';

export default function PhotoPicker({ uri, onChange }) {
  const scaleCam = useRef(new Animated.Value(1)).current;
  const scaleGal = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  // Subtle breathing animation on the camera icon to draw attention
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

  // Directly launches the phone's native camera app (`launchCameraAsync`)
  // or native photo gallery (`launchImageLibraryAsync`)
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
        <View style={styles.titleBadge}>
          <Ionicons name="camera" size={14} color={colors.accent} />
          <Text style={styles.label}>PHOTO DE L'APPAREIL</Text>
        </View>
        <Text style={styles.optional}>Caméra directe</Text>
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

          <View style={styles.previewActions}>
            <Pressable onPress={() => openDirect('camera')} style={styles.smallBtn}>
              <Ionicons name="camera-outline" size={16} color={colors.accent} />
              <Text style={styles.smallBtnText}>Reprendre</Text>
            </Pressable>
            <Pressable onPress={() => openDirect('gallery')} style={styles.smallBtn}>
              <Ionicons name="images-outline" size={16} color={colors.text} />
              <Text style={styles.smallBtnText}>Galerie</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onChange?.(null);
              }}
              style={[styles.smallBtn, styles.removeBtn]}
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={styles.removeBtnText}>Retirer</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <LinearGradient
          colors={['#EFF6FF', '#F8FAFC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.pickerBox}
        >
          <Text style={styles.pickerTitle}>
            Photographie l'appareil électronique déposé
          </Text>
          <Text style={styles.pickerHint}>
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
                  colors={['#2563EB', '#1D4ED8']}
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
                style={[styles.pickBtn, styles.galBtn]}
              >
                <View style={[styles.camIconCircle, { backgroundColor: colors.accentSoft }]}>
                  <Ionicons name="images" size={24} color={colors.accent} />
                </View>
                <Text style={styles.galBtnTitle}>Galerie photo</Text>
                <Text style={styles.galBtnSub}>Choisir une image</Text>
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
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  label: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: 0.7,
    marginLeft: 6,
  },
  optional: { fontSize: 12, fontWeight: '600', color: colors.muted },
  pickerBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#93C5FD',
    borderRadius: radius.lg,
    padding: 16,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  pickerHint: {
    fontSize: 12,
    color: colors.muted,
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
  galBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.border,
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
  galBtnTitle: { fontSize: 14, fontWeight: '800', color: colors.text, textAlign: 'center' },
  galBtnSub: { fontSize: 11, color: colors.muted, marginTop: 2, textAlign: 'center' },
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
    backgroundColor: 'rgba(22, 163, 74, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  previewTagText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', marginLeft: 5 },
  previewActions: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 8,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.border,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  smallBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 9,
    marginHorizontal: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: { fontSize: 13, fontWeight: '700', color: colors.text, marginLeft: 5 },
  removeBtn: { backgroundColor: colors.dangerSoft },
  removeBtnText: { fontSize: 13, fontWeight: '700', color: colors.danger, marginLeft: 5 },
});
