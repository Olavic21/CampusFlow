import { memo } from 'react';
import { Map, BarChart3, Route, Building2, Settings, User } from 'lucide-react';
import BrandLogo from './brand/BrandLogo';
import UserMenu from './UserMenu';

const NAV_ITEMS = [
  { id: 'map', label: 'Carte', Icon: Map },
  { id: 'stats', label: 'Statistiques', Icon: BarChart3 },
  { id: 'route', label: 'Itinéraire', Icon: Route },
  { id: 'buildings', label: 'Bâtiments', Icon: Building2 },
  { id: 'settings', label: 'Paramètres', Icon: Settings },
];

function NavButton({ item, active, onClick, compact }) {
  const { Icon, label, id } = item;
  const isActive = active === id;
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`cf-nav-item flex items-center gap-3 w-full text-sm font-medium
        ${isActive ? 'cf-nav-item-active' : ''}
        ${compact ? 'flex-col gap-1 !py-2 !px-2 text-[10px]' : ''}`}
      aria-current={isActive ? 'page' : undefined}
      aria-label={label}
    >
      <Icon size={compact ? 22 : 20} strokeWidth={isActive ? 2.5 : 2} />
      <span className={compact ? 'truncate w-full text-center' : ''}>{label}</span>
    </button>
  );
}

function AppNav({ activeView, onViewChange, isMobile, user, onProfile, onLogout }) {
  if (isMobile) {
    return (
      <nav
        className="fixed bottom-0 left-0 right-0 z-[500] cf-glass border-t border-white/30 dark:border-slate-700/50 px-2 pt-2 pb-safe"
        aria-label="Navigation principale"
      >
        {user && (
          <div className="absolute -top-14 right-3 z-[501]">
            <UserMenu user={user} onProfile={onProfile} onLogout={onLogout} compact />
          </div>
        )}
        <div className="flex justify-around max-w-lg mx-auto">
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={activeView}
              onClick={onViewChange}
              compact
            />
          ))}
        </div>
      </nav>
    );
  }

  return (
    <aside
      className="w-56 shrink-0 flex flex-col cf-glass border-r border-white/20 dark:border-slate-700/50 z-[400]"
      aria-label="Navigation principale"
    >
      <div className="p-4 border-b border-slate-200/50 dark:border-slate-700/50">
        <BrandLogo variant="sidebar" />
      </div>
      <nav className="flex-1 p-3 space-y-1 sidebar-scroll overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavButton key={item.id} item={item} active={activeView} onClick={onViewChange} />
        ))}
        {user && (
          <NavButton
            item={{ id: 'profile', label: 'Profil', Icon: User }}
            active={activeView}
            onClick={onViewChange}
          />
        )}
      </nav>
      {user && (
        <div className="p-3 border-t border-slate-200/50 dark:border-slate-700/50">
          <UserMenu user={user} onProfile={onProfile} onLogout={onLogout} />
        </div>
      )}
      <p className="p-4 text-[10px] text-slate-400">SUP&apos;PTIC · Yaoundé</p>
    </aside>
  );
}

export default memo(AppNav);
