import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { FamilyReunificationPage } from './FamilyReunificationPage';
import { addReunificationNote, fetchReunificationNotes, fetchReunificationWorklist } from '../../lib/api/endpoints';
import type { FamilyReunificationEntry } from '../../types';

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
  fetchReunificationWorklist: vi.fn(),
  fetchReunificationNotes: vi.fn(),
  addReunificationNote: vi.fn(),
}));

// A valódi react-leaflet DOM-méretezést/canvas-t igényel, ami jsdom alatt
// hibázna — a térkép jelenlétét/tartalmát egy egyszerű stubbal ellenőrizzük,
// nem a Leaflet tényleges renderelését teszteljük.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children: React.ReactNode }) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
}));

const family: FamilyReunificationEntry = {
  id: 'family-1',
  family_code: 'CSAL-001',
  members: [
    {
      id: 'person-1',
      full_name: 'Kovács Béla',
      current_shelter: 'Győri Sportcsarnok',
      shelter_id: 'shelter-a',
      shelter_coordinates: { lat: 47.68, lng: 17.63 },
    },
    {
      id: 'person-2',
      full_name: 'Kovács Béláné',
      current_shelter: 'Mosonmagyaróvári Iskola',
      shelter_id: 'shelter-b',
      shelter_coordinates: { lat: 47.87, lng: 17.27 },
    },
  ],
  latest_note: null,
  notes_count: 0,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <FamilyReunificationPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.mocked(fetchReunificationWorklist).mockReset().mockResolvedValue([family]);
  vi.mocked(fetchReunificationNotes).mockReset().mockResolvedValue([]);
  vi.mocked(addReunificationNote).mockReset();
  navigateMock.mockClear();
});

describe('FamilyReunificationPage', () => {
  it('üres munkalista esetén az üres állapotot jeleníti meg', async () => {
    vi.mocked(fetchReunificationWorklist).mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('Jelenleg nincs szétszakadt család')).toBeInTheDocument();
  });

  it('megjeleníti a szétszakadt családot, a helyszínek számával és a tagok kártyáival', async () => {
    renderPage();

    expect(await screen.findByText('CSAL-001')).toBeInTheDocument();
    expect(screen.getByText('2 különböző helyszín')).toBeInTheDocument();
    expect(screen.getByText(/Kovács Béla:.*Győri Sportcsarnok/)).toBeInTheDocument();
    expect(screen.getByText(/Kovács Béláné:.*Mosonmagyaróvári Iskola/)).toBeInTheDocument();
  });

  it('a részletek kinyitása előtt nem jelenik meg térkép, kinyitás után igen', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('CSAL-001');

    expect(screen.queryByText('Hol vannak most')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Részletek és térkép/ }));

    expect(await screen.findByText('Hol vannak most')).toBeInTheDocument();
    expect(screen.getByTestId('map')).toBeInTheDocument();
  });

  it('egy családtag kártyájára kattintva a személy adatlapjára navigál', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('CSAL-001');

    await user.click(screen.getByText(/Kovács Béla:.*Győri Sportcsarnok/));

    expect(navigateMock).toHaveBeenCalledWith('/szemelyek/person-1');
  });

  it('a bejegyzések párbeszédablakban új ügyintézési bejegyzés rögzíthető, ami frissíti a listát', async () => {
    vi.mocked(addReunificationNote).mockResolvedValue({
      id: 1,
      note: 'Átszállítás szervezés alatt.',
      resolved: false,
      created_by: 'Teszt Katalin',
      created_at: '2026-08-20T10:00:00Z',
    });

    const user = userEvent.setup();
    renderPage();
    await screen.findByText('CSAL-001');

    await user.click(screen.getByRole('button', { name: /Bejegyzések/ }));
    expect(await screen.findByText('CSAL-001 — családegyesítési bejegyzések')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Új bejegyzés'), 'Átszállítás szervezés alatt.');
    await user.click(screen.getByRole('button', { name: 'Hozzáadás' }));

    await waitFor(() =>
      expect(addReunificationNote).toHaveBeenCalledWith('family-1', {
        note: 'Átszállítás szervezés alatt.',
        resolved: false,
      })
    );
    expect(await screen.findByText(/Átszállítás szervezés alatt\./)).toBeInTheDocument();
  });

  it('üres bejegyzés-szöveggel nem küldhető be a bejegyzés', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('CSAL-001');

    await user.click(screen.getByRole('button', { name: /Bejegyzések/ }));
    await screen.findByText('CSAL-001 — családegyesítési bejegyzések');

    expect(screen.getByRole('button', { name: 'Hozzáadás' })).toBeDisabled();
    expect(addReunificationNote).not.toHaveBeenCalled();
  });
});
