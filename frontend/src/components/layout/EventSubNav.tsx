import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Paper, Stack, Button } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import GroupsIcon from '@mui/icons-material/Groups';
import HomeIcon from '@mui/icons-material/Home';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import MapIcon from '@mui/icons-material/Map';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { toast } from 'react-toastify';
import { connectEcho } from '../../lib/echo';
import type { IncidentCreatedPayload, RiskLevel, ShelterCapacityUpdatedPayload } from '../../types';

// Ugyanaz a két kis címke-térkép, mint amit az IncidentListPage használ a
// kategória/súlyosság magyar megjelenítéséhez — a backend csak a nyers
// enum-értéket küldi a WS-eseményben (App\Enums\IncidentCategory/Severity-
// nek nincs label() metódusa), a fordítás a frontend feladata.
const categoryLabels: Record<IncidentCreatedPayload['category'], string> = {
  complaint: 'Panasz',
  conflict: 'Konfliktus',
  security: 'Biztonsági esemény',
  damage: 'Káresemény',
  other: 'Egyéb',
};

const eventNavItems = [
  { to: 'attekintes', label: 'Áttekintés', icon: <DashboardIcon fontSize="small" /> },
  { to: 'szemelyek', label: 'Regisztráltak', icon: <PeopleAltIcon fontSize="small" /> },
  { to: 'befogadohelyek', label: 'Befogadóhelyek', icon: <HomeWorkIcon fontSize="small" /> },
  { to: 'csaladok', label: 'Családok', icon: <GroupsIcon fontSize="small" /> },
  { to: 'szallitas', label: 'Szállítás', icon: <DirectionsBusIcon fontSize="small" /> },
  { to: 'terkep', label: 'Térkép', icon: <MapIcon fontSize="small" /> },
  { to: 'rendkivuli-esemenyek', label: 'Rendkívüli események', icon: <WarningAmberIcon fontSize="small" /> },
  { to: 'visszatelepites', label: 'Visszatelepítés', icon: <HomeIcon fontSize="small" /> },
];

/**
 * Az esemény aloldalai (dashboard, regisztráltak, befogadóhelyek, családok,
 * szállítás, térkép, rendkívüli események, visszatelepítés) közötti gyors
 * váltást biztosítja — korábban csak az Áttekintés oldalról lehetett egy
 * másik szekcióba ugrani, minden más aloldalon vissza kellett navigálni oda.
 */
export function EventSubNav({ eventId }: { eventId: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const activeSegment = location.pathname.split('/').pop();

  // Az utoljára ismert kockázati szint befogadóhelyenként — ez azért kell,
  // hogy csak akkor toastoljunk, amikor egy befogadóhely ÚJONNAN éri el a
  // kritikus szintet, ne minden egyes (pl. továbbra is kritikus szinten
  // maradó) kapacitásváltozásnál.
  const lastKnownRiskLevels = useRef<Map<string, RiskLevel>>(new Map());

  // Ez a komponens az EventLayout-ban egyetlen, állandó példányban él az
  // esemény összes aloldalán (lásd EventLayout.tsx), ezért ez az egyetlen
  // hely, ahol a WS-feliratkozást fel kell építeni ahhoz, hogy az
  // incidens-/kritikus kapacitás-toast bárhol megjelenjen az eseményen belül.
  useEffect(() => {
    const channel = connectEcho().private(`event.${eventId}.updates`);

    channel.listen('.incident.created', (payload: IncidentCreatedPayload) => {
      const shelterInfo = payload.shelter_name ? ` (${payload.shelter_name})` : '';
      toast.warn(`Új ${categoryLabels[payload.category]}${shelterInfo}: ${payload.description}`);
    });

    channel.listen('.shelter.capacity.updated', (payload: ShelterCapacityUpdatedPayload) => {
      const previousLevel = lastKnownRiskLevels.current.get(payload.shelter_id);
      lastKnownRiskLevels.current.set(payload.shelter_id, payload.risk_level);

      if (payload.risk_level === 'critical' && previousLevel !== 'critical') {
        toast.error(`${payload.shelter_name} kritikus kockázati szintet ért el (${payload.checked_in_count}/${payload.capacity_limit} fő).`);
      }
    });

    return () => {
      channel.stopListening('.incident.created');
      channel.stopListening('.shelter.capacity.updated');
      connectEcho().leaveChannel(`event.${eventId}.updates`);
    };
  }, [eventId]);

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 3 }}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {eventNavItems.map((item) => {
          const isActive = activeSegment === item.to;
          return (
            <Button
              key={item.to}
              variant={isActive ? 'contained' : 'outlined'}
              size="small"
              color={isActive ? 'primary' : 'inherit'}
              startIcon={item.icon}
              onClick={() => navigate(`/esemenyek/${eventId}/${item.to}`)}
            >
              {item.label}
            </Button>
          );
        })}
      </Stack>
    </Paper>
  );
}
