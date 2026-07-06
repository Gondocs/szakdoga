import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Stack, Grid, CircularProgress, Card, CardActionArea, CardContent } from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import GroupIcon from '@mui/icons-material/Group';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ShieldMoonIcon from '@mui/icons-material/ShieldMoon';
import type { EvacuationEvent } from '../../types';
import { fetchEvents } from '../../lib/api/endpoints';
import { EventStatusBadge } from '../events/EventStatusBadge';
import { useAuth } from '../auth/AuthContext';

const roleLabels: Record<string, string> = {
  admin: 'Rendszergazda',
  manager: 'Vezető',
  registrar: 'Regisztrátor',
  shelter_operator: 'Befogadóhelyi kezelő',
  auditor: 'Auditor',
};

interface QuickLink {
  to: string;
  label: string;
  description: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const quickLinks: QuickLink[] = [
  { to: '/esemenyek', label: 'Kitelepítési események', description: 'Összes esemény áttekintése és kezelése', icon: <EventIcon fontSize="large" /> },
  { to: '/befogadohelyek', label: 'Befogadóhelyek', description: 'Törzsadatok: kapacitás, elérhetőségek', icon: <HomeWorkIcon fontSize="large" /> },
  { to: '/telepulesek', label: 'Települések', description: 'Település törzsadatok kezelése', icon: <LocationCityIcon fontSize="large" /> },
  { to: '/jarmuvek', label: 'Járművek', description: 'Szállítójármű-flotta törzsadatai', icon: <DirectionsBusIcon fontSize="large" /> },
  { to: '/naplo', label: 'Napló', description: 'Rendszerszintű tevékenységnapló', icon: <HistoryEduIcon fontSize="large" /> },
  { to: '/felhasznalok', label: 'Felhasználók', description: 'Fiókok és jogosultságok kezelése', icon: <GroupIcon fontSize="large" />, adminOnly: true },
];

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EvacuationEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchEvents()
      .then((res) => setEvents(res.data))
      .finally(() => setIsLoading(false));
  }, []);

  const ongoingEvents = events.filter((e) => e.status === 'active' || e.status === 'paused');
  const links = quickLinks.filter((l) => !l.adminOnly || user?.role?.code === 'admin');

  return (
    <Box>
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 3, sm: 4 },
          mb: 4,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #880015 0%, #570F12 100%)',
          color: '#fff',
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <ShieldMoonIcon sx={{ fontSize: 40 }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>Üdvözöljük, {user?.name}!</Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              {roleLabels[user?.role?.code ?? ''] ?? ''} — Kitelepítés Támogató Rendszer
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Folyamatban lévő események</Typography>
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : ongoingEvents.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, mb: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">Jelenleg nincs aktív vagy szüneteltetett kitelepítési esemény.</Typography>
        </Paper>
      ) : (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {ongoingEvents.map((event) => (
            <Grid key={event.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardActionArea onClick={() => navigate(`/esemenyek/${event.id}/attekintes`)} sx={{ height: '100%', p: 0.5 }}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                      <EventStatusBadge status={event.status} />
                      <ArrowForwardIcon color="primary" fontSize="small" />
                    </Stack>
                    <Typography variant="h6" fontWeight={700}>{event.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{event.code}</Typography>
                    {event.starts_at && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                        Kezdés: {new Date(event.starts_at).toLocaleDateString('hu-HU')}
                      </Typography>
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Gyors elérés</Typography>
      <Grid container spacing={2}>
        {links.map((link) => (
          <Grid key={link.to} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardActionArea onClick={() => navigate(link.to)} sx={{ height: '100%', p: 1 }}>
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ color: 'primary.main' }}>{link.icon}</Box>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={700}>{link.label}</Typography>
                      <Typography variant="body2" color="text.secondary">{link.description}</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
