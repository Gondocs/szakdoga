import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from './AuthContext';
import type { RoleCode, User } from '../../types';

// Az AuthContext-et mockoljuk, hogy tesztenként tetszőleges
// bejelentkezési/betöltési állapotot tudjunk beállítani anélkül, hogy
// valós bejelentkezési folyamatot kellene lefuttatni
vi.mock('./AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

// Egy minimális útvonal-fát épít fel a ProtectedRoute körül, hogy
// tesztelhető legyen a "Védett tartalom" megjelenítése vagy a
// "Bejelentkezés oldal"-ra való átirányítás
function renderProtected(allow?: Parameters<typeof ProtectedRoute>[0]['allow']) {
  return render(
    <MemoryRouter initialEntries={['/vedett']}>
      <Routes>
        <Route path="/bejelentkezes" element={<div>Bejelentkezés oldal</div>} />
        <Route
          path="/vedett"
          element={
            <ProtectedRoute allow={allow}>
              <div>Védett tartalom</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

function makeUser(roleCode: RoleCode): User {
  return {
    id: 1,
    name: 'Teszt Elek',
    email: 'teszt@example.com',
    role: { id: 1, code: roleCode, name: roleCode },
  };
}

// A ProtectedRoute csak a user/isLoading mezőket használja, a többi
// AuthContext-mezőt (2FA-hoz kapcsolódó állapot/műveletek) csak a típus
// teljessége miatt kell megadni a mockban.
const authMockDefaults = {
  pendingTwoFactor: false,
  login: vi.fn(),
  verifyTwoFactor: vi.fn(),
  resendTwoFactor: vi.fn(),
  cancelTwoFactor: vi.fn(),
  logout: vi.fn(),
  setUser: vi.fn(),
};

describe('ProtectedRoute', () => {
  it('betöltés közben töltésjelzőt mutat, nem a védett tartalmat', () => {
    mockedUseAuth.mockReturnValue({
      ...authMockDefaults,
      user: null,
      isLoading: true,
    });

    renderProtected();

    expect(screen.queryByText('Védett tartalom')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('bejelentkezés nélkül a bejelentkezési oldalra irányít', () => {
    mockedUseAuth.mockReturnValue({
      ...authMockDefaults,
      user: null,
      isLoading: false,
    });

    renderProtected();

    expect(screen.getByText('Bejelentkezés oldal')).toBeInTheDocument();
    expect(screen.queryByText('Védett tartalom')).not.toBeInTheDocument();
  });

  it('bejelentkezett, de nem engedélyezett szerepkörnél a "Nincs jogosultsága" oldalt mutatja', () => {
    mockedUseAuth.mockReturnValue({
      ...authMockDefaults,
      user: makeUser('registrar'),
      isLoading: false,
    });

    renderProtected(['admin', 'manager']);

    expect(screen.getByText('Nincs jogosultsága az oldal megtekintéséhez')).toBeInTheDocument();
    expect(screen.queryByText('Védett tartalom')).not.toBeInTheDocument();
  });

  it('engedélyezett szerepkörrel megjeleníti a védett tartalmat', () => {
    mockedUseAuth.mockReturnValue({
      ...authMockDefaults,
      user: makeUser('admin'),
      isLoading: false,
    });

    renderProtected(['admin', 'manager']);

    expect(screen.getByText('Védett tartalom')).toBeInTheDocument();
  });

  it('"allow" megadása nélkül bármely bejelentkezett felhasználónak megjeleníti a tartalmat', () => {
    mockedUseAuth.mockReturnValue({
      ...authMockDefaults,
      user: makeUser('auditor'),
      isLoading: false,
    });

    renderProtected();

    expect(screen.getByText('Védett tartalom')).toBeInTheDocument();
  });
});
