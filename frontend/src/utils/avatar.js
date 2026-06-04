/** Initiales pour avatar par défaut (ex. Victoire Aimé → VA) */
export function getInitials(name, username) {
  const source = (name || username || '?').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

const BACKEND_DIRECT = (import.meta.env.VITE_BACKEND_DIRECT || 'http://127.0.0.1:8000').replace(
  /\/$/,
  '',
);

function appendCacheBust(url, key) {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}cb=${encodeURIComponent(key)}`;
}

/**
 * Résout l'URL d'affichage (proxy /media en dev, backend direct en secours).
 * @param {string | null | undefined} avatar
 * @param {{ bustCache?: boolean, preferDirect?: boolean }} [opts]
 */
export function getAvatarUrl(avatar, opts = {}) {
  const { bustCache = true, preferDirect = false } = opts;
  if (!avatar || typeof avatar !== 'string') return null;

  let path = avatar.trim();
  if (!path) return null;

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return bustCache ? appendCacheBust(path, path) : path;
  }

  if (!path.startsWith('/')) {
    path = path.startsWith('media/') ? `/${path}` : `/media/${path.replace(/^\//, '')}`;
  } else if (!path.startsWith('/media/') && path.startsWith('/avatars/')) {
    path = `/media${path}`;
  }

  const base = preferDirect ? BACKEND_DIRECT : '';
  const url = `${base}${path}`;
  return bustCache ? appendCacheBust(url, path) : url;
}

/** URL directe vers le backend (si le proxy /media échoue). */
export function getAvatarUrlDirect(avatar) {
  return getAvatarUrl(avatar, { preferDirect: true });
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
