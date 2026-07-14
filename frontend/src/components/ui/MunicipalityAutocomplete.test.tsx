import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MunicipalityAutocomplete } from './MunicipalityAutocomplete';
import type { Municipality } from '../../types';

const municipalities: Municipality[] = [
  { id: 1, name: 'Győr', county: 'Győr-Moson-Sopron', postal_code: '9021' },
  { id: 2, name: 'Vámosszabadi', county: 'Győr-Moson-Sopron', postal_code: '9061' },
  { id: 3, name: 'Mosonmagyaróvár', county: 'Győr-Moson-Sopron', postal_code: '9200' },
];

describe('MunicipalityAutocomplete', () => {
  it('a "value" prop alapján a megfelelő település nevét jeleníti meg kiválasztva', () => {
    render(<MunicipalityAutocomplete municipalities={municipalities} value={2} onChange={vi.fn()} />);

    expect(screen.getByRole('combobox')).toHaveValue('Vámosszabadi');
  });

  it('üres value esetén nincs kiválasztott település', () => {
    render(<MunicipalityAutocomplete municipalities={municipalities} value="" onChange={vi.fn()} />);

    expect(screen.getByRole('combobox')).toHaveValue('');
  });

  it('gépeléssel szűri a felkínált településeket', async () => {
    const user = userEvent.setup();
    render(<MunicipalityAutocomplete municipalities={municipalities} value="" onChange={vi.fn()} />);

    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByRole('combobox'), 'Vámos');

    expect(screen.getByRole('option', { name: 'Vámosszabadi' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Győr' })).not.toBeInTheDocument();
  });

  it('egy opció kiválasztásakor az adott település id-jével hívja meg az onChange-t', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MunicipalityAutocomplete municipalities={municipalities} value="" onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Mosonmagyaróvár' }));

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('egyedi label-t jelenít meg, ha meg van adva', () => {
    render(
      <MunicipalityAutocomplete municipalities={municipalities} value="" onChange={vi.fn()} label="Célváros" />
    );

    expect(screen.getByLabelText('Célváros')).toBeInTheDocument();
  });
});
