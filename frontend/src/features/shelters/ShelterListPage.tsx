import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Stack,
  Button,
  LinearProgress,
  Chip,
  CircularProgress,
  TextField,
  MenuItem,
  InputAdornment,
  IconButton,
  Tooltip,
} from '@mui/material';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import SearchIcon from '@mui/icons-material/Search';
import PhoneIcon from '@mui/icons-material/Phone';
import AccessibleIcon from '@mui/icons-material/Accessible';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import PrintIcon from '@mui/icons-material/Print';
import type { ShelterWithRisk } from '../../types';
import { fetchShelters } from '../../lib/api/endpoints';
import { RiskBadge } from '../../components/ui/RiskBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { ShelterRosterPrintDialog } from '../../components/ShelterRosterPrintDialog';
import { useAuth } from '../auth/AuthContext';

type SortKey = 'name' | 'utilization_desc' | 'risk_desc' | 'free_capacity_desc';

const sortLabels: Record<SortKey, string> = {
  name: 'Név szerint',
  utilization_desc: 'Telítettség szerint (csökkenő)',
  risk_desc: 'Kockázat szerint (csökkenő)',
  free_capacity_desc: 'Szabad kapacitás szerint (csökkenő)',
};

const riskRank: Record<ShelterWithRisk['risk_level'], number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function ShelterListPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [shelters, setShelters] = useState<ShelterWithRisk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [rosterShelter, setRosterShelter] = useState<ShelterWithRisk | null>(null);

  useEffect(() => {
    if (!eventId) return;
    fetchShelters(eventId).then(setShelters).finally(() => setIsLoading(false));
  }, [eventId]);

  const visibleShelters = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? shelters.filter(
          (s) => s.shelter.name.toLowerCase().includes(term) || (s.shelter.municipality ?? '').toLowerCase().includes(term)
        )
      : shelters;

    const sorted = [...filtered];
    switch (sortKey) {
      case 'utilization_desc':
        sorted.sort((a, b) => b.utilization - a.utilization);
        break;
      case 'risk_desc':
        sorted.sort((a, b) => riskRank[b.risk_level] - riskRank[a.risk_level]);
        break;
      case 'free_capacity_desc':
        sorted.sort((a, b) => (b.capacity_limit - b.checked_in_count) - (a.capacity_limit - a.checked_in_count));
        break;
      default:
        sorted.sort((a, b) => a.shelter.name.localeCompare(b.shelter.name, 'hu'));
    }
    return sorted;
  }, [shelters, search, sortKey]);

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5} sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Befogadóhelyek</Typography>
        <Button variant="contained" startIcon={<QrCodeScannerIcon />} onClick={() => navigate(`/esemenyek/${eventId}/erkeztetes`)}>
          QR érkeztetés
        </Button>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
        <TextField
          placeholder="Keresés név vagy település alapján…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          fullWidth
          sx={{ maxWidth: { sm: 360 } }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
          }}
        />
        <TextField select label="Rendezés" size="small" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} sx={{ minWidth: 220 }}>
          {(Object.keys(sortLabels) as SortKey[]).map((key) => (
            <MenuItem key={key} value={key}>{sortLabels[key]}</MenuItem>
          ))}
        </TextField>
      </Stack>

      <Grid container spacing={2}>
        {visibleShelters.map((s) => {
          const freeCapacity = Math.max(s.capacity_limit - s.checked_in_count, 0);
          return (
            <Grid key={s.event_shelter_id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Paper
                variant="outlined"
                sx={{ p: 2.5, height: '100%', cursor: 'pointer', transition: 'box-shadow 0.15s', '&:hover': { boxShadow: 2 } }}
                onClick={() => navigate(`/esemenyek/${eventId}/szemelyek?shelter_id=${s.shelter.id}`)}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                  <Typography variant="h6" fontWeight={700}>{s.shelter.name}</Typography>
                  <RiskBadge level={s.risk_level} />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {s.shelter.municipality ? `${s.shelter.municipality}, ` : ''}{s.shelter.address}
                </Typography>

                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  Foglaltság: <strong>{s.checked_in_count} / {s.capacity_limit}</strong> ({Math.round(s.utilization * 100)}%)
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(s.utilization * 100, 100)}
                  sx={{ height: 6, borderRadius: 3, mb: 1 }}
                  color={s.risk_level === 'low' ? 'success' : s.risk_level === 'medium' ? 'warning' : 'error'}
                />
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Szabad hely: {freeCapacity} fő</Typography>
                  <Typography variant="caption" color="text.secondary">Kockázati pontszám: {s.risk_score}</Typography>
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" sx={{ mb: 1.5, rowGap: 1 }}>
                  {s.shelter.medical_support_available && (
                    <Chip icon={<LocalHospitalIcon />} label="Egészségügyi támogatás" size="small" variant="outlined" />
                  )}
                  {s.shelter.accessible_capacity > 0 && (
                    <Chip icon={<AccessibleIcon />} label={`${s.shelter.accessible_capacity} akadálymentes`} size="small" variant="outlined" />
                  )}
                  {s.shelter.contact_phone && (
                    <Chip icon={<PhoneIcon />} label={s.shelter.contact_phone} size="small" variant="outlined" />
                  )}
                </Stack>

                <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PeopleAltIcon fontSize="small" />}
                    onClick={() => navigate(`/esemenyek/${eventId}/szemelyek?shelter_id=${s.shelter.id}`)}
                  >
                    Kik vannak itt
                  </Button>
                  <Tooltip title="QR érkeztetés ehhez a befogadóhelyhez">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => navigate(`/esemenyek/${eventId}/erkeztetes?shelter_id=${s.shelter.id}`)}
                    >
                      <QrCodeScannerIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {(user?.role?.code === 'admin' || user?.role?.code === 'manager' || user?.shelter_id === s.shelter.id) && eventId && (
                    <Tooltip title="Nyomtatható névsor">
                      <IconButton size="small" onClick={() => setRosterShelter(s)}>
                        <PrintIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </Paper>
            </Grid>
          );
        })}
        {visibleShelters.length === 0 && (
          <Grid size={12}>
            <EmptyState
              title={shelters.length === 0 ? 'Nincs befogadóhely hozzárendelve az eseményhez' : 'Nincs a keresésnek megfelelő befogadóhely'}
            />
          </Grid>
        )}
      </Grid>

      {rosterShelter && eventId && (
        <ShelterRosterPrintDialog
          open
          onClose={() => setRosterShelter(null)}
          eventId={eventId}
          shelter={rosterShelter}
        />
      )}
    </Box>
  );
}
