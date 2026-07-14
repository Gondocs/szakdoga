import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('zárva nem jeleníti meg a tartalmát', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Törlés megerősítése"
        description="Biztosan törli?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByText('Törlés megerősítése')).not.toBeInTheDocument();
  });

  it('a "Megerősítés" gombra kattintva meghívja az onConfirm-ot', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Törlés megerősítése"
        description="Biztosan törli?"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Megerősítés' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('a "Mégse" gombra kattintva meghívja az onCancel-t, nem az onConfirm-ot', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Törlés megerősítése"
        description="Biztosan törli?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Mégse' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('isSubmitting alatt letiltja a megerősítő gombot, hogy ne lehessen duplán elküldeni', () => {
    render(
      <ConfirmDialog
        open
        title="Törlés megerősítése"
        description="Biztosan törli?"
        isSubmitting
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Megerősítés/ })).toBeDisabled();
  });

  it('egyedi confirmLabel-t jelenít meg, ha meg van adva', () => {
    render(
      <ConfirmDialog
        open
        title="Cím"
        description="Leírás"
        confirmLabel="Igen, törlöm"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Igen, törlöm' })).toBeInTheDocument();
  });
});
