import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventStatusBadge } from './EventStatusBadge';
import type { EventStatus } from '../../types';

describe('EventStatusBadge', () => {
  // Paraméterezett teszt: a négy lehetséges eseménystátusz mindegyikére
  // egy-egy futtatást indít, ellenőrizve a hozzá tartozó magyar címkét
  it.each<[EventStatus, string]>([
    ['draft', 'Tervezet'],
    ['active', 'Aktív'],
    ['paused', 'Szüneteltetve'],
    ['closed', 'Lezárva'],
  ])('a(z) "%s" eseménystátuszhoz a(z) "%s" magyar címkét jeleníti meg', (status, expectedLabel) => {
    render(<EventStatusBadge status={status} />);

    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });

  it('az "active" státuszt sikerjelző (zöld) színnel emeli ki', () => {
    render(<EventStatusBadge status="active" />);

    expect(screen.getByText('Aktív').closest('.MuiChip-root')).toHaveClass('MuiChip-colorSuccess');
  });

  it('a "paused" státuszt figyelmeztető (sárga) színnel emeli ki', () => {
    render(<EventStatusBadge status="paused" />);

    expect(screen.getByText('Szüneteltetve').closest('.MuiChip-root')).toHaveClass('MuiChip-colorWarning');
  });
});
