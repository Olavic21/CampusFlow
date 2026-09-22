// src/layouts/DesktopLayout.jsx
// Design desktop plein écran — sidebar gauche + carte droite (style Google Maps)

import { useState } from 'react';
import CampusMap from '../components/CampusMap';
import RoomCard from '../components/RoomCard';
import salles from '../data/raw/campus.json';

const STATS = [
  { label: 'Salles totales', value: 17, icon: '🏫' },
  { label: 'Disponibles',    value: 9,  icon: '✅' },
  { label: 'Occupées',       value: 6,  icon: '🔴' },
  { label: 'En attente',     value: 2,  icon: '⏳' },
];

const ROOMS_MOCK = [
  { id: 1, name: 'Amphi',        status: 'occupied',  time: 'occupée — TP ITT1A',      capacite: 120 },
  { id: 2, name: 'Bibliothèque', status: 'available', time: 'libre maintenant',         capacite: 20  },
  { id: 3, name: 'C16',          status: 'available', time: 'libre jusqu\'à 15h',       capacite: 60  },
  { id: 4, name: 'C17',          status: 'occupied',  time: 'occupée dans 30 min',      capacite: 60  },
  { id: 5, name: 'L24',          status: 'waiting',   time: 'étudiants en attente',     capacite: 60  },
  { id: 6, name: 'L27',          status: 'available', time: 'libre',                    capacite: 60  },
  { id: 7, name: 'C5',           status: 'occupied',  time: 'occupée',                  capacite: 15  },
  { id: 8, name: 'C6',           status: 'available', time: 'libre',                    capacite: 15  },
  { id: 9, name: 'C13',          status: 'waiting',   time: 'en attente depuis 10 min', capacite: 15  },
];

function getColor(type) {
  if (type === 'Amphitheatre')      return '#ef4444';
  if (type === 'Bibliotheque')      return '#f59e0b';
  if (type.includes('Laboratoire')) return '#8b5cf6';
  if (type.includes('TP'))          return '#0088fe';
  return '#22c55e';
}

export default function DesktopLayout({ selectedSalle, setSelectedSalle }) {
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('Tous');
  const [activeTab, setActiveTab] = useState('salles'); // 'salles' | 'itineraire'

  const types = ['Tous', 'Amphitheatre', 'Salle de cours', 'Laboratoire', 'Bibliotheque'];

  const filtered = ROOMS_MOCK.filter(r => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const salle = salles.find(s => s.nom === r.name);
    const matchFilter = filter === 'Tous' || (salle && salle.type === filter);
    return matchSearch && matchFilter;
  });

  return (
    <div className="flex w-full overflow-hidden" style={{ height: '100dvh', background: '#0f172a' }}>

      {/* ══════════════════════════════════
          SIDEBAR GAUCHE
      ══════════════════════════════════ */}
      <aside
        className="flex flex-col shrink-0 bg-white overflow-hidden anim-slide-left"
        style={{ width: 'var(--sidebar-w)', height: '100dvh' }}
      >
        {/* Header sidebar */}
        <div className="bg-[#0088fe] px-6 py-5 shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M3 12L12 3l9 9" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 21V12h6v9" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h1 style={{ fontFamily: 'Syne, sans-serif' }} className="text-white font-bold text-xl leading-tight">
                CampusFlow
              </h1>
              <p className="text-blue-100 text-xs">Optimisation des flux étudiants</p>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-3 px-4 py-4 shrink-0 border-b border-gray-100">
          {STATS.map((s) => (
            <div key={s.label} className="bg-gray-50 rounded-2xl px-3 py-3 flex flex-col gap-1">
              <span className="text-xl">{s.icon}</span>
              <span className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>
                {s.value}
              </span>
              <span className="text-xs text-gray-500 font-medium">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-2 shrink-0">
          {['salles', 'itineraire'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition capitalize ${
                activeTab === tab
                  ? 'bg-[#0088fe] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {tab === 'salles' ? '🏫 Salles' : '🗺️ Itinéraire'}
            </button>
          ))}
        </div>

        {/* Contenu tabs */}
        {activeTab === 'salles' ? (
          <>
            {/* Barre de recherche */}
            <div className="px-4 pb-2 shrink-0">
              <div className="flex items-center gap-2 bg-gray-100 rounded-2xl px-4 py-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher une salle…"
                  className="bg-transparent text-sm text-gray-700 outline-none flex-1 placeholder-gray-400"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">✕</button>
                )}
              </div>
            </div>

            {/* Filtres par type */}
            <div className="px-4 pb-3 shrink-0 overflow-x-auto">
              <div className="flex gap-2 w-max">
                {types.map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                      filter === t
                        ? 'bg-[#0088fe] text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Liste salles scrollable */}
            <div className="flex-1 overflow-y-auto sidebar-scroll px-4 pb-4 flex flex-col gap-2 min-h-0">
              {filtered.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-10">Aucune salle trouvée</div>
              ) : (
                filtered.map((room) => (
                  <button
                    key={room.id}
                    onClick={() => setSelectedSalle(room.name)}
                    className={`text-left w-full transition rounded-2xl ${
                      selectedSalle === room.name ? 'ring-2 ring-[#0088fe]' : ''
                    }`}
                  >
                    <RoomCard name={room.name} status={room.status} time={room.time} />
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          /* Tab Itinéraire */
          <div className="flex-1 overflow-y-auto sidebar-scroll px-4 pb-4 min-h-0">
            <div className="mt-2 bg-blue-50 rounded-2xl p-4 border border-blue-100">
              <p className="text-xs font-semibold text-[#0088fe] uppercase tracking-wide mb-3">Calculer un itinéraire</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Point de départ</label>
                  <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 border border-gray-200">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0088fe" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="10" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                    </svg>
                    <input type="text" defaultValue="Melen" className="bg-transparent text-sm outline-none flex-1 text-gray-700" />
                  </div>
                </div>
                <div className="flex justify-center">
                  <div className="w-px h-4 bg-blue-200"/>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Destination</label>
                  <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 border border-gray-200">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
                    </svg>
                    <input type="text" defaultValue="Sup'ptic" className="bg-transparent text-sm outline-none flex-1 text-gray-700" />
                  </div>
                </div>
                <button className="w-full bg-[#0088fe] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-600 transition">
                  Calculer l'itinéraire
                </button>
              </div>
            </div>

            {/* Légende */}
            <div className="mt-4 bg-gray-50 rounded-2xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Légende</p>
              <div className="space-y-2">
                {[
                  ['#ef4444', 'Amphithéâtre'],
                  ['#f59e0b', 'Bibliothèque'],
                  ['#8b5cf6', 'Laboratoire'],
                  ['#0088fe', 'Salle de TP'],
                  ['#22c55e', 'Salle de cours'],
                ].map(([color, label]) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }}/>
                    <span className="text-xs text-gray-600">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="shrink-0 px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">© 2025 CampusFlow</span>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
            <span className="text-xs text-gray-400">En direct</span>
          </div>
        </div>
      </aside>

      {/* ══════════════════════════════════
          CARTE PLEIN ÉCRAN DROITE
      ══════════════════════════════════ */}
      <div className="flex-1 relative overflow-hidden" style={{ height: '100dvh' }}>
        {/* Carte Leaflet */}
        <CampusMap currentScreen={2} selectedSalle={selectedSalle} desktop={true} />

        {/* Badge salle sélectionnée */}
        {selectedSalle && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] anim-slide-up">
            <div className="bg-white rounded-2xl shadow-xl px-5 py-3 flex items-center gap-3 border border-gray-100">
              <span className="text-sm font-semibold text-gray-800">{selectedSalle}</span>
              <button
                onClick={() => setSelectedSalle(null)}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >✕</button>
            </div>
          </div>
        )}

        {/* Watermark */}
        <div className="absolute bottom-4 right-4 z-[400] bg-white/80 backdrop-blur rounded-xl px-3 py-2 shadow-sm">
          <span style={{ fontFamily: 'Syne, sans-serif' }} className="text-xs font-bold text-[#0088fe]">
            CampusFlow
          </span>
          <span className="text-xs text-gray-400 ml-1">— Sup'ptic Yaoundé</span>
        </div>
      </div>
    </div>
  );
}
