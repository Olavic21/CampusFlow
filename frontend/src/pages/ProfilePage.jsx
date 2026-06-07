import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Star, History, User, Moon, Sun, Route, Cpu, Settings, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SkeletonList } from '../components/ui/Skeleton';
import UserAvatar from '../components/profile/UserAvatar';
import AvatarEditorModal from '../components/profile/AvatarEditorModal';
import {
  getFavoriteLocations,
  getFavoriteRoutes,
  getRouteHistory,
  removeFavoriteLocation,
  removeFavoriteRoute,
  getPreferences,
  updatePreferences,
  persistSession,
  getStoredTokens,
  fetchMe,
} from '../services/authApi';
import { uploadAvatar, deleteAvatar } from '../services/profileApi';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function ProfilePage({
  darkMode,
  onToggleTheme,
  routeMode,
  onRouteModeChange,
  onToast,
  onNavigate,
}) {
  const { user, setUser } = useAuth();
  const [favLocations, setFavLocations] = useState([]);
  const [favRoutes, setFavRoutes] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [locs, routes, hist] = await Promise.all([
        getFavoriteLocations(),
        getFavoriteRoutes(),
        getRouteHistory(),
      ]);
      setFavLocations(locs);
      setFavRoutes(routes);
      setHistory(hist);
    } catch {
      /* hors ligne */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const syncUser = useCallback(
    (profile) => {
      if (!profile) return;
      setUser((prev) => {
        const next = {
          ...prev,
          ...profile,
          avatar: Object.prototype.hasOwnProperty.call(profile, 'avatar')
            ? profile.avatar
            : prev?.avatar,
        };
        const { access, refresh } = getStoredTokens();
        if (access && refresh) {
          persistSession({
            access_token: access,
            refresh_token: refresh,
            user: next,
          });
        }
        return next;
      });
    },
    [setUser],
  );

  useEffect(() => {
    if (!user?.id) return;
    fetchMe()
      .then((me) => syncUser(me))
      .catch(() => {});
  }, [user?.id, syncUser]);

  const handleAvatarUpload = useCallback(
    async (blob) => {
      setAvatarUploading(true);
      try {
        const profile = await uploadAvatar(blob);
        syncUser(profile);
        try {
          const me = await fetchMe();
          syncUser(me);
        } catch {
          /* garde la réponse upload */
        }
        onToast?.('success', 'Photo mise à jour avec succès');
      } catch (err) {
        onToast?.('error', err.message || 'Erreur lors de l\'envoi');
        throw err;
      } finally {
        setAvatarUploading(false);
      }
    },
    [syncUser, onToast],
  );

  const handleAvatarDelete = useCallback(async () => {
    setAvatarUploading(true);
    try {
      const profile = await deleteAvatar();
      syncUser(profile);
      onToast?.('success', 'Photo supprimée');
    } catch (err) {
      onToast?.('error', err.message || 'Erreur lors de la suppression');
      throw err;
    } finally {
      setAvatarUploading(false);
    }
  }, [syncUser, onToast]);

  const handleTheme = async (theme) => {
    onToggleTheme?.(theme === 'dark');
    try {
      await updatePreferences({ theme });
    } catch {
      /* local only */
    }
  };

  const handleNavMode = async (mode) => {
    onRouteModeChange?.(mode);
    try {
      await updatePreferences({ navigation_mode: mode });
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    let cancelled = false;
    getPreferences()
      .then((p) => {
        if (cancelled) return;
        if (p.theme === 'dark' || p.theme === 'light') {
          onToggleTheme?.(p.theme === 'dark');
        }
        if (p.navigation_mode) onRouteModeChange?.(p.navigation_mode);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <SkeletonList count={5} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto sidebar-scroll p-4 md:p-8 max-w-2xl mx-auto w-full">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <section className="cf-menu-card p-6 mb-6 flex flex-col items-center text-center">
          <UserAvatar
            key={user.avatar || `profile-${user.id}`}
            user={user}
            size={96}
            animate
            onClick={() => setAvatarOpen(true)}
          />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-4">
            {user.full_name}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{user.email}</p>
          <button
            type="button"
            onClick={() => setAvatarOpen(true)}
            className="mt-4 cf-btn-primary text-sm px-5"
          >
            Modifier l&apos;avatar
          </button>
        </section>

        <header className="flex items-center gap-2 mb-4">
          <User size={20} className="text-[#2563EB]" />
          <h2 className="font-bold text-slate-900 dark:text-white">Mon profil</h2>
        </header>

        <section className="cf-menu-card p-4 mb-6 space-y-3">
          <h3 className="cf-menu-label">Informations</h3>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between">
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium text-slate-800 dark:text-white">{user.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Identifiant</dt>
              <dd className="font-medium">{user.username}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Inscription</dt>
              <dd className="font-medium">{formatDate(user.created_at)}</dd>
            </div>
          </dl>
        </section>

        <section className="cf-menu-card p-4 mb-6">
          <h3 className="cf-menu-label mb-3">Préférences</h3>
          <p className="text-xs text-slate-500 mb-2">Thème</p>
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => handleTheme('light')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium
                ${!darkMode ? 'bg-[#2563EB] text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
            >
              <Sun size={16} />
              Clair
            </button>
            <button
              type="button"
              onClick={() => handleTheme('dark')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium
                ${darkMode ? 'bg-[#2563EB] text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
            >
              <Moon size={16} />
              Sombre
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-2">Mode itinéraire par défaut</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleNavMode('single')}
              className={`flex-1 py-2 rounded-xl text-xs font-medium
                ${routeMode === 'single' ? 'bg-[#2563EB] text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
            >
              Un chemin
            </button>
            <button
              type="button"
              onClick={() => handleNavMode('compare')}
              className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1
                ${routeMode === 'compare' ? 'bg-[#2563EB] text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
            >
              <Route size={12} />
              Comparer
            </button>
          </div>
        </section>

        {onNavigate && (
          <section className="cf-menu-card p-2 mb-6 divide-y divide-slate-100 dark:divide-slate-800">
            <button
              type="button"
              onClick={() => onNavigate('iot')}
              className="w-full flex items-center gap-3 px-3 py-3.5 text-sm font-medium text-slate-800 dark:text-white active:bg-slate-50 dark:active:bg-slate-800/50 rounded-xl"
            >
              <Cpu size={18} className="text-[#2563EB]" />
              <span className="flex-1 text-left">Supervision IoT</span>
              <ChevronRight size={16} className="text-slate-400" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="w-full flex items-center gap-3 px-3 py-3.5 text-sm font-medium text-slate-800 dark:text-white active:bg-slate-50 dark:active:bg-slate-800/50 rounded-xl"
            >
              <Settings size={18} className="text-slate-500" />
              <span className="flex-1 text-left">Paramètres</span>
              <ChevronRight size={16} className="text-slate-400" />
            </button>
          </section>
        )}

        <section className="cf-menu-card p-4 mb-6">
          <h3 className="cf-menu-label mb-3 flex items-center gap-2">
            <Star size={14} className="text-amber-500" />
            Favoris
          </h3>
          <ul className="space-y-2 text-sm">
            {favLocations.map((f) => (
              <li key={f.id} className="flex justify-between items-center cf-stat-chip px-3 py-2">
                <span>⭐ {f.label || f.location_name}</span>
                <button
                  type="button"
                  className="cf-touch-target text-xs text-red-500 px-2"
                  onClick={async () => {
                    await removeFavoriteLocation(f.id);
                    load();
                  }}
                >
                  Retirer
                </button>
              </li>
            ))}
            {favRoutes.map((f) => (
              <li key={f.id} className="flex justify-between items-center cf-stat-chip px-3 py-2">
                <span>⭐ {f.label || `${f.start_name} → ${f.end_name}`}</span>
                <button
                  type="button"
                  className="cf-touch-target text-xs text-red-500 px-2"
                  onClick={async () => {
                    await removeFavoriteRoute(f.id);
                    load();
                  }}
                >
                  Retirer
                </button>
              </li>
            ))}
            {!favLocations.length && !favRoutes.length && (
              <p className="text-sm text-slate-400">Aucun favori — utilisez ⭐ sur un bâtiment ou itinéraire</p>
            )}
          </ul>
        </section>

        <section className="cf-menu-card p-4">
          <h3 className="cf-menu-label mb-3 flex items-center gap-2">
            <History size={14} />
            Mes itinéraires récents
          </h3>
          {history.length === 0 ? (
            <p className="text-sm text-slate-400">Aucun historique pour le moment</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {history.map((h) => (
                <li key={h.id} className="cf-stat-chip px-3 py-2">
                  <p className="font-medium">
                    {h.start_name} → {h.end_name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {h.distance_m} m
                    {h.duration_min ? ` · ~${h.duration_min} min` : ''}
                    {' · '}
                    {formatDate(h.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </motion.div>

      <AvatarEditorModal
        open={avatarOpen}
        onClose={() => setAvatarOpen(false)}
        user={user}
        onConfirmUpload={handleAvatarUpload}
        onDelete={handleAvatarDelete}
        uploading={avatarUploading}
      />
    </div>
  );
}
