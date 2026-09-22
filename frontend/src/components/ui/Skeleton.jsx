import { memo } from 'react';

export function SkeletonLine({ className = '' }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700 ${className}`}
      aria-hidden
    />
  );
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="cf-menu-card p-4 space-y-3" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} className={`h-3 ${i === 0 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function SkeletonList({ count = 4 }) {
  return (
    <div className="space-y-3 p-4" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={2} />
      ))}
    </div>
  );
}

export default memo(SkeletonList);
