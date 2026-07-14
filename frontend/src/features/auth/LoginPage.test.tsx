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

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedUseAuth = vi.mocked(useAuth);

beforeEach(() => {
  navigateMock.mockClear();
});

describe('LoginPage', () => {
  it('sikeres bejelentkezés esetén a megadott adatokkal hívja a login-t és a kezdőlapra navigál', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({ user: null, isLoading: false, login, logout: vi.fn(), setUser: vi.fn() });

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
    mockedUseAuth.mockReturnValue({ user: null, isLoading: false, login, logout: vi.fn(), setUser: vi.fn() });

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
    let resolveLogin: () => void = () => {};
    const login = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLogin = resolve;
        })
    );
    mockedUseAuth.mockReturnValue({ user: null, isLoading: false, login, logout: vi.fn(), setUser: vi.fn() });

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

    resolveLogin();
    await waitFor(() => expect(screen.getByRole('button', { name: /Bejelentkezés/ })).not.toBeDisabled());
  });
});
