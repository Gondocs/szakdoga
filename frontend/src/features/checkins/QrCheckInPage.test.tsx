import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QrCheckInPage } from './QrCheckInPage';
import { checkInPerson, fetchShelters, resolveQrToken } from '../../lib/api/endpoints';
import { useAuth } from '../auth/AuthContext';
import type { Person, ShelterWithRisk } from '../../types';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ eventId: 'event-1' }),
    useSearchParams: () => [new URLSearchParams()],
  };
});

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('../../lib/api/endpoints', () => ({
  checkInPerson: vi.fn(),
  fetchShelters: vi.fn(),
  resolveQrToken: vi.fn(),
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

const shelterA: ShelterWithRisk = {
  event_shelter_id: 1,
  shelter: {
    id: 'shelter-a',
    name: 'Győri Sportcsarnok',
    address: 'Győr, Teszt utca 1.',
    capacity_total: 100,
    accessible_capacity: 10,
    medical_support_available: true,
    drinking_water_available: true,
    meals_available: true,
    hygiene_facilities_available: true,
    childcare_available: false,
    psychological_support_available: false,
    house_rules: null,
    public_health_notes: null,
    status: 'active',
    contact_phone: null,
  },
  capacity_limit: 100,
  checked_in_count: 10,
  free_capacity: 90,
  utilization: 10,
  risk_score: 0,
  risk_level: 'low',
  match_score: null,
  match_reasons: [],
};

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
    email: null,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <QrCheckInPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(fetchShelters).mockReset().mockResolvedValue([shelterA]);
  vi.mocked(resolveQrToken).mockReset().mockResolvedValue(makePerson());
  vi.mocked(checkInPerson).mockReset().mockResolvedValue({
    checkIn: {
      id: 1,
      event_id: 'event-1',
      person: { id: 'person-1', full_name: 'Kovács Béla' },
      shelter: { id: 'shelter-a', name: 'Győri Sportcsarnok' },
      checked_in_at: '2026-08-20T10:00:00Z',
      checked_in_by: 'Teszt Ügyintéző',
    },
    familySplitWarning: null,
  });
  mockedUseAuth.mockReturnValue({
    user: { id: 1, name: 'Teszt Ügyintéző', email: 'ugyintezo@example.com', shelter_id: null },
    isLoading: false,
    pendingTwoFactor: false,
    login: vi.fn(),
    verifyTwoFactor: vi.fn(),
    resendTwoFactor: vi.fn(),
    cancelTwoFactor: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
  });
});

describe('QrCheckInPage', () => {
  it('betöltéskor lekéri a befogadóhelyeket, és automatikusan kiválasztja az elsőt', async () => {
    renderPage();

    await waitFor(() => expect(fetchShelters).toHaveBeenCalledWith('event-1'));
    expect(await screen.findByText(/Győri Sportcsarnok/)).toBeInTheDocument();
  });

  it('azonosító keresésekor betölti és megjeleníti a személy adatait', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(fetchShelters).toHaveBeenCalled());

    await user.type(screen.getByLabelText(/QR-kód azonosító/), 'PUB-123');
    await user.click(screen.getByRole('button', { name: 'Keresés' }));

    expect(await screen.findByText('Kovács Béla')).toBeInTheDocument();
    expect(resolveQrToken).toHaveBeenCalledWith('PUB-123');
    expect(screen.getByText(/\+36301112233/)).toBeInTheDocument();
  });

  it('megerősítéskor a kiválasztott befogadóhelyre, a beírt azonosítóval és ágyszámmal érkezteti a személyt', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(fetchShelters).toHaveBeenCalled());

    await user.type(screen.getByLabelText(/QR-kód azonosító/), 'PUB-123');
    await user.click(screen.getByRole('button', { name: 'Keresés' }));
    await screen.findByText('Kovács Béla');

    await user.type(screen.getByLabelText(/Ágy\/szoba\/szektor azonosító/), 'A terem, 5. ágy');
    await user.click(screen.getByRole('button', { name: 'Érkeztetés megerősítése' }));

    await waitFor(() =>
      expect(checkInPerson).toHaveBeenCalledWith('shelter-a', {
        event_id: 'event-1',
        public_id: 'PUB-123',
        bed_label: 'A terem, 5. ágy',
      })
    );

    // Sikeres érkeztetés után az előnézet eltűnik, az űrlap ürül.
    await waitFor(() => expect(screen.queryByText('Kovács Béla')).not.toBeInTheDocument());
  });

  it('szétszakadt családra figyelmeztető válasz esetén is lezárja az előnézetet (a figyelmeztetés toast formájában jelenik meg)', async () => {
    vi.mocked(checkInPerson).mockResolvedValue({
      checkIn: {
        id: 2,
        event_id: 'event-1',
        person: { id: 'person-1', full_name: 'Kovács Béla' },
        shelter: { id: 'shelter-a', name: 'Győri Sportcsarnok' },
        checked_in_at: '2026-08-20T10:00:00Z',
        checked_in_by: 'Teszt Ügyintéző',
      },
      familySplitWarning: 'A család egy másik tagja jelenleg más befogadóhelyen tartózkodik.',
    });

    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(fetchShelters).toHaveBeenCalled());

    await user.type(screen.getByLabelText(/QR-kód azonosító/), 'PUB-123');
    await user.click(screen.getByRole('button', { name: 'Keresés' }));
    await screen.findByText('Kovács Béla');
    await user.click(screen.getByRole('button', { name: 'Érkeztetés megerősítése' }));

    await waitFor(() => expect(checkInPerson).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText('Kovács Béla')).not.toBeInTheDocument());
  });

  it('hibás/ismeretlen azonosító esetén nem jelenít meg előnézetet', async () => {
    vi.mocked(resolveQrToken).mockRejectedValue(new Error('not found'));

    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(fetchShelters).toHaveBeenCalled());

    await user.type(screen.getByLabelText(/QR-kód azonosító/), 'ERVENYTELEN');
    await user.click(screen.getByRole('button', { name: 'Keresés' }));

    await waitFor(() => expect(resolveQrToken).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Érkeztetés megerősítése' })).not.toBeInTheDocument();
  });
});
