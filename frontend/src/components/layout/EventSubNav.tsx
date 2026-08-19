import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Paper, Stack, Button, Typography, Divider } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import GroupsIcon from '@mui/icons-material/Groups';
import HomeIcon from '@mui/icons-material/Home';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import MapIcon from '@mui/icons-material/Map';
import PlaceIcon from '@mui/icons-material/Place';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { toast } from 'react-toastify';
import { connectEcho } from '../../lib/echo';
import { useNotificationCenter } from '../../features/notifications/NotificationCenterContext';
import { useSoundAlert } from '../../features/settings/SoundAlertContext';
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

// A korábbi, egyetlen sík listába rendezett menü helyett a fülek négy,
// vizuálisan elkülönített, a kitelepítés valós fázisaihoz igazodó
// csoportba vannak rendezve — ez segít eldönteni, mikor melyik
// menüpontra van szükség (lásd Súgó, "Mikor van rá szükség" szakaszok).
const eventNavGroups: { label: string | null; items: { to: string; label: string; icon: React.ReactNode }[] }[] = [
  {
    label: null,
    items: [{ to: 'attekintes', label: 'Áttekintés', icon: <DashboardIcon fontSize="small" /> }],
  },
  {
    label: 'Előkészítés',
    items: [{ to: 'gyulekezopontok', label: 'Gyülekezőpontok', icon: <PlaceIcon fontSize="small" /> }],
  },
  {
    label: 'Napi működés',
    items: [
      { to: 'szemelyek', label: 'Regisztráltak', icon: <PeopleAltIcon fontSize="small" /> },
      { to: 'befogadohelyek', label: 'Befogadóhelyek', icon: <HomeWorkIcon fontSize="small" /> },
      { to: 'csaladok', label: 'Családok', icon: <GroupsIcon fontSize="small" /> },
      { to: 'szallitas', label: 'Szállítás', icon: <DirectionsBusIcon fontSize="small" /> },
      { to: 'terkep', label: 'Térkép', icon: <MapIcon fontSize="small" /> },
      { to: 'rendkivuli-esemenyek', label: 'Rendkívüli események', icon: <WarningAmberIcon fontSize="small" /> },
    ],
  },
  {
    label: 'Lezárás',
    items: [{ to: 'visszatelepites', label: 'Visszatelepítés', icon: <HomeIcon fontSize="small" /> }],
  },
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
  const { addNotification } = useNotificationCenter();
  const { playAlertSound } = useSoundAlert();

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
      const message = `Új ${categoryLabels[payload.category]}${shelterInfo}: ${payload.description}`;
      toast.warn(message);
      addNotification({ message, severity: 'warning', link: `/esemenyek/${eventId}/rendkivuli-esemenyek` });
      playAlertSound();
    });

    channel.listen('.shelter.capacity.updated', (payload: ShelterCapacityUpdatedPayload) => {
      const previousLevel = lastKnownRiskLevels.current.get(payload.shelter_id);
      lastKnownRiskLevels.current.set(payload.shelter_id, payload.risk_level);

      if (payload.risk_level === 'critical' && previousLevel !== 'critical') {
        const message = `${payload.shelter_name} kritikus kockázati szintet ért el (${payload.checked_in_count}/${payload.capacity_limit} fő).`;
        toast.error(message);
        addNotification({ message, severity: 'error', link: `/esemenyek/${eventId}/befogadohelyek` });
        playAlertSound();
      }
    });

    return () => {
      channel.stopListening('.incident.created');
      channel.stopListening('.shelter.capacity.updated');
      connectEcho().leaveChannel(`event.${eventId}.updates`);
    };
  }, [eventId, addNotification, playAlertSound]);

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 3 }}>
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
        {eventNavGroups.map((group, groupIndex) => (
          <Stack key={group.label ?? 'root'} direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
            {groupIndex > 0 && <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />}
            {group.label && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, mr: 0.5 }}
              >
                {group.label}
              </Typography>
            )}
            {group.items.map((item) => {
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
        ))}
      </Stack>
    </Paper>
  );
}
