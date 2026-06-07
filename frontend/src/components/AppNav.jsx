import { memo } from 'react';
import { Map, BarChart3, Route, Building2, User, Cpu, Settings } from 'lucide-react';
import BrandLogo from './brand/BrandLogo';
import UserMenu from './UserMenu';

/** Navigation mobile-first — 5 onglets principaux (spec APK). */
const MOBILE_NAV_ITEMS = [
  { id: 'map', label: 'Carte', Icon: Map },
  { id: 'buildings', label: 'Bâtiments', Icon: Building2 },
  { id: 'route', label: 'Itinéraires', Icon: Route },
  { id: 'stats', label: 'Statistiques', Icon: BarChart3 },
  { id: 'profile', label: 'Profil', Icon: User },
];

const DESKTOP_EXTRA = [
  { id: 'iot', label: 'IoT', Icon: Cpu },
  { id: 'settings', label: 'Paramètres', Icon: Settings },
];

function NavButton({ item, active, onClick, compact }) {
  const { Icon, label, id } = item;
  const isActive = active === id;
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`cf-nav-item flex items-center justify-center gap-1 w-full font-medium
        ${isActive ? 'cf-nav-item-active' : ''}
        ${compact ? 'flex-col min-h-[52px] py-1.5 px-1 text-[11px]' : 'gap-3 text-sm py-2.5'}`}
      aria-current={isActive ? 'page' : undefined}
      aria-label={label}
    >
      <Icon size={compact ? 24 : 20} strokeWidth={isActive ? 2.5 : 2} />
      <span className={compact ? 'truncate w-full text-center leading-tight' : ''}>{label}</span>
    </button>
  );
}

function AppNav({ activeView, onViewChange, isMobile, user, onProfile, onLogout }) {
  if (isMobile) {
    return (
      <nav
        className="fixed bottom-0 left-0 right-0 z-[500] cf-glass border-t border-white/30 dark:border-slate-700/50 px-1 pt-1.5 pb-safe"
        style={{ height: 'var(--nav-h-safe)' }}
        aria-label="Navigation principale"
      >
        <div className="flex justify-around items-stretch h-full max-w-lg mx-auto">
          {MOBILE_NAV_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={activeView}
              onClick={(id) => {
                if (id === 'profile') onProfile?.();
                else onViewChange(id);
              }}
              compact
            />
          ))}
        </div>
      </nav>
    );
  }

  const desktopItems = [...MOBILE_NAV_ITEMS.filter((i) => i.id !== 'profile'), ...DESKTOP_EXTRA];

  return (
    <aside
      className="w-56 shrink-0 flex flex-col cf-glass border-r border-white/20 dark:border-slate-700/50 z-[400]"
      aria-label="Navigation principale"
    >
      <div className="p-4 border-b border-slate-200/50 dark:border-slate-700/50">
        <BrandLogo variant="sidebar" />
      </div>
      <nav className="flex-1 p-3 space-y-1 sidebar-scroll overflow-y-auto">
        {desktopItems.map((item) => (
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
