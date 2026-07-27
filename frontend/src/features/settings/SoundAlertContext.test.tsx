import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SoundAlertProvider, useSoundAlert } from './SoundAlertContext';

const STORAGE_KEY = 'app:soundAlertsEnabled';

// jsdom nem implementálja a Web Audio API-t — egy minimális mockkal
// helyettesítjük, ami elég ahhoz, hogy a playBeep() lefusson hiba nélkül,
// és a konstruktor hívásait meg tudjuk számolni (ez jelzi, hogy ténylegesen
// megpróbált-e hangot lejátszani).
class MockAudioContext {
  currentTime = 0;
  destination = {};
  createOscillator() {
    return {
      type: '',
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  createGain() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
  }
  close() {}
}

function TestConsumer() {
  const { soundAlertsEnabled, setSoundAlertsEnabled, playAlertSound } = useSoundAlert();

  return (
    <div>
      <span data-testid="enabled">{String(soundAlertsEnabled)}</span>
      <button type="button" onClick={() => setSoundAlertsEnabled(!soundAlertsEnabled)}>Váltás</button>
      <button type="button" onClick={playAlertSound}>Teszt hang</button>
    </div>
  );
}

function renderConsumer() {
  return render(
    <SoundAlertProvider>
      <TestConsumer />
    </SoundAlertProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => new MockAudioContext()));
});

describe('SoundAlertProvider / useSoundAlert', () => {
  it('useSoundAlert a Provider-en kívül hívva hibát dob', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow('useSoundAlert csak SoundAlertProvider-en belül használható.');

    consoleError.mockRestore();
  });

  it('tárolt érték nélkül alapból be van kapcsolva a hangjelzés', () => {
    renderConsumer();

    expect(screen.getByTestId('enabled')).toHaveTextContent('true');
  });

  it('korábban elmentett "0" érték esetén kikapcsolt állapotból indul', () => {
    localStorage.setItem(STORAGE_KEY, '0');

    renderConsumer();

    expect(screen.getByTestId('enabled')).toHaveTextContent('false');
  });

  it('setSoundAlertsEnabled frissíti az állapotot és a localStorage-t', async () => {
    const user = userEvent.setup();
    renderConsumer();

    await user.click(screen.getByRole('button', { name: 'Váltás' }));

    expect(screen.getByTestId('enabled')).toHaveTextContent('false');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('0');
  });

  it('bekapcsolt állapotban playAlertSound ténylegesen megpróbál hangot lejátszani', async () => {
    const user = userEvent.setup();
    renderConsumer();

    await user.click(screen.getByRole('button', { name: 'Teszt hang' }));

    expect(window.AudioContext).toHaveBeenCalled();
  });

  it('kikapcsolt állapotban playAlertSound nem próbál hangot lejátszani', async () => {
    const user = userEvent.setup();
    renderConsumer();

    await user.click(screen.getByRole('button', { name: 'Váltás' }));
    await user.click(screen.getByRole('button', { name: 'Teszt hang' }));

    expect(window.AudioContext).not.toHaveBeenCalled();
  });
});
