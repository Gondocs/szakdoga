import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { RegistrationWizardPage } from './RegistrationWizardPage';
import { createPerson, fetchFamilies, fetchMunicipalities } from '../../lib/api/endpoints';
import type { Municipality, Person } from '../../types';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ eventId: 'event-1' }),
  };
});

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/api/endpoints', () => ({
  createPerson: vi.fn(),
  fetchFamilies: vi.fn(),
  fetchMunicipalities: vi.fn(),
}));

const municipalities: Municipality[] = [
  { id: 1, name: 'Győr', county: 'Győr-Moson-Sopron', postal_code: '9021' },
];

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
    phone: null,
    email: null,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <RegistrationWizardPage />
      </LocalizationProvider>
    </MemoryRouter>
  );
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Vezetéknév/), 'Kovács');
  await user.type(screen.getByLabelText(/Keresztnév/), 'Béla');
  await user.click(screen.getByRole('combobox', { name: /Település/ }));
  await user.click(await screen.findByRole('option', { name: 'Győr' }));
}

beforeEach(() => {
  vi.mocked(createPerson).mockReset().mockResolvedValue(makePerson());
  vi.mocked(fetchFamilies).mockReset().mockResolvedValue([]);
  vi.mocked(fetchMunicipalities).mockReset().mockResolvedValue(municipalities);
  navigateMock.mockClear();
});

describe('RegistrationWizardPage', () => {
  it('alapból bejelöletlen szállítási/ellátási igényekkel küldi be az adatokat', async () => {
    const user = userEvent.setup();
    renderPage();

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Regisztráció rögzítése' }));

    await waitFor(() => expect(createPerson).toHaveBeenCalledTimes(1));
    expect(createPerson).toHaveBeenCalledWith(
      'event-1',
      expect.objectContaining({
        last_name: 'Kovács',
        first_name: 'Béla',
        municipality_id: 1,
        central_transport_required: false,
        central_accommodation_required: false,
        under_regular_medical_care: false,
        own_vehicle: false,
      })
    );
  });

  it('a "Központi szállítást igényel" és "Központi elszállásolást igényel" jelölők bejelölve is elmennek a kérésben', async () => {
    const user = userEvent.setup();
    renderPage();

    await fillRequiredFields(user);
    await user.click(screen.getByLabelText('Központi szállítást igényel'));
    await user.click(screen.getByLabelText('Központi elszállásolást igényel'));
    await user.click(screen.getByRole('button', { name: 'Regisztráció rögzítése' }));

    await waitFor(() => expect(createPerson).toHaveBeenCalledTimes(1));
    expect(createPerson).toHaveBeenCalledWith(
      'event-1',
      expect.objectContaining({
        central_transport_required: true,
        central_accommodation_required: true,
      })
    );
  });

  it('település kiválasztása nélkül nem küldi be az űrlapot', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/Vezetéknév/), 'Kovács');
    await user.type(screen.getByLabelText(/Keresztnév/), 'Béla');
    await user.click(screen.getByRole('button', { name: 'Regisztráció rögzítése' }));

    expect(createPerson).not.toHaveBeenCalled();
  });

  it('sikeres mentés után siker-üzenetet jelenít meg a személy nevével és lehetőséget ad a QR-kódra/listára navigálásra', async () => {
    vi.mocked(createPerson).mockResolvedValue(makePerson({ id: 'person-42', full_name: 'Nagy Elemér' }));

    const user = userEvent.setup();
    renderPage();

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Regisztráció rögzítése' }));

    expect(await screen.findByText(/Nagy Elemér/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'QR-kód' }));
    expect(navigateMock).toHaveBeenCalledWith('/szemelyek/person-42');
  });

  it('a mentés alatt letiltja a beküldés gombot, hogy ne lehessen duplán elküldeni', async () => {
    let resolveCreate: (person: Person) => void = () => {};
    vi.mocked(createPerson).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );

    const user = userEvent.setup();
    renderPage();

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Regisztráció rögzítése' }));

    expect(screen.getByRole('button', { name: 'Mentés…' })).toBeDisabled();

    resolveCreate(makePerson());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Regisztráció rögzítése' })).not.toBeDisabled());
  });
});
