import localforage from 'localforage';
import campusFallback from '../data/campus.json';
import capteursData from '../data/capteurs.json';

const store = localforage.createInstance({ name: 'campusflow', storeName: 'offline' });

const KEYS = {
  BUILDINGS: 'buildings',
  CAPTEURS: 'capteurs',
  PREFS: 'preferences',
  CACHED_AT: 'cached_at',
};

export async function cacheBuildings(buildings) {
  if (!buildings?.length) return;
  await store.setItem(KEYS.BUILDINGS, buildings);
  await store.setItem(KEYS.CACHED_AT, new Date().toISOString());
}

export async function getCachedBuildings() {
  const cached = await store.getItem(KEYS.BUILDINGS);
  return cached?.length ? cached : campusFallback;
}

export async function getOfflineCapteurs() {
  const cached = await store.getItem(KEYS.CAPTEURS);
  return cached?.length ? cached : capteursData;
}

export async function savePreferences(prefs) {
  await store.setItem(KEYS.PREFS, prefs);
}

export async function loadPreferences() {
  return (await store.getItem(KEYS.PREFS)) || {};
}

export async function seedOfflineData() {
  await store.setItem(KEYS.BUILDINGS, campusFallback);
  await store.setItem(KEYS.CAPTEURS, capteursData);
}
