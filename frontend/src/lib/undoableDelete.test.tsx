import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

// A react-toastify-t mockoljuk, hogy a toast(...) hívás argumentumaként
// átadott, JSX-et visszaadó "content" függvényt közvetlenül tudjuk
// renderelni és tesztelni — anélkül, hogy egy valódi ToastContainer-t
// kellene felépíteni a teszthez.
vi.mock('react-toastify', () => {
  const toastFn = vi.fn();
  (toastFn as unknown as { error: ReturnType<typeof vi.fn> }).error = vi.fn();
  return { toast: toastFn };
});

import { toast } from 'react-toastify';
import { scheduleUndoableDelete } from './undoableDelete';

type ToastContentFn = (props: { closeToast?: () => void }) => ReactNode;

function renderToastContent() {
  const contentFn = vi.mocked(toast).mock.calls.at(-1)?.[0] as ToastContentFn;
  render(<>{contentFn({ closeToast: vi.fn() })}</>);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(toast).mockClear();
  vi.mocked(toast.error).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('scheduleUndoableDelete', () => {
  it('megjelenít egy toast-ot az üzenettel és egy "Visszavonás" gombbal', () => {
    scheduleUndoableDelete({ message: '"Teszt" törölve.', onCommit: vi.fn(), onUndo: vi.fn() });

    renderToastContent();

    expect(screen.getByText('"Teszt" törölve.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Visszavonás' })).toBeInTheDocument();
  });

  it('a késleltetési idő lejárta előtt NEM hívja meg a commit függvényt', () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    scheduleUndoableDelete({ message: 'törölve', onCommit, onUndo: vi.fn(), delayMs: 6000 });

    vi.advanceTimersByTime(5999);

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('a késleltetési idő lejártakor meghívja a commit függvényt, ha nem történt visszavonás', () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    scheduleUndoableDelete({ message: 'törölve', onCommit, onUndo: vi.fn(), delayMs: 6000 });

    vi.advanceTimersByTime(6000);

    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('"Visszavonás"-ra kattintva megelőzi a commit hívást, és meghívja az onUndo-t', () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const onUndo = vi.fn();
    scheduleUndoableDelete({ message: 'törölve', onCommit, onUndo, delayMs: 6000 });
    renderToastContent();

    fireEvent.click(screen.getByRole('button', { name: 'Visszavonás' }));
    vi.advanceTimersByTime(6000);

    expect(onCommit).not.toHaveBeenCalled();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('sikertelen commit esetén egyedi onError hívódik, és az elem visszaáll (onUndo)', async () => {
    const onCommit = vi.fn().mockRejectedValue(new Error('sikertelen törlés'));
    const onUndo = vi.fn();
    const onError = vi.fn();
    scheduleUndoableDelete({ message: 'törölve', onCommit, onUndo, onError, delayMs: 1000 });

    await vi.advanceTimersByTimeAsync(1000);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('sikertelen commit esetén, egyedi onError nélkül, egy általános toast.error üzenetet jelenít meg', async () => {
    const onCommit = vi.fn().mockRejectedValue(new Error('sikertelen törlés'));
    const onUndo = vi.fn();
    scheduleUndoableDelete({ message: 'törölve', onCommit, onUndo, delayMs: 1000 });

    await vi.advanceTimersByTimeAsync(1000);

    expect(toast.error).toHaveBeenCalledWith('A törlés nem sikerült.');
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('sikeres commit után nem hívja meg újra a visszavonást, ha később mégis megnyomnák', () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const onUndo = vi.fn();
    scheduleUndoableDelete({ message: 'törölve', onCommit, onUndo, delayMs: 1000 });
    renderToastContent();

    vi.advanceTimersByTime(1000);
    fireEvent.click(screen.getByRole('button', { name: 'Visszavonás' }));

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onUndo).not.toHaveBeenCalled();
  });
});
