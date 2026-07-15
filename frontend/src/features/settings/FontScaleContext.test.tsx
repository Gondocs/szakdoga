import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FontScaleProvider, useFontScale } from './FontScaleContext';

// Egyszerű teszt-komponens, ami a hookot fogyasztja, hogy a Context
// viselkedése (érték olvasása, setFontScale hívása) renderelt DOM-on
// keresztül is ellenőrizhető legyen
function TestConsumer() {
  const { fontScale, setFontScale } = useFontScale();
  return (
    <div>
      <span data-testid="current-scale">{fontScale}</span>
      <button type="button" onClick={() => setFontScale('large')}>Nagy</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.style.fontSize = '';
});

describe('FontScaleProvider / useFontScale', () => {
  it('useFontScale a Provider-en kívül hívva hibát dob', () => {
    // A hook a Context hiánya esetén explicit hibaüzenettel jelez, hogy a
    // fejlesztő elfelejtette a Provider-t — ezt teszteljük, nem a React
    // konzol-hibaüzenetét, ezért elnyomjuk azt a teszt idejére.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow('useFontScale csak FontScaleProvider-en belül használható.');

    consoleError.mockRestore();
  });

  it('tárolt érték nélkül "normal" az alapértelmezett betűméret-skála', () => {
    render(
      <FontScaleProvider>
        <TestConsumer />
      </FontScaleProvider>
    );

    expect(screen.getByTestId('current-scale')).toHaveTextContent('normal');
  });

  it('érvénytelen, korábban tárolt értéket figyelmen kívül hagy és "normal"-ra esik vissza', () => {
    localStorage.setItem('app:fontScale', 'huge');

    render(
      <FontScaleProvider>
        <TestConsumer />
      </FontScaleProvider>
    );

    expect(screen.getByTestId('current-scale')).toHaveTextContent('normal');
  });

  it('érvényes, korábban tárolt skálát betölt induláskor', () => {
    localStorage.setItem('app:fontScale', 'large');

    render(
      <FontScaleProvider>
        <TestConsumer />
      </FontScaleProvider>
    );

    expect(screen.getByTestId('current-scale')).toHaveTextContent('large');
  });

  it('setFontScale hívásakor frissíti az állapotot, elmenti localStorage-ba, és a gyökér elem betűméretét is módosítja', async () => {
    const user = userEvent.setup();
    render(
      <FontScaleProvider>
        <TestConsumer />
      </FontScaleProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Nagy' }));

    expect(screen.getByTestId('current-scale')).toHaveTextContent('large');
    expect(localStorage.getItem('app:fontScale')).toBe('large');
    expect(document.documentElement.style.fontSize).toBe(`${16 * 1.15}px`);
  });
});
