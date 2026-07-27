import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationCenterProvider, useNotificationCenter } from './NotificationCenterContext';

function TestConsumer() {
  const { notifications, unreadCount, addNotification, markAllRead, markRead, clear } = useNotificationCenter();

  return (
    <div>
      <span data-testid="unread-count">{unreadCount}</span>
      <span data-testid="total-count">{notifications.length}</span>
      <ul>
        {notifications.map((n) => (
          <li key={n.id} data-testid="notification" data-read={n.read}>{n.message}</li>
        ))}
      </ul>
      <button type="button" onClick={() => addNotification({ message: 'Új incidens', severity: 'warning' })}>
        Hozzáadás
      </button>
      <button type="button" onClick={markAllRead}>Mind olvasott</button>
      <button type="button" onClick={() => notifications[0] && markRead(notifications[0].id)}>
        Első olvasottnak jelölése
      </button>
      <button type="button" onClick={clear}>Törlés</button>
    </div>
  );
}

function renderConsumer() {
  return render(
    <NotificationCenterProvider>
      <TestConsumer />
    </NotificationCenterProvider>
  );
}

describe('NotificationCenterProvider / useNotificationCenter', () => {
  it('useNotificationCenter a Provider-en kívül hívva hibát dob', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow('useNotificationCenter csak NotificationCenterProvider-en belül használható.');

    consoleError.mockRestore();
  });

  it('induláskor üres a lista, nulla olvasatlannal', () => {
    renderConsumer();

    expect(screen.getByTestId('total-count')).toHaveTextContent('0');
    expect(screen.getByTestId('unread-count')).toHaveTextContent('0');
  });

  it('addNotification hozzáad egy olvasatlan bejegyzést, és növeli az olvasatlan számlálót', async () => {
    const user = userEvent.setup();
    renderConsumer();

    await user.click(screen.getByRole('button', { name: 'Hozzáadás' }));

    expect(screen.getByTestId('total-count')).toHaveTextContent('1');
    expect(screen.getByTestId('unread-count')).toHaveTextContent('1');
    expect(screen.getByText('Új incidens')).toBeInTheDocument();
  });

  it('markRead csak a megadott bejegyzést jelöli olvasottnak, a többit nem', async () => {
    const user = userEvent.setup();
    renderConsumer();

    await user.click(screen.getByRole('button', { name: 'Hozzáadás' }));
    await user.click(screen.getByRole('button', { name: 'Hozzáadás' }));
    expect(screen.getByTestId('unread-count')).toHaveTextContent('2');

    await user.click(screen.getByRole('button', { name: 'Első olvasottnak jelölése' }));

    expect(screen.getByTestId('unread-count')).toHaveTextContent('1');
  });

  it('markAllRead az összes bejegyzést olvasottá teszi, a listát nem üríti ki', async () => {
    const user = userEvent.setup();
    renderConsumer();

    await user.click(screen.getByRole('button', { name: 'Hozzáadás' }));
    await user.click(screen.getByRole('button', { name: 'Hozzáadás' }));
    await user.click(screen.getByRole('button', { name: 'Mind olvasott' }));

    expect(screen.getByTestId('unread-count')).toHaveTextContent('0');
    expect(screen.getByTestId('total-count')).toHaveTextContent('2');
  });

  it('clear kiüríti a teljes listát', async () => {
    const user = userEvent.setup();
    renderConsumer();

    await user.click(screen.getByRole('button', { name: 'Hozzáadás' }));
    await user.click(screen.getByRole('button', { name: 'Törlés' }));

    expect(screen.getByTestId('total-count')).toHaveTextContent('0');
    expect(screen.getByTestId('unread-count')).toHaveTextContent('0');
  });

  it('a lista legfeljebb 50 bejegyzést tart meg, a legrégebbit eldobva', async () => {
    const user = userEvent.setup();
    renderConsumer();

    for (let i = 0; i < 55; i++) {
      // eslint-disable-next-line no-await-in-loop
      await user.click(screen.getByRole('button', { name: 'Hozzáadás' }));
    }

    expect(screen.getByTestId('total-count')).toHaveTextContent('50');
  });
});
