import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskBadge } from './RiskBadge';
import type { RiskLevel } from '../../types';

describe('RiskBadge', () => {
  // Paraméterezett teszt: mind a négy kockázati szintre lefuttatja ugyanazt
  // az ellenőrzést a hozzá tartozó magyar címkével
  it.each<[RiskLevel, string]>([
    ['low', 'Alacsony'],
    ['medium', 'Közepes'],
    ['high', 'Magas'],
    ['critical', 'Kritikus'],
  ])('a "%s" kockázati szinthez a(z) "%s" magyar címkét jeleníti meg', (level, expectedLabel) => {
    render(<RiskBadge level={level} />);

    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });

  it('a "critical" szintet kiemelt (filled) jelvénnyel jeleníti meg, hogy szembetűnő legyen', () => {
    render(<RiskBadge level="critical" />);

    expect(screen.getByText('Kritikus').closest('.MuiChip-root')).toHaveClass('MuiChip-filled');
  });

  it('az alacsonyabb kockázati szinteket kereten (outlined) jeleníti meg', () => {
    render(<RiskBadge level="low" />);

    expect(screen.getByText('Alacsony').closest('.MuiChip-root')).toHaveClass('MuiChip-outlined');
  });
});
