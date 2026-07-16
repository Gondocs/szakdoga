import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { useAuth } from './AuthContext';

const navigateMock = vi.fn();

vi.mock('./AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Csak a useNavigate hookot mockoljuk ki (a többi react-router-dom exportot
// az eredeti implementáció szolgáltatja, pl. a MemoryRouter-t is
// használjuk), hogy ellenőrizhető legyen, hova navigál a komponens
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedUseAuth = vi.mocked(useAuth);

// Az AuthContext mock alapértelmezett formája, amit az egyes teszteknél
// felülírunk a vizsgált forgatókönyvnek megfelelő login/verifyTwoFactor
// mock-okkal.
function makeAuthMock(overrides: Partial<ReturnType<typeof useAuth>> = {}): ReturnType<typeof useAuth> {
  return {
    user: null,
    isLoading: false,
    pendingTwoFactor: false,
    login: vi.fn().mockResolvedValue(false),
    verifyTwoFactor: vi.fn().mockResolvedValue(undefined),
    resendTwoFactor: vi.fn().mockResolvedValue(undefined),
    cancelTwoFactor: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  navigateMock.mockClear();
});

describe('LoginPage', () => {
  it('sikeres bejelentkezés esetén (nincs 2FA) a megadott adatokkal hívja a login-t és a kezdőlapra navigál', async () => {
    const login = vi.fn().mockResolvedValue(false);
    mockedUseAuth.mockReturnValue(makeAuthMock({ login }));

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/E-mail cím/), 'nagy.katalin@example.com');
    await user.type(screen.getByLabelText(/Jelszó/), 'titkosjelszo');
    await user.click(screen.getByRole('button', { name: /Bejelentkezés/ }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('nagy.katalin@example.com', 'titkosjelszo'));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/'));
  });

  it('sikertelen bejelentkezés esetén nem navigál el', async () => {
    const login = vi.fn().mockRejectedValue(new Error('invalid credentials'));
    mockedUseAuth.mockReturnValue(makeAuthMock({ login }));

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/E-mail cím/), 'nagy.katalin@example.com');
    await user.type(screen.getByLabelText(/Jelszó/), 'rossz-jelszo');
    await user.click(screen.getByRole('button', { name: /Bejelentkezés/ }));

    await waitFor(() => expect(login).toHaveBeenCalledTimes(1));
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('a beküldés alatt letiltja a gombot, hogy ne lehessen duplán elküldeni', async () => {
    // A login Promise-t szándékosan "lógva" hagyjuk (a resolve függvényt
    // kimentjük), hogy a teszt a beküldés közbeni (pending) állapotban is
    // meg tudja vizsgálni a gomb letiltottságát, mielőtt manuálisan
    // feloldanánk a Promise-t
    let resolveLogin: (value: boolean) => void = () => {};
    const login = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveLogin = resolve;
        })
    );
    mockedUseAuth.mockReturnValue(makeAuthMock({ login }));

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/E-mail cím/), 'nagy.katalin@example.com');
    await user.type(screen.getByLabelText(/Jelszó/), 'titkosjelszo');
    await user.click(screen.getByRole('button', { name: /Bejelentkezés/ }));

    expect(screen.getByRole('button', { name: /Bejelentkezés/ })).toBeDisabled();

    resolveLogin(false);
    await waitFor(() => expect(screen.getByRole('button', { name: /Bejelentkezés/ })).not.toBeDisabled());
  });

  it('ha a login 2FA-t kér, a kódbeviteli lépés jelenik meg, és a helyes kóddal bejelentkeztet', async () => {
    const login = vi.fn().mockResolvedValue(true);
    const verifyTwoFactor = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue(makeAuthMock({ login, verifyTwoFactor, pendingTwoFactor: false }));

    const user = userEvent.setup();
    const { rerender } = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText(/E-mail cím/), 'nagy.katalin@example.com');
    await user.type(screen.getByLabelText(/Jelszó/), 'titkosjelszo');
    await user.click(screen.getByRole('button', { name: /Bejelentkezés/ }));

    await waitFor(() => expect(login).toHaveBeenCalled());

    // A login után a pendingTwoFactor a context-ben igazra vált, amit a
    // komponens újrarenderelésével szimulálunk (a valódi AuthProvider ezt
    // state-frissítéssel automatikusan megtenné).
    mockedUseAuth.mockReturnValue(makeAuthMock({ login, verifyTwoFactor, pendingTwoFactor: true }));
    rerender(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const codeField = screen.getByLabelText(/Kód/);
    await user.type(codeField, '123456');
    await user.click(screen.getByRole('button', { name: /Belépés/ }));

    await waitFor(() => expect(verifyTwoFactor).toHaveBeenCalledWith('123456'));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/'));
  });

  it('a "Vissza" gombra kattintva a cancelTwoFactor-t hívja', async () => {
    const cancelTwoFactor = vi.fn();
    mockedUseAuth.mockReturnValue(makeAuthMock({ pendingTwoFactor: true, cancelTwoFactor }));

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /Vissza/ }));

    expect(cancelTwoFactor).toHaveBeenCalledTimes(1);
  });
});
