import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { GettingStartedCard } from './GettingStartedCard';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderCard(props: { sheltersAssigned: boolean; hasRegistrations: boolean }) {
  return render(
    <MemoryRouter>
      <GettingStartedCard eventId="evt-1" {...props} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  mockNavigate.mockClear();
});

describe('GettingStartedCard', () => {
  it('mindkét lépés teljesítésekor nem jelenik meg', () => {
    renderCard({ sheltersAssigned: true, hasRegistrations: true });

    expect(screen.queryByText('Kezdő lépések')).not.toBeInTheDocument();
  });

  it('ha korábban el lett rejtve (localStorage), akkor nem jelenik meg, még hiányos állapotban sem', () => {
    localStorage.setItem('onboarding_dismissed:evt-1', '1');

    renderCard({ sheltersAssigned: false, hasRegistrations: false });

    expect(screen.queryByText('Kezdő lépések')).not.toBeInTheDocument();
  });

  it('friss (üres) eseménynél megjelenik, és mindkét ellenőrizhető lépés teljesítetlenként látszik', () => {
    renderCard({ sheltersAssigned: false, hasRegistrations: false });

    expect(screen.getByText('Kezdő lépések')).toBeInTheDocument();
    expect(screen.getByText('Rendeljen legalább egy befogadóhelyet az eseményhez')).toBeInTheDocument();
    expect(screen.getByText(/Rögzítse az első regisztrációt/)).toBeInTheDocument();
  });

  it('a "Befogadóhelyek" gombra kattintva a befogadóhelyek oldalra navigál', async () => {
    const user = userEvent.setup();
    renderCard({ sheltersAssigned: false, hasRegistrations: false });

    await user.click(screen.getByRole('button', { name: 'Befogadóhelyek' }));

    expect(mockNavigate).toHaveBeenCalledWith('/esemenyek/evt-1/befogadohelyek');
  });

  it('bezárás (X) gombra kattintva eltűnik és elmenti a döntést localStorage-ba', async () => {
    const user = userEvent.setup();
    renderCard({ sheltersAssigned: false, hasRegistrations: false });

    await user.click(screen.getByRole('button', { name: 'Elrejtés' }));

    expect(screen.queryByText('Kezdő lépések')).not.toBeInTheDocument();
    expect(localStorage.getItem('onboarding_dismissed:evt-1')).toBe('1');
  });

  it('csak a befogadóhely-lépés teljesítésekor is látszik még a kártya (a regisztráció-lépés miatt)', () => {
    renderCard({ sheltersAssigned: true, hasRegistrations: false });

    expect(screen.getByText('Kezdő lépések')).toBeInTheDocument();
  });
});
