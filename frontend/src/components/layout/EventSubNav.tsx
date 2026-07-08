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
