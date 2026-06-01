// src/components/CampusMap.jsx
// Carte centrée sur SUP'PTIC Yaoundé (Melen, près Université de Yaoundé I)
// - Marqueurs grands et visibles par bâtiment (id + nom)
// - Routes simulées entre bâtiments (Polyline)
// - Popup détaillée au clic
// - Desktop : interactif | Mobile : statique

import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import { useRef, useEffect } from 'react';
import L from 'leaflet';
import salles from '../data/raw/campus.json';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon   from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl:       markerIcon,
  shadowUrl:     markerShadow,
});

// ── Centre exact de SUP'PTIC / Melen, Yaoundé ──────────────────────────────
// Proche Université de Yaoundé I : 3.8570, 11.5013
const CENTER     = [3.8580, 11.5015];
const ZOOM_LEVEL = 18; // zoom campus — bâtiments visibles

// ── Couleurs par type ───────────────────────────────────────────────────────
function getColor(type) {
  if (type === 'Amphitheatre')      return '#ef4444'; // rouge
  if (type === 'Bibliotheque')      return '#f59e0b'; // orange
  if (type.includes('Laboratoire')) return '#8b5cf6'; // violet
  if (type.includes('TP'))          return '#0088fe'; // bleu
  return '#22c55e';                                   // vert (cours)
}

function getBg(type) {
  if (type === 'Amphitheatre')      return '#fef2f2';
  if (type === 'Bibliotheque')      return '#fffbeb';
  if (type.includes('Laboratoire')) return '#f5f3ff';
  if (type.includes('TP'))          return '#eff6ff';
  return '#f0fdf4';
}

// ── Icône div grande et lisible : cercle coloré + label ────────────────────
function makeBuildingIcon(salle, highlight = false) {
  const color = getColor(salle.type);
  const size  = highlight ? 52 : 44;
  const fs    = salle.nom.length > 4 ? 9 : 11;
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:${size}px; height:${size}px;
        background:${color};
        border: ${highlight ? '3px' : '2.5px'} solid white;
        border-radius: 50%;
        box-shadow: 0 2px 12px ${color}99, 0 1px 4px rgba(0,0,0,0.25);
        display:flex; flex-direction:column;
        align-items:center; justify-content:center;
        cursor:pointer;
        transition: transform 0.15s;
      ">
        <span style="
          color:white; font-weight:800;
          font-size:${fs}px; line-height:1.1;
          font-family:'DM Sans',sans-serif;
          text-align:center; padding:0 2px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
          word-break:break-all;
        ">${salle.nom}</span>
      </div>
    `,
    iconSize:    [size, size],
    iconAnchor:  [size/2, size/2],
    popupAnchor: [0, -(size/2 + 6)],
  });
}

// ── Routes simulées entre bâtiments ────────────────────────────────────────
// Tracés réalistes reliant les bâtiments proches (allées campus)
const ROUTES = [
  // Allée principale Nord-Sud
  { id: 'r1', color: '#94a3b8', weight: 3,
    points: [
      [3.8597, 11.5015], // L21
      [3.8593, 11.5013], // C12
      [3.8588, 11.5011], // L28
      [3.8583, 11.5010], // C17
      [3.8578, 11.5008], // Amphi
      [3.8574, 11.5006], // Bibliotheque
      [3.8569, 11.5009], // C5
      [3.8565, 11.5012], // C13
      [3.8561, 11.5018], // L23
    ]
  },
  // Allée Est-Ouest centrale
  { id: 'r2', color: '#94a3b8', weight: 3,
    points: [
      [3.8583, 11.5007],
      [3.8583, 11.5012], // C17
      [3.8583, 11.5015],
      [3.8581, 11.5018], // C16
      [3.8580, 11.5022],
      [3.8576, 11.5022], // L24
      [3.8572, 11.5022], // L27
    ]
  },
  // Allée Nord (labos)
  { id: 'r3', color: '#94a3b8', weight: 2,
    points: [
      [3.8593, 11.5011], // C12
      [3.8593, 11.5015],
      [3.8595, 11.5015], // L20
      [3.8595, 11.5020],
      [3.8590, 11.5026], // L29
      [3.8588, 11.5023], // L28
      [3.8585, 11.5020], // L26
    ]
  },
  // Allée Sud (TP)
  { id: 'r4', color: '#94a3b8', weight: 2,
    points: [
      [3.8565, 11.5017], // C13
      [3.8565, 11.5020],
      [3.8563, 11.5020], // L22
      [3.8561, 11.5023], // L23
      [3.8561, 11.5026],
    ]
  },
  // Connexion C5-C6
  { id: 'r5', color: '#94a3b8', weight: 2,
    points: [
      [3.8569, 11.5010], // C5
      [3.8567, 11.5012], // C6
      [3.8565, 11.5015],
    ]
  },
];

// ── MapResizer : recalcule la taille Leaflet après montage ──────────────────
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize({ animate: false, pan: false });
    fix();
    const t1 = setTimeout(fix, 80);
    const t2 = setTimeout(fix, 350);
    window.addEventListener('resize', fix);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener('resize', fix); };
  }, [map]);
  return null;
}

// ── Marqueur bâtiment avec popup détaillée ──────────────────────────────────
function BatimentMarker({ salle, autoOpen, highlight, currentScreen }) {
  const ref = useRef(null);

  useEffect(() => {
    if ((autoOpen || highlight) && ref.current) {
      setTimeout(() => ref.current?.openPopup(), 150);
    }
  }, [autoOpen, highlight]);

  const isAmphiScreen2 = currentScreen === 2 && salle.nom === 'Amphi';

  return (
    <Marker
      position={[salle.latitude, salle.longitude]}
      icon={makeBuildingIcon(salle, highlight)}
      ref={ref}
      eventHandlers={{
        mouseover: (e) => { e.target.getElement()?.querySelector('div')?.style.setProperty('transform', 'scale(1.12)'); },
        mouseout:  (e) => { e.target.getElement()?.querySelector('div')?.style.setProperty('transform', 'scale(1)'); },
      }}
    >
      {/* Tooltip permanent : affiche l'ID du bâtiment au survol */}
      <Tooltip
        direction="top"
        offset={[0, -22]}
        opacity={0.92}
        permanent={false}
      >
        <span style={{ fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:12 }}>
          #{salle.id} — {salle.nom}
        </span>
      </Tooltip>

      {/* Popup détaillée au clic */}
      <Popup closeButton={true} minWidth={200}>
        <div style={{
          padding: '14px 16px',
          fontFamily: 'DM Sans, sans-serif',
          minWidth: 200,
        }}>
          {/* En-tête */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <div style={{
              width:36, height:36, borderRadius:'50%',
              background: getColor(salle.type),
              display:'flex', alignItems:'center', justifyContent:'center',
              color:'white', fontWeight:800, fontSize:11,
              flexShrink:0,
            }}>
              {salle.nom}
            </div>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#0f172a' }}>{salle.nom}</div>
              <div style={{
                fontSize:10, fontWeight:700, color:'white',
                background: getColor(salle.type),
                padding:'1px 7px', borderRadius:99,
                display:'inline-block', marginTop:2,
              }}>{salle.type}</div>
            </div>
          </div>

          {/* Infos */}
          <div style={{ background: getBg(salle.type), borderRadius:10, padding:'10px 12px', marginBottom: isAmphiScreen2 ? 10 : 0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <span style={{ fontSize:12, color:'#64748b' }}>ID Bâtiment</span>
              <span style={{ fontSize:12, fontWeight:700, color:'#0f172a' }}>#{salle.id}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <span style={{ fontSize:12, color:'#64748b' }}>Capacité</span>
              <span style={{ fontSize:12, fontWeight:700, color:'#0f172a' }}>{salle.capacite} places</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:12, color:'#64748b' }}>Coordonnées</span>
              <span style={{ fontSize:10, fontWeight:600, color:'#94a3b8' }}>
                {salle.latitude.toFixed(4)}, {salle.longitude.toFixed(4)}
              </span>
            </div>
          </div>

          {/* Infos live pour l'Amphi sur écran 2 */}
          {isAmphiScreen2 && (
            <div style={{ background:'#fef2f2', borderRadius:10, padding:'10px 12px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                <span style={{ fontSize:12, color:'#64748b' }}>Flux actuel</span>
                <span style={{ fontSize:12, fontWeight:700, color:'#ef4444' }}>187 étudiants</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ fontSize:12, color:'#64748b' }}>Activité</span>
                <span style={{ fontSize:12, fontWeight:700, color:'#0f172a' }}>TP ITT1A</span>
              </div>
              <div style={{
                background:'#ef4444', color:'white',
                fontSize:11, fontWeight:700,
                padding:'4px 10px', borderRadius:99,
                textAlign:'center',
              }}>
                🔴 Occupée — Taux 156%
              </div>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

// ── Composant principal ─────────────────────────────────────────────────────
export default function CampusMap({ currentScreen, selectedSalle, desktop = false }) {
  return (
    <div className="absolute inset-0">
      <MapContainer
        center={CENTER}
        zoom={ZOOM_LEVEL}
        // Desktop : entièrement interactif
        // Mobile  : statique (pas de drag ni zoom)
        dragging={desktop}
        touchZoom={desktop}
        doubleClickZoom={desktop}
        scrollWheelZoom={desktop}
        boxZoom={desktop}
        keyboard={desktop}
        zoomControl={desktop}
        attributionControl={true}
        style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}
      >
        {/* Fond de carte OpenStreetMap */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          keepBuffer={desktop ? 8 : 4}
        />

        {/* Recalcul taille après montage */}
        <MapResizer />

        {/* ── Routes simulées entre bâtiments ── */}
        {ROUTES.map((route) => (
          <Polyline
            key={route.id}
            positions={route.points}
            pathOptions={{
              color:     route.color,
              weight:    route.weight,
              opacity:   0.7,
              dashArray: '6 4',
            }}
          />
        ))}

        {/* ── Marqueurs bâtiments depuis campus.json ── */}
        {salles.map((salle) => (
          <BatimentMarker
            key={salle.id}
            salle={salle}
            currentScreen={currentScreen}
            autoOpen={currentScreen === 2 && salle.nom === 'Amphi'}
            highlight={selectedSalle === salle.nom}
          />
        ))}
      </MapContainer>
    </div>
  );
}
