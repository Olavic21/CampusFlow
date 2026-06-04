/** Initiales pour avatar par défaut (ex. Victoire Aimé → VA) */
export function getInitials(name, username) {
  const source = (name || username || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

/** Résout l'URL d'affichage (proxy /media en dev, Capacitor-ready) */
export function getAvatarUrl(avatar) {
  if (!avatar) return null;
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar;
  }
  if (avatar.startsWith('/')) return avatar;
  return `/media/${avatar.replace(/^\//, '')}`;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_BYTES = 5 * 1024 * 1024;

export function validateAvatarFile(file) {
  if (!file) return 'Aucun fichier sélectionné';
  const ext = (file.name || '').toLowerCase().match(/\.[^.]+$/)?.[0] || '';
  if (ext && !ALLOWED_EXT.includes(ext)) {
    return 'Format non supporté';
  }
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    return 'Format non supporté';
  }
  if (file.size > MAX_BYTES) {
    return 'Image trop volumineuse (5 Mo maximum)';
  }
  return null;
}
