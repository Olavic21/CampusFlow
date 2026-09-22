import { parseApiError } from '../utils/parseApiError';
import { getStoredTokens } from './authApi';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

async function profileRequest(path, options = {}) {
  const { access } = getStoredTokens();
  const headers = { Accept: 'application/json', ...options.headers };
  if (access && !options.skipAuth) {
    headers.Authorization = `Bearer ${access}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    throw new Error(parseApiError(data, res.status));
  }
  return data;
}

export async function getProfile() {
  return profileRequest('/profile');
}

export async function uploadAvatar(blob, filename = 'avatar.webp') {
  const form = new FormData();
  form.append('file', blob, filename);
  return profileRequest('/profile/avatar', {
    method: 'POST',
    body: form,
  });
}

export async function deleteAvatar() {
  return profileRequest('/profile/avatar', { method: 'DELETE' });
}
