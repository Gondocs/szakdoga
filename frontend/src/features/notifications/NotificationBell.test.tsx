import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { NotificationBell } from './NotificationBell';
import { NotificationCenterProvider, useNotificationCenter, type AppNotification } from './NotificationCenterContext';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// A NotificationCenterContext-et csak a Provideren keresztül lehet
// feltölteni — ez a segédkomponens a teszt-notifikációkat rögtön
// felvételkor beszúrja, mielőtt a NotificationBell megjelenítené a listát.
function Seed({ notifications }: { notifications: Omit<AppNotification, 'id' | 'createdAt' | 'read'>[] }) {
  const { addNotification } = useNotificationCenter();

  useEffect(() => {
    notifications.forEach(addNotification);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function renderBell(notifications: Omit<AppNotification, 'id' | 'createdAt' | 'read'>[] = []) {
  return render(
    <MemoryRouter>
      <NotificationCenterProvider>
        <Seed notifications={notifications} />
        <NotificationBell />
      </NotificationCenterProvider>
    </MemoryRouter>
  );
}

describe('NotificationBell', () => {
  it('értesítés nélkül nem jelenít meg jelvény-számot', () => {
    renderBell();

    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('olvasatlan értesítéseknél a jelvényen a darabszámot mutatja', () => {
    renderBell([
      { message: 'Első riasztás', severity: 'warning' },
      { message: 'Második riasztás', severity: 'error' },
    ]);

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('a harangra kattintva megjeleníti az értesítések listáját', async () => {
    const user = userEvent.setup();
    renderBell([{ message: 'Kritikus kapacitás', severity: 'error' }]);

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Kritikus kapacitás')).toBeInTheDocument();
  });

  it('üres lista esetén az "Nincs értesítés" üres állapotot mutatja', async () => {
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Nincs értesítés')).toBeInTheDocument();
  });

  it('"Mind olvasott"-ra kattintva elrejti a jelvényt (MuiBadge-invisible)', async () => {
    const user = userEvent.setup();
    renderBell([{ message: 'Riasztás', severity: 'warning' }]);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByRole('button', { name: 'Mind olvasott' }));

    expect(screen.getByText('1')).toHaveClass('MuiBadge-invisible');
  });

  it('egy értesítésre kattintva a hozzá tartozó linkre navigál', async () => {
    const user = userEvent.setup();
    renderBell([{ message: 'Új incidens történt', severity: 'warning', link: '/esemenyek/abc/rendkivuli-esemenyek' }]);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('Új incidens történt'));

    expect(mockNavigate).toHaveBeenCalledWith('/esemenyek/abc/rendkivuli-esemenyek');
  });
});
