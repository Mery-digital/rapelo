import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, TABLE, isSupabaseConfigured } from './supabase';

/**
 * If Supabase is configured (.env), tickets go to the `fiches_reparation` table.
 * Otherwise the app runs in DEMO mode: tickets are stored on the phone only.
 */
export const isDemoMode = !isSupabaseConfigured;

const DEMO_KEY = 'rapelo.demo.fiches.v1';

async function demoLoad() {
  try {
    const raw = await AsyncStorage.getItem(DEMO_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function demoSave(list) {
  await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(list));
}

/** Tickets belonging to the workshop (in repair, ready, unrepaired, or delivered). */
export async function fetchRepairs(atelierTel) {
  if (isDemoMode) {
    const all = await demoLoad();
    return all
      .filter(
        (f) =>
          f.atelier_tel === atelierTel &&
          ['en_cours', 'pret', 'non_repare', 'livre'].includes(f.statut)
      )
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('atelier_tel', atelierTel)
    .in('statut', ['en_cours', 'pret', 'non_repare', 'livre'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createRepair(fiche) {
  if (isDemoMode) {
    const all = await demoLoad();
    const created = { ...fiche, id: Date.now(), created_at: new Date().toISOString() };
    await demoSave([created, ...all]);
    return created;
  }
  const { data, error } = await supabase.from(TABLE).insert(fiche).select().single();
  if (error) throw error;
  return data;
}

export async function updateRepairStatus(id, statut) {
  const patch = { statut };
  if (statut === 'pret') patch.pret_le = new Date().toISOString();
  if (statut === 'livre') patch.livre_le = new Date().toISOString();

  return updateRepair(id, patch);
}

export async function updateRepair(id, patch) {
  if (isDemoMode) {
    const all = await demoLoad();
    let updated = null;
    const next = all.map((f) => {
      if (f.id !== id) return f;
      updated = { ...f, ...patch };
      return updated;
    });
    await demoSave(next);
    if (!updated) throw new Error('Fiche introuvable.');
    return updated;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRepair(id) {
  if (isDemoMode) {
    const all = await demoLoad();
    await demoSave(all.filter((f) => f.id !== id));
    return true;
  }
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function deleteRepairsByIds(ids = []) {
  if (!ids.length) return true;
  if (isDemoMode) {
    const idSet = new Set(ids);
    const all = await demoLoad();
    await demoSave(all.filter((f) => !idSet.has(f.id)));
    return true;
  }
  const { error } = await supabase.from(TABLE).delete().in('id', ids);
  if (error) throw error;
  return true;
}

export async function syncAtelierRepairs(oldAtelierTel, newAtelierTel, newAtelierNom) {
  if (!oldAtelierTel) return;
  const patch = {
    atelier_tel: newAtelierTel,
    atelier_nom: newAtelierNom,
  };
  if (isDemoMode) {
    const all = await demoLoad();
    const next = all.map((f) =>
      f.atelier_tel === oldAtelierTel ? { ...f, ...patch } : f
    );
    await demoSave(next);
    return;
  }
  await supabase.from(TABLE).update(patch).eq('atelier_tel', oldAtelierTel);
}
