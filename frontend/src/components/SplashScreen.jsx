import { motion } from 'framer-motion';
import BrandLogo from './brand/BrandLogo';

export default function SplashScreen({ visible }) {
  if (!visible) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[900] flex flex-col items-center justify-center bg-gradient-to-br from-[#2563EB] to-[#1e40af] pt-safe"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      role="status"
      aria-label="Chargement de CampusFlow"
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center px-8 text-center"
      >
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 shadow-2xl mb-6">
          <BrandLogo variant="splash" dark />
        </div>
        <motion.h1
          className="text-2xl font-bold text-white tracking-tight"
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          CampusFlow Lite
        </motion.h1>
        <motion.p
          className="text-white/80 text-sm mt-2 font-medium"
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          Smart Campus Navigation
        </motion.p>
        <div className="flex gap-1.5 mt-10">
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
