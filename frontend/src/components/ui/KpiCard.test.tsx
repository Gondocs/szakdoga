import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KpiCard } from './KpiCard';

describe('KpiCard', () => {
  it('megjeleníti a címkét és az értéket', () => {
    render(<KpiCard label="Regisztráltak" value={187} />);

    expect(screen.getByText('Regisztráltak')).toBeInTheDocument();
    expect(screen.getByText('187')).toBeInTheDocument();
  });

  it('szöveges értéket (pl. "26 / 50") is elfogad, nem csak számot', () => {
    render(<KpiCard label="Fedélzeten" value="26 / 50" />);

    expect(screen.getByText('26 / 50')).toBeInTheDocument();
  });

  it('onClick megadása esetén kattintásra meghívja a handlert', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<KpiCard label="Hiányzók" value={2} onClick={onClick} />);

    await user.click(screen.getByText('Hiányzók'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
