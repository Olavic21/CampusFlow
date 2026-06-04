import { motion } from 'framer-motion';
import BrandLogo from './brand/BrandLogo';

export default function SplashScreen({ visible }) {
  if (!visible) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[900] flex flex-col items-center justify-center bg-gradient-to-br from-[#2563EB] to-[#1e40af]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      role="status"
      aria-label="Chargement de CampusFlow"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center"
      >
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 shadow-2xl mb-2">
          <BrandLogo variant="splash" dark />
        </div>
        <div className="flex gap-1.5 mt-8">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-2 h-2 rounded-full bg-white/80"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
