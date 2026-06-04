import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, CheckCircle2, AlertTriangle } from 'lucide-react';
import AuthLayout from './AuthLayout';
import { useAuth } from '../../context/AuthContext';
import { checkAuthBackend } from '../../services/authApi';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const { register, setAuthView } = useAuth();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    username: '',
    password: '',
    password_confirm: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiOk, setApiOk] = useState(null);
  const submitting = useRef(false);

  useEffect(() => {
    let cancelled = false;
    checkAuthBackend().then((h) => {
      if (!cancelled) setApiOk(h.ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting.current || loading) return;
    setError('');
    setSuccess(false);

    if (!form.full_name.trim()) {
      setError('Indiquez votre nom complet');
      return;
    }
    if (!EMAIL_RE.test(form.email.trim())) {
      setError('Adresse email invalide');
      return;
    }
    if (form.username.trim().length < 3) {
      setError("Le nom d'utilisateur doit contenir au moins 3 caractères");
      return;
    }
    if (form.password.length < 8) {
      setError('Mot de passe trop faible (8 caractères minimum)');
      return;
    }
    if (form.password !== form.password_confirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    submitting.current = true;
    setLoading(true);
    try {
      await register({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        username: form.username.trim(),
        password: form.password,
        password_confirm: form.password_confirm,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Impossible de créer le compte');
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  return (
    <AuthLayout title="Inscription" subtitle="Rejoignez CampusFlow Lite — SUP'PTIC">
      {apiOk === false && (
        <p className="text-sm text-amber-800 bg-amber-50 dark:bg-amber-950/40 rounded-xl px-3 py-2 mb-3 flex gap-2 items-start">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            L&apos;API ne répond pas. Dans un terminal PowerShell, à la racine du projet :{' '}
            <code className="text-xs bg-amber-100/80 px-1 rounded">.\scripts\restart-backend.ps1</code>
            puis rechargez cette page.
          </span>
        </p>
      )}
      {apiOk === true && (
        <p className="text-xs text-emerald-600 mb-3">API connectée — vous pouvez créer un compte</p>
      )}
      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        {[
          ['full_name', 'Nom complet', 'text'],
          ['email', 'Adresse email', 'email'],
          ['username', "Nom d'utilisateur", 'text'],
          ['password', 'Mot de passe', 'password'],
          ['password_confirm', 'Confirmation', 'password'],
        ].map(([key, label, type]) => (
          <div key={key}>
            <label htmlFor={key} className="cf-menu-label">
              {label}
            </label>
            <input
              id={key}
              type={type}
              value={form[key]}
              onChange={update(key)}
              className="cf-menu-input mt-1"
              disabled={loading}
              autoComplete={key.includes('password') ? 'new-password' : undefined}
            />
          </div>
        ))}
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2"
            role="alert"
          >
            {error}
          </motion.p>
        )}
        {success && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl px-3 py-2 flex items-center gap-2"
            role="status"
          >
            <CheckCircle2 size={16} />
            Compte créé avec succès
          </motion.p>
        )}
        <button
          type="submit"
          disabled={loading || success}
          className="cf-btn-primary w-full flex items-center justify-center gap-2 mt-2"
        >
          <UserPlus size={18} strokeWidth={2} />
          {loading ? 'Création du compte (quelques secondes)…' : success ? 'Redirection…' : 'Créer mon compte'}
        </button>
      </form>
      <p className="text-center text-sm text-slate-500 mt-6">
        Déjà inscrit ?{' '}
        <button
          type="button"
          className="text-[#2563EB] font-semibold"
          onClick={() => setAuthView('login')}
          disabled={loading}
        >
          Se connecter
        </button>
      </p>
    </AuthLayout>
  );
}
