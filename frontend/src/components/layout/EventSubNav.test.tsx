import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { EventSubNav } from './EventSubNav';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateMock };
});

const channelStub = { listen: vi.fn(), stopListening: vi.fn() };

vi.mock('../../lib/echo', () => ({
  connectEcho: vi.fn(() => ({
    private: vi.fn(() => channelStub),
    leaveChannel: vi.fn(),
  })),
}));

vi.mock('../../features/notifications/NotificationCenterContext', () => ({
  useNotificationCenter: () => ({ addNotification: vi.fn() }),
}));

vi.mock('../../features/settings/SoundAlertContext', () => ({
  useSoundAlert: () => ({ playAlertSound: vi.fn() }),
}));

function renderNav(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <EventSubNav eventId="event-1" />
    </MemoryRouter>
  );
}

beforeEach(() => {
  navigateMock.mockClear();
  localStorage.clear();
});

describe('EventSubNav', () => {
  it('a menüpontokat négy, feliratozott csoportba rendezve jeleníti meg', () => {
    renderNav('/esemenyek/event-1/attekintes');

    expect(screen.getByText('Előkészítés')).toBeInTheDocument();
    expect(screen.getByText('Napi működés')).toBeInTheDocument();
    expect(screen.getByText('Lezárás')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Áttekintés/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gyülekezőpontok/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Regisztráltak/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Visszatelepítés/ })).toBeInTheDocument();
  });

  it('az aktuális útvonalnak megfelelő menüpontot jelöli aktívként (aria-current)', () => {
    renderNav('/esemenyek/event-1/szemelyek');

    expect(screen.getByRole('button', { name: /Regisztráltak/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Áttekintés/ })).not.toHaveAttribute('aria-current');
  });

  it('egy menüpontra kattintva az esemény adott aloldalára navigál', async () => {
    const user = userEvent.setup();
    renderNav('/esemenyek/event-1/attekintes');

    await user.click(screen.getByRole('button', { name: /Befogadóhelyek/ }));

    expect(navigateMock).toHaveBeenCalledWith('/esemenyek/event-1/befogadohelyek');
  });

  it('összecsukáskor eltűnnek a szöveges címkék, de a gombok (tooltippel) továbbra is elérhetők maradnak', async () => {
    const user = userEvent.setup();
    renderNav('/esemenyek/event-1/attekintes');

    await user.click(screen.getByRole('button', { name: 'Menü összecsukása' }));

    expect(screen.queryByText('Regisztráltak')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regisztráltak' })).toBeInTheDocument();
    expect(localStorage.getItem('event_subnav_collapsed')).toBe('1');
  });

  it('a korábban elmentett összecsukott állapotot betöltéskor visszaállítja', () => {
    localStorage.setItem('event_subnav_collapsed', '1');
    renderNav('/esemenyek/event-1/attekintes');

    expect(screen.queryByText('Napi működés')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menü kibontása' })).toBeInTheDocument();
  });
});
