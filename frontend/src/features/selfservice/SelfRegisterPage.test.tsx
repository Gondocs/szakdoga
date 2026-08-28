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
  fetchPublicAssemblyPoints,
  selfRegister,
  selfRegisterFamily,
  type PublicEventInfo,
  type SelfRegisterResult,
} from '../../lib/api/endpoints';
import { toast } from 'react-toastify';
import type { AssemblyPoint, Municipality } from '../../types';

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
  fetchPublicAssemblyPoints: vi.fn(),
  selfRegister: vi.fn(),
  selfRegisterFamily: vi.fn(),
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

const assemblyPoints: AssemblyPoint[] = [
  { id: 1, event_id: 'event-1', name: 'Városháza', address: 'Győr, Fő tér 1.', lat: 47.68, lng: 17.63, notes: null, created_at: '2026-08-20T09:00:00Z' },
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
  await user.click(screen.getByRole('combobox', { name: /Válasszon gyülekezőpontot/ }));
  await user.click(await screen.findByRole('option', { name: /Városháza/ }));
}

beforeEach(() => {
  vi.mocked(fetchPublicEvent).mockReset().mockResolvedValue(event);
  vi.mocked(fetchPublicMunicipalities).mockReset().mockResolvedValue(municipalities);
  vi.mocked(fetchPublicAssemblyPoints).mockReset().mockResolvedValue(assemblyPoints);
  vi.mocked(selfRegister).mockReset();
  vi.mocked(selfRegisterFamily).mockReset();
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
    await user.click(screen.getByRole('checkbox', { name: /Központi szállítást igénylek/ }));
    await user.click(screen.getByRole('checkbox', { name: /Központi elszállásolást igénylek/ }));
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

  it('a "Központi szállítást igénylek" és a "Saját járművel…" jelölők kölcsönösen kizárják egymást', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Árvíz 2026 (ARVIZ-2026)');

    const transportCheckbox = screen.getByRole('checkbox', { name: /Központi szállítást igénylek/ });
    const ownVehicleCheckbox = screen.getByRole('checkbox', { name: /Saját járművel, magam választotta helyre utazom/ });

    await user.click(ownVehicleCheckbox);
    expect(ownVehicleCheckbox).toBeChecked();

    await user.click(transportCheckbox);
    expect(transportCheckbox).toBeChecked();
    expect(ownVehicleCheckbox).not.toBeChecked();

    await user.click(ownVehicleCheckbox);
    expect(ownVehicleCheckbox).toBeChecked();
    expect(transportCheckbox).not.toBeChecked();
  });

  it('sikeres előregisztráció után a QR-kódos visszaigazolást jeleníti meg a nevével és azonosítójával', async () => {
    const result: SelfRegisterResult = { person_id: 'person-1', full_name: 'Nagy Katalin', public_id: 'PUB-XYZ' };
    vi.mocked(selfRegister).mockResolvedValue(result);

    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Árvíz 2026 (ARVIZ-2026)');
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /Előregisztráció és QR-kód igénylése/ }));

    expect((await screen.findAllByText(/Nagy Katalin/)).length).toBeGreaterThan(0);
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

  it('"Családtag hozzáadása" gombra kattintva egy második, önálló adatlapot jelenít meg', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Árvíz 2026 (ARVIZ-2026)');

    await user.click(screen.getByRole('button', { name: 'Családtag hozzáadása' }));

    expect(screen.getByText('1. családtag')).toBeInTheDocument();
    expect(screen.getByText('2. családtag')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Vezetéknév/)).toHaveLength(2);
  });

  it('két családtaggal a selfRegisterFamily-t hívja, mindkettő saját adataival', async () => {
    vi.mocked(selfRegisterFamily).mockResolvedValue({
      members: [
        { person_id: 'person-1', full_name: 'Nagy Katalin', public_id: 'PUB-1' },
        { person_id: 'person-2', full_name: 'Nagy Béla', public_id: 'PUB-2' },
      ],
    });

    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Árvíz 2026 (ARVIZ-2026)');

    await fillRequiredFields(user);

    await user.click(screen.getByRole('button', { name: 'Családtag hozzáadása' }));
    await user.type(screen.getAllByLabelText(/Vezetéknév/)[1], 'Nagy');
    await user.type(screen.getAllByLabelText(/Keresztnév/)[1], 'Béla');
    await user.click(screen.getAllByRole('combobox', { name: /Település/ })[1]);
    await user.click((await screen.findAllByRole('option', { name: 'Győr' }))[0]);
    await user.click(screen.getAllByRole('combobox', { name: /Válasszon gyülekezőpontot/ })[1]);
    await user.click((await screen.findAllByRole('option', { name: /Városháza/ }))[0]);

    await user.click(screen.getByRole('button', { name: /Család előregisztrációja \(2 fő\)/ }));

    await waitFor(() => expect(selfRegisterFamily).toHaveBeenCalledTimes(1));
    expect(selfRegisterFamily).toHaveBeenCalledWith('ARVIZ-2026', {
      members: [
        expect.objectContaining({ last_name: 'Nagy', first_name: 'Katalin' }),
        expect.objectContaining({ last_name: 'Nagy', first_name: 'Béla' }),
      ],
    });
    expect(selfRegister).not.toHaveBeenCalled();

    expect(await screen.findByText('Nagy Katalin')).toBeInTheDocument();
    expect(screen.getByText('Nagy Béla')).toBeInTheDocument();
    expect(screen.getByText(/PUB-1/)).toBeInTheDocument();
    expect(screen.getByText(/PUB-2/)).toBeInTheDocument();
  });

  it('a családtag eltávolítása gombra kattintva megszünteti az adott adatlapot', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Árvíz 2026 (ARVIZ-2026)');

    await user.click(screen.getByRole('button', { name: 'Családtag hozzáadása' }));
    expect(screen.getAllByLabelText(/Vezetéknév/)).toHaveLength(2);

    await user.click(screen.getAllByRole('button', { name: 'Családtag eltávolítása' })[1]);

    expect(screen.getAllByLabelText(/Vezetéknév/)).toHaveLength(1);
    expect(screen.queryByText('1. családtag')).not.toBeInTheDocument();
  });
});
