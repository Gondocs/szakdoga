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

  it('az aktuális útvonalnak megfelelő menüpontot kiemelve (contained) jeleníti meg', () => {
    renderNav('/esemenyek/event-1/szemelyek');

    expect(screen.getByRole('button', { name: /Regisztráltak/ })).toHaveClass('MuiButton-contained');
    expect(screen.getByRole('button', { name: /Áttekintés/ })).toHaveClass('MuiButton-outlined');
  });

  it('egy menüpontra kattintva az esemény adott aloldalára navigál', async () => {
    const user = userEvent.setup();
    renderNav('/esemenyek/event-1/attekintes');

    await user.click(screen.getByRole('button', { name: /Befogadóhelyek/ }));

    expect(navigateMock).toHaveBeenCalledWith('/esemenyek/event-1/befogadohelyek');
  });
});
