import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('a megadott hibaüzenetet "error" súlyosságú riasztásban jeleníti meg', () => {
    render(<ErrorState message="Nem sikerült betölteni az adatokat." />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Nem sikerült betölteni az adatokat.');
  });
});
