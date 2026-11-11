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

/** Tickets that are still in the shop (in repair or ready). */
export async function fetchRepairs(atelierTel) {
  if (isDemoMode) {
    const all = await demoLoad();
    return all
      .filter((f) => f.atelier_tel === atelierTel && ['en_cours', 'pret'].includes(f.statut))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('atelier_tel', atelierTel)
    .in('statut', ['en_cours', 'pret'])
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
