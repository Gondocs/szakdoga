import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('megjeleníti a címet', () => {
    render(<EmptyState title="Nincs találat" />);

    expect(screen.getByText('Nincs találat')).toBeInTheDocument();
  });

  it('egyedi ikont jelenít meg az alapértelmezett helyett, ha meg van adva', () => {
    render(<EmptyState title="Nincs találat" icon={<span data-testid="custom-icon" />} />);

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('megadott leírást és akció-gombot is megjelenít', () => {
    render(
      <EmptyState
        title="Nincs találat"
        description="Módosítsa a szűrőfeltételeket."
        action={<button type="button">Szűrők törlése</button>}
      />
    );

    expect(screen.getByText('Módosítsa a szűrőfeltételeket.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Szűrők törlése' })).toBeInTheDocument();
  });
});
