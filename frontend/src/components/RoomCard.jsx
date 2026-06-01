// src/components/RoomCard.jsx
export default function RoomCard({ name, status, time }) {
  const isOccupied = status === 'occupied';
  const isWaiting  = status === 'waiting';
  const dotColor   = isOccupied ? 'bg-red-500' : isWaiting ? 'bg-orange-400' : 'bg-green-500';
  const labelColor = isOccupied ? 'text-red-500' : isWaiting ? 'text-orange-400' : 'text-green-500';
  const label      = isOccupied ? 'Occupée' : isWaiting ? 'En attente' : 'Libre';
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-4 flex items-center justify-between hover:shadow-md transition">
      <div>
        <p className="font-bold text-gray-800 text-base">{name}</p>
        <p className="text-sm text-gray-500 mt-0.5">{time}</p>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className={`w-4 h-4 rounded-full shadow-sm ${dotColor}`}/>
        <span className={`text-[10px] font-semibold ${labelColor}`}>{label}</span>
      </div>
    </div>
  );
}
