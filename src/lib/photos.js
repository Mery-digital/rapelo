import * as ImagePicker from 'expo-image-picker';
import { File, Directory, Paths } from 'expo-file-system';
import { Alert, Platform } from 'react-native';
import { supabase, isSupabaseConfigured } from './supabase';

const PHOTO_BUCKET = 'photos_appareils';

/**
 * Copy a picked or captured photo from the temporary cache into the app's
 * permanent document folder so it stays available after app restarts.
 */
export function savePhotoLocally(tempUri) {
  if (Platform.OS === 'web') return tempUri;
  try {
    const dir = new Directory(Paths.document, 'rapelo_photos');
    if (!dir.exists) {
      dir.create({ idempotent: true });
    }
    const src = new File(tempUri);
    const ext = src.extension || '.jpg';
    const dest = new File(dir, `appareil_${Date.now()}${ext}`);
    src.copySync(dest);
    return dest.uri;
  } catch {
    return tempUri;
  }
}

/**
 * Open camera (`camera`) or gallery (`gallery`) and return a local photo URI,
 * or `null` if the user cancelled.
 */
export async function pickDevicePhoto(source = 'camera') {
  try {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Accès caméra refusé',
          "Autorise l'accès à la caméra dans les réglages du téléphone pour photographier l'appareil."
        );
        return null;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: false,
      });
      if (res.canceled || !res.assets?.[0]?.uri) return null;
      return savePhotoLocally(res.assets[0].uri);
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Accès photos refusé',
        "Autorise l'accès à ta galerie dans les réglages du téléphone."
      );
      return null;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });
    if (res.canceled || !res.assets?.[0]?.uri) return null;
    return savePhotoLocally(res.assets[0].uri);
  } catch (e) {
    Alert.alert('Photo impossible', e?.message || "Impossible d'ouvrir la caméra.");
    return null;
  }
}

/**
 * If Supabase is configured, try uploading the photo to the `photos_appareils`
 * bucket and return its public URL. If the bucket does not exist or there is
 * no network, keep the local URI so the photo still works on this phone.
 */
export async function persistPhotoUri(localUri, atelierTel) {
  if (!localUri) return null;
  if (!isSupabaseConfigured) return localUri;
  try {
    let body;
    let ext = 'jpg';
    let contentType = 'image/jpeg';
    if (Platform.OS === 'web') {
      // On web, the picker returns a blob:/data: URL
      const blob = await (await fetch(localUri)).blob();
      contentType = blob.type || contentType;
      ext = (contentType.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      body = blob;
    } else {
      const file = new File(localUri);
      if (!file.exists) return localUri;
      body = await file.bytes();
      ext = (file.extension || '.jpg').replace('.', '') || 'jpg';
      contentType = file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    }
    const path = `${atelierTel || 'atelier'}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, body, {
      contentType,
      upsert: false,
    });
    if (error) return localUri;
    const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
    return data?.publicUrl || localUri;
  } catch {
    return localUri;
  }
}
