import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator';
import { subscribeConnectionState } from '../../lib/echo';

vi.mock('../../lib/echo', () => ({
  subscribeConnectionState: vi.fn(),
}));

const mockedSubscribe = vi.mocked(subscribeConnectionState);

beforeEach(() => {
  mockedSubscribe.mockReset();
});

describe('ConnectionStatusIndicator', () => {
  it('kapcsolódás közben szinkronizáló ikont jelenít meg', () => {
    mockedSubscribe.mockImplementation((callback) => {
      callback('connecting');
      return vi.fn();
    });

    render(<ConnectionStatusIndicator />);

    expect(screen.getByTestId('SyncIcon')).toBeInTheDocument();
  });

  it('élő kapcsolat esetén wifi ikont jelenít meg', () => {
    mockedSubscribe.mockImplementation((callback) => {
      callback('connected');
      return vi.fn();
    });

    render(<ConnectionStatusIndicator />);

    expect(screen.getByTestId('WifiIcon')).toBeInTheDocument();
  });

  it('megszakadt kapcsolat esetén áthúzott wifi ikont jelenít meg', () => {
    mockedSubscribe.mockImplementation((callback) => {
      callback('disconnected');
      return vi.fn();
    });

    render(<ConnectionStatusIndicator />);

    expect(screen.getByTestId('WifiOffIcon')).toBeInTheDocument();
  });

  it('nem elérhető ("unavailable") állapotban is az áthúzott wifi ikont jelöníti meg', () => {
    mockedSubscribe.mockImplementation((callback) => {
      callback('unavailable');
      return vi.fn();
    });

    render(<ConnectionStatusIndicator />);

    expect(screen.getByTestId('WifiOffIcon')).toBeInTheDocument();
  });

  it('unmountkor leiratkozik a kapcsolatállapot-figyelésről', () => {
    const unsubscribe = vi.fn();
    mockedSubscribe.mockImplementation((callback) => {
      callback('connected');
      return unsubscribe;
    });

    const { unmount } = render(<ConnectionStatusIndicator />);
    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
