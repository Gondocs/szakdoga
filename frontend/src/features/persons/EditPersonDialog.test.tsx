import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditPersonDialog } from './PersonDetailPage';
import { fetchMunicipalities, updatePerson } from '../../lib/api/endpoints';
import type { Person } from '../../types';

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/api/endpoints', () => ({
  fetchMunicipalities: vi.fn(),
  updatePerson: vi.fn(),
}));

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 'person-1',
    event_id: 'event-1',
    family_id: null,
    last_name: 'Kovács',
    first_name: 'Béla',
    full_name: 'Kovács Béla',
    birth_place: null,
    birth_date: null,
    address: { postal_code: null, settlement: null, street: null, house_number: null },
    phone: '+36301112233',
    email: 'bela@example.com',
    registration: {
      id: 'reg-1',
      status: 'registered',
      channel: 'staff',
      central_transport_required: false,
      central_accommodation_required: false,
      under_regular_medical_care: false,
      own_vehicle: false,
      travels_alone: false,
      registered_at: '2026-08-20T09:00:00Z',
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(fetchMunicipalities).mockReset().mockResolvedValue([]);
  vi.mocked(updatePerson).mockReset().mockResolvedValue(makePerson());
});

describe('EditPersonDialog', () => {
  it('a meglévő regisztráció szállítási/elszállásolási jelölőit előre kitöltve jeleníti meg', async () => {
    const person = makePerson({
      registration: {
        id: 'reg-1',
        status: 'registered',
        channel: 'staff',
        central_transport_required: true,
        central_accommodation_required: false,
        under_regular_medical_care: false,
        own_vehicle: false,
        travels_alone: false,
        registered_at: '2026-08-20T09:00:00Z',
      },
    });

    render(<EditPersonDialog person={person} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByLabelText('Kér központi szállítást')).toBeChecked();
    expect(screen.getByLabelText('Kér elszállásolást')).not.toBeChecked();
  });

  it('a jelölők átállítása és mentés az updatePerson-t a helyes payloaddal hívja', async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<EditPersonDialog person={makePerson()} onClose={vi.fn()} onSaved={onSaved} />);

    await user.click(screen.getByLabelText('Kér központi szállítást'));
    await user.click(screen.getByLabelText('Kér elszállásolást'));
    await user.click(screen.getByRole('button', { name: 'Mentés' }));

    await waitFor(() =>
      expect(updatePerson).toHaveBeenCalledWith(
        'person-1',
        expect.objectContaining({
          central_transport_required: true,
          central_accommodation_required: true,
        })
      )
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('mentés nélkül, "Mégse"-re kattintva nem hívja meg az updatePerson-t', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EditPersonDialog person={makePerson()} onClose={onClose} onSaved={vi.fn()} />);

    await user.click(screen.getByLabelText('Kér központi szállítást'));
    await user.click(screen.getByRole('button', { name: 'Mégse' }));

    expect(updatePerson).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('sikertelen mentés esetén hibaüzenetet ad, és nem hívja meg onSaved-et', async () => {
    vi.mocked(updatePerson).mockRejectedValue(new Error('event closed'));
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(<EditPersonDialog person={makePerson()} onClose={vi.fn()} onSaved={onSaved} />);

    await user.click(screen.getByRole('button', { name: 'Mentés' }));

    await waitFor(() => expect(updatePerson).toHaveBeenCalledTimes(1));
    expect(onSaved).not.toHaveBeenCalled();
  });
});
