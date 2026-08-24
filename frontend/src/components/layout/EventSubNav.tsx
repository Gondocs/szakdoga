import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Paper, Stack, Box, Typography, IconButton, Tooltip, Divider } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
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

const WIDTH_EXPANDED = 220;
const WIDTH_COLLAPSED = 60;
const COLLAPSED_STORAGE_KEY = 'event_subnav_collapsed';

/**
 * Az esemény aloldalai (dashboard, regisztráltak, befogadóhelyek, családok,
 * szállítás, térkép, rendkívüli események, visszatelepítés) közötti gyors
 * váltást biztosítja — korábban csak az Áttekintés oldalról lehetett egy
 * másik szekcióba ugrani, minden más aloldalon vissza kellett navigálni oda.
 *
 * Ugyanúgy összecsukható (csak ikonos módra váltható), mint a fő oldalsáv
 * (AppLayout) — enélkül a szélesebb tartalmú oldalak (pl. a dashboard
 * kártya-/diagram-rácsa) mindig elveszítenék az oldalsáv szélességét, akár
 * kell éppen a felhasználónak a navigáció, akár nem.
 */
export function EventSubNav({ eventId }: { eventId: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const activeSegment = location.pathname.split('/').pop();
  const { addNotification } = useNotificationCenter();
  const { playAlertSound } = useSoundAlert();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1');

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

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        width: { xs: '100%', md: collapsed ? WIDTH_COLLAPSED : WIDTH_EXPANDED },
        flexShrink: 0,
        alignSelf: 'flex-start',
        transition: 'width 0.15s ease',
        // A menü a saját tartalmához igazodó magasságú, ezért hosszú
        // aloldalakon (pl. a dashboard) lejjebb görgetve simán "kifutott
        // volna" a nézetből, a tartalom pedig továbbra is csak a menü
        // szélességével keskenyebb oszlopban maradt — a bal oldalon üresen
        // tátongó hellyel. A sticky pozícióval a menü az AppBar alatt
        // végig a helyén marad, ameddig a mellette lévő tartalom tart.
        position: { xs: 'static', md: 'sticky' },
        top: { md: 80 },
        maxHeight: { md: 'calc(100vh - 96px)' },
        overflowY: { md: 'auto' },
      }}
    >
      <Stack spacing={0.5}>
        {eventNavGroups.map((group, groupIndex) => (
          <Box key={group.label ?? 'root'}>
            {group.label && (collapsed ? (
              <Divider sx={{ my: 0.75 }} />
            ) : (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, pt: groupIndex === 0 ? 0.5 : 1.75, pb: 0.75, px: 1.5 }}
              >
                {group.label}
              </Typography>
            ))}
            <Stack spacing={0.25}>
              {group.items.map((item) => {
                const isActive = activeSegment === item.to;
                const button = (
                  <Box
                    key={item.to}
                    component="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => navigate(`/esemenyek/${eventId}/${item.to}`)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      gap: 1.375,
                      width: '100%',
                      minHeight: 44,
                      px: collapsed ? 0 : 1.5,
                      py: 1,
                      border: 'none',
                      borderLeft: '3px solid',
                      borderLeftColor: isActive ? 'primary.main' : 'transparent',
                      borderRadius: 1,
                      bgcolor: isActive ? 'rgba(163, 23, 43, 0.09)' : 'transparent',
                      color: isActive ? 'primary.main' : 'text.primary',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '0.875rem',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: isActive ? 'rgba(163, 23, 43, 0.09)' : 'action.hover' },
                    }}
                  >
                    <Box sx={{ display: 'flex', color: isActive ? 'primary.main' : 'text.secondary' }}>{item.icon}</Box>
                    {!collapsed && item.label}
                  </Box>
                );

                return collapsed ? (
                  <Tooltip key={item.to} title={item.label} placement="right">
                    {button}
                  </Tooltip>
                ) : (
                  button
                );
              })}
            </Stack>
          </Box>
        ))}

        <Divider sx={{ mt: 0.5 }} />
        <Box sx={{ display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
          <Tooltip title={collapsed ? 'Menü kibontása' : 'Menü összecsukása'} placement="right">
            <IconButton onClick={toggleCollapsed} size="small">
              {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      </Stack>
    </Paper>
  );
}
