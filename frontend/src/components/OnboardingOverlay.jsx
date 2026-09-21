import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MapPinned, Radio, Route, X } from 'lucide-react';
import BrandLogo from './brand/BrandLogo';

const SLIDES = [
  {
    Icon: MapPinned,
    color: '#2563EB',
    title: 'Bienvenue sur CampusFlow',
    text: "Trouvez n'importe quel bâtiment du campus SUP'PTIC et rejoignez-le à pied, itinéraire compris.",
  },
  {
    Icon: Radio,
    color: '#22c55e',
    title: 'Des données honnêtes, en temps réel',
    text: "L'occupation des salles est mesurée par capteurs. Chaque donnée indique sa source — capteur, simulation ou démo — et son ancienneté.",
  },
  {
    Icon: Route,
    color: '#f59e0b',
    title: 'Navigation intelligente',
    text: "Les itinéraires évitent les zones saturées. Enregistrez vos lieux favoris et soyez alerté s'ils se remplissent.",
  },
];

/** Onboarding première visite — 3 slides, skippable (audit P1). */
export default function OnboardingOverlay({ onFinish }) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];

  const next = useCallback(() => {
    if (index < SLIDES.length - 1) setIndex((i) => i + 1);
    else onFinish?.();
  }, [index, onFinish]);

  return (
    <motion.div
      className="fixed inset-0 z-[900] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenue sur CampusFlow"
    >
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="bg-white dark:bg-slate-900 rounded-[24px] shadow-2xl max-w-sm w-full p-6"
      >
        <div className="flex justify-between items-start mb-4">
          <div className="p-3 rounded-2xl" style={{ backgroundColor: `${slide.color}1a` }}>
            <slide.Icon size={26} style={{ color: slide.color }} strokeWidth={2} />
          </div>
          <button
            type="button"
            onClick={onFinish}
            aria-label="Passer l'introduction"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>
        {index === 0 && <BrandLogo variant="splash" className="mb-5 !items-start" />}
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{slide.title}</h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">{slide.text}</p>
        <div className="flex items-center justify-between mt-6">
          <div className="flex gap-1.5" aria-hidden="true">
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-5 bg-[#2563EB]' : 'w-1.5 bg-slate-300 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
          <button type="button" onClick={next} className="cf-btn-primary px-5" autoFocus>
            {index < SLIDES.length - 1 ? 'Suivant' : "C'est parti"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}