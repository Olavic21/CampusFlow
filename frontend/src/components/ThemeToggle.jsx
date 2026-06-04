export default function ThemeToggle({ darkMode, setDarkMode }) {
  return (
    <button
      onClick={() => setDarkMode((d) => !d)}
      className="text-sm bg-white/95 backdrop-blur rounded-xl px-3 py-2.5 shadow-md border border-slate-200 hover:bg-slate-50 transition"
      aria-label={darkMode ? 'Mode clair' : 'Mode sombre'}
    >
      {darkMode ? '☀️' : '🌙'}
    </button>
  );
}
