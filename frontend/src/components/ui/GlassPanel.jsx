import { memo } from 'react';
import { motion } from 'framer-motion';

function GlassPanel({ children, className = '', as: Tag = 'div', ...props }) {
  const Component = Tag === motion.div ? motion.div : motion.div;
  return (
    <Component
      className={`cf-glass rounded-[20px] border border-white/20 shadow-xl ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

export default memo(GlassPanel);
