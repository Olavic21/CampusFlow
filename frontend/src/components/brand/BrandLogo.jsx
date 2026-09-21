import { memo } from 'react';

function BrandLogo({ variant = 'horizontal', className = '', dark = false }) {
  const iconSrc = '/assets/branding/campusflow-icon.svg';
  const fullLogoSrc = '/assets/branding/campusflow-logo.png';
  const imgClass =
    variant === 'splash'
      ? 'w-full max-w-[300px] h-auto'
      : variant === 'sidebar'
        ? 'h-8 w-8'
        : variant === 'compact' || variant === 'icon' || variant === 'mobile'
          ? 'h-9 w-9'
          : 'h-9 w-9';

  const textPrimary = dark ? 'text-white' : 'text-slate-900 dark:text-white';
  const textMuted = dark ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400';

  if (variant === 'mobile' || variant === 'icon') {
    return (
      <img
        src={iconSrc}
        alt="CampusFlow"
        className={`${imgClass} shrink-0 ${className}`}
        width={36}
        height={36}
      />
    );
  }

  if (variant === 'splash') {
    return (
      <div className={`flex flex-col items-center gap-3 ${className}`}>
        <img
          src={fullLogoSrc}
          alt="CampusFlow — Jumeau numérique du campus intelligent"
          className={imgClass}
          width={900}
          height={260}
        />
        <p className={`text-xs font-medium ${textMuted}`}>SUP&apos;PTIC · Yaoundé</p>
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <img src={iconSrc} alt="" className={imgClass} width={32} height={32} aria-hidden />
        <div className="leading-tight min-w-0 hidden xl:block">
          <p className={`font-bold text-sm ${textPrimary}`}>CampusFlow</p>
          <p className={`text-[10px] ${textMuted}`}>Campus intelligent</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img src={iconSrc} alt="" className={imgClass} width={36} height={36} aria-hidden />
      <div className="leading-tight min-w-0">
        <p className={`font-bold text-sm tracking-tight ${textPrimary}`}>CampusFlow</p>
        <p className={`text-[10px] font-medium ${textMuted}`}>SUP&apos;PTIC · Yaoundé</p>
      </div>
    </div>
  );
}

export default memo(BrandLogo);
