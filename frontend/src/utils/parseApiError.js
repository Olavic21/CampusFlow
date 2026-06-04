const FRENCH_HINTS = {
  'value is not a valid email address': 'Adresse email invalide',
  'String should have at least 8 characters': 'Mot de passe trop faible (8 caractères minimum)',
  'Les mots de passe ne correspondent pas': 'Les mots de passe ne correspondent pas',
};

/**
 * Extrait un message lisible depuis les réponses FastAPI / CampusFlow.
 */
export function parseApiError(data, status = 0) {
  if (!data) {
    if (status === 0) return 'Serveur injoignable — vérifiez que le backend tourne sur le port 8000';
    return `Erreur ${status}`;
  }

  if (typeof data.detail === 'string') {
    return data.detail;
  }

  if (Array.isArray(data.detail)) {
    return data.detail
      .map((item) => {
        if (typeof item === 'string') return item;
        const raw = item.msg || item.message || String(item);
        const field = item.loc?.filter((x) => x !== 'body').pop();
        const hint = FRENCH_HINTS[raw] || raw;
        return field ? `${field}: ${hint}` : hint;
      })
      .join('. ');
  }

  if (data.error?.message) return data.error.message;
  if (typeof data.message === 'string') return data.message;

  return `Erreur ${status || 'inconnue'}`;
}
