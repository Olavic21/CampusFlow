import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import BrandLogo from '../../components/brand/BrandLogo';

export default function AuthLayout({ children, title, subtitle }) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    document.body.classList.add('auth-route');
    document.documentElement.classList.add('auth-route');
    return () => {
      document.body.classList.remove('auth-route');
      document.documentElement.classList.remove('auth-route');
    };
  }, []);

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
      };

  return (
    <div className="auth-shell">
      <motion.div
        {...motionProps}
        className="auth-card cf-menu-card shadow-2xl flex flex-col w-full max-w-md"
      >
        <header className="auth-card-header shrink-0 px-6 pt-6 pb-4 text-center border-b border-slate-200/60 dark:border-slate-700/50">
          <BrandLogo variant="icon" className="!h-12 !w-12 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
          {subtitle && (
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
          )}
        </header>

        <div className="auth-card-body sidebar-scroll px-6 py-5">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
