import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PersonDetailPage } from './PersonDetailPage';
import {
  fetchPerson,
  fetchCareEvents,
  fetchShelters,
  fetchStatusHistory,
  fetchCitizenHistory,
  fetchMunicipalities,
} from '../../lib/api/endpoints';
import type { Person } from '../../types';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ personId: 'person-1' }),
  };
});

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

// A PersonDetailPage a kiszervezett dialógus-komponenseket (EditPersonDialog,
// TransferShelterDialog, BedLabelDialog, StatusHistoryDialog,
// CitizenHistoryDialog) valódi implementációként rendereli — ez a teszt
// pontosan azt ellenőrzi, hogy a szétbontás után a vezérlőelemek (nyitó
// gombok, personId/eventId/citizenId propok) helyesen vannak-e bekötve,
// ezért ezeket szándékosan nem mockoljuk, csak az általuk hívott API-kat.
vi.mock('../../lib/api/endpoints', () => ({
  fetchPerson: vi.fn(),
  fetchCareEvents: vi.fn(),
  issueQrToken: vi.fn(),
  deliverQrToken: vi.fn(),
  updateRegistrationStatus: vi.fn(),
  uploadPersonDocumentPhoto: vi.fn(),
  deletePersonDocumentPhoto: vi.fn(),
  temporaryLeave: vi.fn(),
  temporaryReturn: vi.fn(),
  fetchShelters: vi.fn(),
  transferPerson: vi.fn(),
  updateBedAssignment: vi.fn(),
  fetchStatusHistory: vi.fn(),
  fetchCitizenHistory: vi.fn(),
  fetchMunicipalities: vi.fn(),
  updatePerson: vi.fn(),
}));

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 'person-1',
    event_id: 'event-1',
    citizen_id: 'citizen-1',
    family_id: 'family-1',
    family: { id: 'family-1', family_code: 'CSAL-001' },
    last_name: 'Kovács',
    first_name: 'Béla',
    full_name: 'Kovács Béla',
    birth_place: null,
    birth_date: null,
    address: { postal_code: null, settlement: null, street: null, house_number: null },
    phone: null,
    email: null,
    current_shelter: { id: 'shelter-a', name: 'Győri Sportcsarnok' },
    registration: {
      id: 'reg-1',
      status: 'arrived_shelter',
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

function renderPage() {
  return render(
    <MemoryRouter>
      <PersonDetailPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(fetchPerson).mockReset().mockResolvedValue(makePerson());
  vi.mocked(fetchCareEvents).mockReset().mockResolvedValue([]);
  vi.mocked(fetchShelters).mockReset().mockResolvedValue([]);
  vi.mocked(fetchStatusHistory).mockReset().mockResolvedValue([]);
  vi.mocked(fetchCitizenHistory).mockReset().mockResolvedValue({
    citizen: { id: 'citizen-1', full_name: 'Kovács Béla', id_document_number: 'AB123456' },
    registrations: [],
  });
  vi.mocked(fetchMunicipalities).mockReset().mockResolvedValue([]);
  navigateMock.mockClear();
});

describe('PersonDetailPage', () => {
  it('betöltés után megjeleníti a személy alapadatait', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Kovács Béla' })).toBeInTheDocument();
    expect(fetchPerson).toHaveBeenCalledWith('person-1');
  });

  it('a "Státusztörténet" ikonra kattintva megnyitja a StatusHistoryDialog-ot a helyes personId-vel', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Kovács Béla' });

    await user.click(screen.getByRole('button', { name: 'Státusztörténet' }));

    expect(await screen.findByText('Státusztörténet', { selector: 'h2' })).toBeInTheDocument();
    await waitFor(() => expect(fetchStatusHistory).toHaveBeenCalledWith('person-1'));
  });

  it('a "Korábbi kitelepítések" ikonra kattintva megnyitja a CitizenHistoryDialog-ot a helyes citizenId-vel', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Kovács Béla' });

    await user.click(screen.getByRole('button', { name: 'Korábbi kitelepítések' }));

    expect(await screen.findByText('Korábbi kitelepítések', { selector: 'h2' })).toBeInTheDocument();
    await waitFor(() => expect(fetchCitizenHistory).toHaveBeenCalledWith('citizen-1'));
  });

  it('az "Áthelyezés másik befogadóhelyre" gombra kattintva megnyitja a TransferShelterDialog-ot a helyes eventId-vel', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Kovács Béla' });

    await user.click(screen.getByRole('button', { name: 'Áthelyezés másik befogadóhelyre' }));

    expect(await screen.findByText('Áthelyezés másik befogadóhelyre', { selector: 'h2' })).toBeInTheDocument();
    await waitFor(() => expect(fetchShelters).toHaveBeenCalledWith('event-1'));
  });

  it('a bejelentkezési adat "Szerkesztés" gombjára kattintva megnyitja a BedLabelDialog-ot', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Kovács Béla' });

    await user.click(screen.getByRole('button', { name: 'Szerkesztés' }));

    expect(await screen.findByText('Ágy/szoba azonosító módosítása')).toBeInTheDocument();
  });

  it('az "Adatok szerkesztése" ikonra kattintva megnyitja az EditPersonDialog-ot, és betölti a településlistát', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'Kovács Béla' });

    await user.click(screen.getByRole('button', { name: 'Adatok szerkesztése' }));

    expect(await screen.findByText('Adatok szerkesztése', { selector: 'h2' })).toBeInTheDocument();
    await waitFor(() => expect(fetchMunicipalities).toHaveBeenCalled());
  });
});
