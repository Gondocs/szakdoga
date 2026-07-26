import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'app:soundAlertsEnabled';

interface SoundAlertContextValue {
  soundAlertsEnabled: boolean;
  setSoundAlertsEnabled: (enabled: boolean) => void;
  playAlertSound: () => void;
}

const SoundAlertContext = createContext<SoundAlertContextValue | undefined>(undefined);

/**
 * Nincs statikus hangfájl-asszet — egy rövid, kétütemű "beep"-et generálunk
 * a Web Audio API-val, hogy ne kelljen licencelt/letöltött audio-erőforrást
 * a repóba tenni egy ilyen apró UX-kiegészítésért.
 */
function playBeep(): void {
  const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  const ctx = new AudioContextClass();
  const now = ctx.currentTime;

  [0, 0.16].forEach((offset) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.15, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.14);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + 0.15);
  });

  setTimeout(() => ctx.close(), 500);
}

export function SoundAlertProvider({ children }: { children: ReactNode }) {
  const [soundAlertsEnabled, setSoundAlertsEnabledState] = useState<boolean>(() => localStorage.getItem(STORAGE_KEY) !== '0');
  const enabledRef = useRef(soundAlertsEnabled);
  enabledRef.current = soundAlertsEnabled;

  const setSoundAlertsEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    setSoundAlertsEnabledState(enabled);
  }, []);

  const playAlertSound = useCallback(() => {
    if (!enabledRef.current) return;
    try {
      playBeep();
    } catch {
      // A hangkimenet böngésző-specifikus korlátozásai (pl. felhasználói
      // interakció hiánya) nem szabad, hogy megakasszák a riasztás többi
      // részét (toast, értesítési központ) — csendben elnyeljük.
    }
  }, []);

  return (
    <SoundAlertContext.Provider value={{ soundAlertsEnabled, setSoundAlertsEnabled, playAlertSound }}>
      {children}
    </SoundAlertContext.Provider>
  );
}

export function useSoundAlert(): SoundAlertContextValue {
  const ctx = useContext(SoundAlertContext);
  if (!ctx) {
    throw new Error('useSoundAlert csak SoundAlertProvider-en belül használható.');
  }
  return ctx;
}
