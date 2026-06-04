import { memo, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, User, ChevronDown } from 'lucide-react';
import UserAvatar from './profile/UserAvatar';

function UserMenu({ user, onProfile, onLogout, compact }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 w-full rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/80
          ${compact ? 'flex-col gap-1 p-2' : 'p-2.5'}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <UserAvatar user={user} size={36} />
        {!compact && (
          <>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                {user.full_name || user.username}
              </p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Connecté</p>
            </div>
            <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className={`absolute z-[600] cf-menu-card py-1 shadow-xl min-w-[180px]
              ${compact ? 'bottom-full left-1/2 -translate-x-1/2 mb-2' : 'bottom-full left-0 mb-2 w-full'}`}
            role="menu"
          >
            <div className="px-3 py-2 flex items-center gap-3 border-b border-slate-100 dark:border-slate-700/50 mb-1">
              <UserAvatar user={user} size={40} />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{user.full_name || user.username}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onProfile?.();
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
            >
              <User size={16} />
              Mon profil
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout?.();
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
            >
              <LogOut size={16} />
              Déconnexion
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(UserMenu);
