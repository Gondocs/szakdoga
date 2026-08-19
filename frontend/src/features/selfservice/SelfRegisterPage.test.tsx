import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { SelfRegisterPage } from './SelfRegisterPage';
import {
  fetchPublicEvent,
  fetchPublicMunicipalities,
  selfRegister,
  type PublicEventInfo,
  type SelfRegisterResult,
} from '../../lib/api/endpoints';
import { toast } from 'react-toastify';
import type { Municipality } from '../../types';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ eventCode: 'ARVIZ-2026' }),
  };
});

vi.mock('react-toastify', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/api/endpoints', () => ({
  fetchPublicEvent: vi.fn(),
  fetchPublicMunicipalities: vi.fn(),
  selfRegister: vi.fn(),
}));

// A valódi QRCodeCanvas jsdom alatt (a `canvas` csomag hiányában) a
// getContext('2d')-t nem tudja meghívni — a QR-kód tényleges rajzolása
// helyett egy stubot renderelünk, csak a sikeres regisztráció utáni
// felület jelenlétét vizsgáljuk.
vi.mock('qrcode.react', () => ({
  QRCodeCanvas: ({ value }: { value: string }) => <canvas data-testid="qr-canvas" data-value={value} />,
}));

const municipalities: Municipality[] = [
  { id: 1, name: 'Győr', county: 'Győr-Moson-Sopron', postal_code: '9021' },
];

const event: PublicEventInfo = { id: 'event-1', code: 'ARVIZ-2026', name: 'Árvíz 2026', status: 'active' };

function renderPage() {
  return render(
    <MemoryRouter>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <SelfRegisterPage />
      </LocalizationProvider>
    </MemoryRouter>
  );
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Vezetéknév/), 'Nagy');
  await user.type(screen.getByLabelText(/Keresztnév/), 'Katalin');
  await user.click(screen.getByRole('combobox', { name: /Település/ }));
  await user.click(await screen.findByRole('option', { name: 'Győr' }));
}

beforeEach(() => {
  vi.mocked(fetchPublicEvent).mockReset().mockResolvedValue(event);
  vi.mocked(fetchPublicMunicipalities).mockReset().mockResolvedValue(municipalities);
  vi.mocked(selfRegister).mockReset();
  vi.mocked(toast.error).mockClear();
});

describe('SelfRegisterPage', () => {
  it('alapból bejelöletlen szállítási/elszállásolási igényekkel küldi be az előregisztrációt', async () => {
    vi.mocked(selfRegister).mockResolvedValue({ person_id: 'person-1', full_name: 'Nagy Katalin', public_id: 'PUB-1' });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Árvíz 2026 (ARVIZ-2026)');
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Előregisztráció és QR-kód igénylése/ }));

    await waitFor(() => expect(selfRegister).toHaveBeenCalledTimes(1));
    expect(selfRegister).toHaveBeenCalledWith(
      'ARVIZ-2026',
      expect.objectContaining({
        last_name: 'Nagy',
        first_name: 'Katalin',
        municipality_id: 1,
        own_vehicle: false,
        central_transport_required: false,
        central_accommodation_required: false,
      })
    );
  });

  it('a "Központi szállítást igénylek" és "Központi elszállásolást igénylek" jelölők bejelölve is elmennek a kérésben', async () => {
    vi.mocked(selfRegister).mockResolvedValue({ person_id: 'person-1', full_name: 'Nagy Katalin', public_id: 'PUB-1' });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Árvíz 2026 (ARVIZ-2026)');
    await fillRequiredFields(user);
    await user.click(screen.getByLabelText('Központi szállítást igénylek'));
    await user.click(screen.getByLabelText('Központi elszállásolást igénylek'));
    await user.click(screen.getByRole('button', { name: /Előregisztráció és QR-kód igénylése/ }));

    await waitFor(() => expect(selfRegister).toHaveBeenCalledTimes(1));
    expect(selfRegister).toHaveBeenCalledWith(
      'ARVIZ-2026',
      expect.objectContaining({
        central_transport_required: true,
        central_accommodation_required: true,
      })
    );
  });

  it('sikeres előregisztráció után a QR-kódos visszaigazolást jeleníti meg a nevével és azonosítójával', async () => {
    const result: SelfRegisterResult = { person_id: 'person-1', full_name: 'Nagy Katalin', public_id: 'PUB-XYZ' };
    vi.mocked(selfRegister).mockResolvedValue(result);

    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Árvíz 2026 (ARVIZ-2026)');
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Előregisztráció és QR-kód igénylése/ }));

    expect(await screen.findByText(/Nagy Katalin/)).toBeInTheDocument();
    expect(screen.getByTestId('qr-canvas')).toHaveAttribute('data-value', 'PUB-XYZ');
    expect(screen.getByText(/PUB-XYZ/)).toBeInTheDocument();
  });

  it('sikertelen beküldés esetén hibaüzenetet jelenít meg, és az űrlap marad', async () => {
    vi.mocked(selfRegister).mockRejectedValue(new Error('validation error'));

    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Árvíz 2026 (ARVIZ-2026)');
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Előregisztráció és QR-kód igénylése/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /Előregisztráció és QR-kód igénylése/ })).toBeInTheDocument();
  });

  it('érvénytelen eseménykód esetén hibaüzenetet jelenít meg az űrlap helyett', async () => {
    vi.mocked(fetchPublicEvent).mockRejectedValue(new Error('not found'));

    renderPage();

    expect(await screen.findByText(/Nincs ilyen kódú/)).toBeInTheDocument();
  });
});
