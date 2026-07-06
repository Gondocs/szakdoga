import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type FontScale = 'small' | 'normal' | 'large' | 'extra-large';

const SCALE_FACTORS: Record<FontScale, number> = {
  small: 0.9,
  normal: 1,
  large: 1.15,
  'extra-large': 1.3,
};

const STORAGE_KEY = 'app:fontScale';

function isFontScale(value: string | null): value is FontScale {
  return value === 'small' || value === 'normal' || value === 'large' || value === 'extra-large';
}

interface FontScaleContextValue {
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
}

const FontScaleContext = createContext<FontScaleContextValue | undefined>(undefined);

export function FontScaleProvider({ children }: { children: ReactNode }) {
  const [fontScale, setFontScaleState] = useState<FontScale>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isFontScale(stored) ? stored : 'normal';
  });

  useEffect(() => {
    document.documentElement.style.fontSize = `${16 * SCALE_FACTORS[fontScale]}px`;
  }, [fontScale]);

  function setFontScale(scale: FontScale) {
    localStorage.setItem(STORAGE_KEY, scale);
    setFontScaleState(scale);
  }

  return <FontScaleContext.Provider value={{ fontScale, setFontScale }}>{children}</FontScaleContext.Provider>;
}

export function useFontScale(): FontScaleContextValue {
  const ctx = useContext(FontScaleContext);
  if (!ctx) {
    throw new Error('useFontScale csak FontScaleProvider-en belül használható.');
  }
  return ctx;
}
