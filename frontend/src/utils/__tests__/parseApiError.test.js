import { describe, it, expect } from 'vitest';
import { parseApiError } from '../parseApiError';

describe('parseApiError', () => {
  it('reads string detail', () => {
    expect(parseApiError({ detail: 'Adresse email déjà utilisée' }, 400)).toBe(
      'Adresse email déjà utilisée',
    );
  });

  it('reads nested error.message', () => {
    expect(parseApiError({ error: { message: 'Email ou mot de passe incorrect' } }, 401)).toBe(
      'Email ou mot de passe incorrect',
    );
  });

  it('formats validation array', () => {
    const msg = parseApiError(
      { detail: [{ loc: ['body', 'password'], msg: 'String should have at least 8 characters' }] },
      422,
    );
    expect(msg).toContain('Mot de passe trop faible');
  });
});
