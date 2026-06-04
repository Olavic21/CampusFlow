import { memo } from 'react';

function BrandLogo({ variant = 'horizontal', className = '', dark = false }) {
  const imgClass =
    variant === 'splash'
      ? 'h-20 w-20'
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
        src="/logo.svg"
        alt="CampusFlow Lite"
        className={`${imgClass} shrink-0 ${className}`}
        width={36}
        height={36}
      />
    );
  }

  if (variant === 'splash') {
    return (
      <div className={`flex flex-col items-center gap-4 ${className}`}>
        <img src="/logo.svg" alt="" className={imgClass} width={80} height={80} aria-hidden />
        <div className="text-center">
          <p className={`text-2xl font-bold tracking-tight ${textPrimary}`}>CampusFlow Lite</p>
          <p className={`text-sm mt-1 ${textMuted}`}>Smart Campus Navigation</p>
          <p className={`text-xs mt-2 ${textMuted}`}>SUP&apos;PTIC · Yaoundé</p>
        </div>
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <img src="/logo.svg" alt="" className={imgClass} width={32} height={32} aria-hidden />
        <div className="leading-tight min-w-0 hidden xl:block">
          <p className={`font-bold text-sm ${textPrimary}`}>CampusFlow</p>
          <p className={`text-[10px] ${textMuted}`}>Lite</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img src="/logo.svg" alt="" className={imgClass} width={36} height={36} aria-hidden />
      <div className="leading-tight min-w-0">
        <p className={`font-bold text-sm tracking-tight ${textPrimary}`}>CampusFlow Lite</p>
        <p className={`text-[10px] font-medium ${textMuted}`}>SUP&apos;PTIC · Yaoundé</p>
      </div>
    </div>
  );
}

export default memo(BrandLogo);
