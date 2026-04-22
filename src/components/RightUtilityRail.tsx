import { useEffect, useMemo, useState } from 'react';

type ThemeMode = 'light' | 'dark';

const THEME_KEY = 'mk_theme_mode';

function resolveInitialTheme(): ThemeMode {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function RightUtilityRail() {
  const [mode, setMode] = useState<ThemeMode>('light');
  const isDark = useMemo(() => mode === 'dark', [mode]);

  useEffect(() => {
    const initial = resolveInitialTheme();
    setMode(initial);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem(THEME_KEY, mode);
  }, [mode]);

  const toggleTheme = () => setMode((prev) => (prev === 'light' ? 'dark' : 'light'));

  const scrollTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <aside className="right-utility-rail" aria-label="Sayfa araclari">
        <button type="button" className="rail-dot-btn" aria-label="Dekoratif nokta">
          <span />
        </button>

        <button type="button" className="theme-toggle-pill" onClick={toggleTheme} aria-label="Tema degistir">
          <span className="theme-toggle-icon"><i className={`bi ${isDark ? 'bi-moon-stars' : 'bi-brightness-high'}`} /></span>
        </button>
      </aside>

      <button type="button" className="scroll-top-fab" onClick={scrollTop} aria-label="Sayfa basina don">
        Yükari Cik
      </button>
    </>
  );
}


