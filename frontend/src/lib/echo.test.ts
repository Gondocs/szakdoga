import { describe, expect, it, vi, beforeEach } from 'vitest';

// A laravel-echo/pusher-js valós WebSocket-kapcsolatot nyitna, ami jsdom
// alatt nem elérhető — a konstruktort egy minimális, kézzel vezérelhető
// "connection" objektumot visszaadó mockra cseréljük, hogy a
// subscribeConnectionState() állapotkezelő logikáját önmagában, a tényleges
// hálózati réteg nélkül tudjuk tesztelni.
// vi.hoisted(): a vi.mock factory a fájl tetejére emelődik (hoisting), egy
// sima "const fakeConnection = ..." deklaráció ekkor még nem lenne
// elérhető — a vi.hoisted() biztosítja, hogy ez is a mock elé kerüljön.
const fakeConnection = vi.hoisted(() => ({
  state: 'connecting',
  bind: vi.fn(),
  unbind: vi.fn(),
}));

vi.mock('laravel-echo', () => ({
  // Sima function-kifejezés kell (nem arrow function), mert az echo.ts
  // `new Echo(...)`-val, konstruktorként hívja — arrow function sosem
  // hívható konstruktorként, azzal "is not a constructor" hibát dobna.
  default: vi.fn().mockImplementation(function FakeEcho() {
    return {
      connector: { pusher: { connection: fakeConnection } },
      private: vi.fn(),
      disconnect: vi.fn(),
    };
  }),
}));

vi.mock('pusher-js', () => ({ default: vi.fn() }));

import { subscribeConnectionState, disconnectEcho } from './echo';

beforeEach(() => {
  disconnectEcho();
  fakeConnection.state = 'connecting';
  fakeConnection.bind.mockClear();
  fakeConnection.unbind.mockClear();
});

describe('subscribeConnectionState', () => {
  it('feliratkozáskor azonnal meghívja a callbacket az aktuális kapcsolatállapottal', () => {
    fakeConnection.state = 'connected';
    const callback = vi.fn();

    subscribeConnectionState(callback);

    expect(callback).toHaveBeenCalledWith('connected');
  });

  it('feliratkozik a pusher-kapcsolat state_change eseményére', () => {
    subscribeConnectionState(vi.fn());

    expect(fakeConnection.bind).toHaveBeenCalledWith('state_change', expect.any(Function));
  });

  it('state_change esemény esetén az ekkor aktuális állapottal hívja újra a callbacket', () => {
    const callback = vi.fn();
    subscribeConnectionState(callback);
    callback.mockClear();

    const handler = fakeConnection.bind.mock.calls[0][1];
    fakeConnection.state = 'disconnected';
    handler();

    expect(callback).toHaveBeenCalledWith('disconnected');
  });

  it('a visszaadott leiratkozó függvény lekapcsolja a state_change listenert', () => {
    const unsubscribe = subscribeConnectionState(vi.fn());
    const handler = fakeConnection.bind.mock.calls[0][1];

    unsubscribe();

    expect(fakeConnection.unbind).toHaveBeenCalledWith('state_change', handler);
  });
});
