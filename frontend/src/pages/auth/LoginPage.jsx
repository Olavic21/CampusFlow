import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { LogIn, CheckCircle2 } from 'lucide-react';
import AuthLayout from './AuthLayout';
import { useAuth } from '../../context/AuthContext';
import { SKIP_AUTH } from '../../services/authApi';

export default function LoginPage() {
  const { login, setAuthView } = useAuth();
  const [loginVal, setLoginVal] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting.current || loading) return;
    setError('');
    setSuccess(false);

    if (!loginVal.trim()) {
      setError('Indiquez votre email ou nom d\'utilisateur');
      return;
    }
    if (!password) {
      setError('Indiquez votre mot de passe');
      return;
    }

    submitting.current = true;
    setLoading(true);
    try {
      await login(loginVal.trim(), password);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  return (
    <AuthLayout title="Connexion" subtitle="SUP'PTIC Yaoundé — CampusFlow Lite">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="login" className="cf-menu-label">
            Email ou nom d&apos;utilisateur
          </label>
          <input
            id="login"
            type="text"
            autoComplete="username"
            value={loginVal}
            onChange={(e) => setLoginVal(e.target.value)}
            className="cf-menu-input mt-1"
            disabled={loading}
          />
        </div>
        <div>
          <label htmlFor="password" className="cf-menu-label">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="cf-menu-input mt-1"
            disabled={loading}
          />
        </div>
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
            Connexion réussie
          </motion.p>
        )}
        <button
          type="submit"
          disabled={loading || success}
          className="cf-btn-primary w-full flex items-center justify-center gap-2"
        >
          <LogIn size={18} strokeWidth={2} />
          {loading ? 'Connexion…' : success ? 'Redirection…' : 'Se connecter'}
        </button>
      </form>
      <p className="text-center text-sm text-slate-500 mt-6">
        Pas de compte ?{' '}
        <button
          type="button"
          className="text-[#2563EB] font-semibold hover:underline"
          onClick={() => setAuthView('register')}
          disabled={loading}
        >
          Créer un compte
        </button>
      </p>
      {SKIP_AUTH && (
        <p className="text-center text-xs text-amber-600 mt-2">Mode auth désactivé (dev)</p>
      )}
    </AuthLayout>
  );
}
