import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  Chip,
  LinearProgress,
  CircularProgress,
  TextField,
  MenuItem,
  InputAdornment,
  IconButton,
  Tooltip,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import SearchIcon from '@mui/icons-material/Search';
import PhoneIcon from '@mui/icons-material/Phone';
import AccessibleIcon from '@mui/icons-material/Accessible';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PrintIcon from '@mui/icons-material/Print';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type { ShelterWithRisk } from '../../types';
import { fetchShelters } from '../../lib/api/endpoints';
import { EmptyState } from '../../components/ui/EmptyState';
import { KpiCard } from '../../components/ui/KpiCard';
import { RiskBadge } from '../../components/ui/RiskBadge';
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

const progressColor: Record<ShelterWithRisk['risk_level'], 'success' | 'warning' | 'error'> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
  critical: 'error',
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
  const [menuState, setMenuState] = useState<{ anchor: HTMLElement; shelter: ShelterWithRisk } | null>(null);

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

  const summary = useMemo(() => {
    const totalCapacity = shelters.reduce((sum, s) => sum + s.capacity_limit, 0);
    const totalOccupied = shelters.reduce((sum, s) => sum + s.checked_in_count, 0);
    return {
      count: shelters.length,
      totalCapacity,
      totalOccupied,
      warnCount: shelters.filter((s) => s.risk_level === 'medium').length,
      critCount: shelters.filter((s) => s.risk_level === 'high' || s.risk_level === 'critical').length,
    };
  }, [shelters]);

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5} sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Befogadóhelyek</Typography>
        <Button variant="contained" startIcon={<QrCodeScannerIcon />} onClick={() => navigate(`/esemenyek/${eventId}/erkeztetes`)}>
          QR érkeztetés
        </Button>
      </Stack>

      {shelters.length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mb: 3 }}>
          <KpiCard label="Helyszín" value={summary.count} icon={<HomeWorkIcon fontSize="small" />} />
          <KpiCard label="Foglalt / Kapacitás" value={`${summary.totalOccupied} / ${summary.totalCapacity}`} icon={<PeopleAltIcon fontSize="small" />} />
          <KpiCard label="Közepes kockázatú" value={summary.warnCount} icon={<WarningAmberIcon fontSize="small" />} />
          <KpiCard label="Magas/kritikus kockázatú" value={summary.critCount} icon={<WarningAmberIcon fontSize="small" />} />
        </Stack>
      )}

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

      <Stack spacing={1.25}>
        {visibleShelters.map((s) => {
          const utilizationPct = Math.round(s.utilization * 100);
          return (
            <Paper
              key={s.event_shelter_id}
              variant="outlined"
              sx={{
                p: 2.5,
                cursor: 'pointer',
                transition: 'box-shadow 0.15s, border-color 0.15s',
                '&:hover': { boxShadow: 2, borderColor: 'primary.main' },
              }}
              onClick={() => navigate(`/esemenyek/${eventId}/szemelyek?shelter_id=${s.shelter.id}`)}
            >
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={{ xs: 2, md: 3 }}
                alignItems={{ xs: 'stretch', md: 'center' }}
              >
                <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
                  <Tooltip title={s.shelter.name}>
                    <Typography variant="subtitle1" fontWeight={700} noWrap>{s.shelter.name}</Typography>
                  </Tooltip>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {s.shelter.municipality ? `${s.shelter.municipality}, ` : ''}{s.shelter.address}
                  </Typography>
                </Box>

                <Box sx={{ flex: '1 1 240px', minWidth: 0 }}>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Foglalt / Kapacitás: <strong>{s.checked_in_count} / {s.capacity_limit}</strong> ({utilizationPct}%)
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(utilizationPct, 100)}
                    color={progressColor[s.risk_level]}
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Box>

                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center" sx={{ flex: '1 1 260px', rowGap: 1 }}>
                  <RiskBadge level={s.risk_level} />
                  {s.shelter.medical_support_available && (
                    <Chip icon={<LocalHospitalIcon />} label="Egészségügyi" size="small" />
                  )}
                  {s.shelter.accessible_capacity > 0 && (
                    <Chip icon={<AccessibleIcon />} label={`${s.shelter.accessible_capacity} akadálymentes`} size="small" />
                  )}
                  {s.shelter.contact_phone && (
                    <Chip icon={<PhoneIcon />} label={s.shelter.contact_phone} size="small" variant="outlined" />
                  )}
                </Stack>

                <Stack
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  justifyContent={{ xs: 'flex-end', md: 'flex-start' }}
                  sx={{ flexShrink: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<PeopleAltIcon fontSize="small" />}
                    onClick={() => navigate(`/esemenyek/${eventId}/szemelyek?shelter_id=${s.shelter.id}`)}
                  >
                    Kik vannak itt
                  </Button>
                  <IconButton size="small" onClick={(e) => setMenuState({ anchor: e.currentTarget, shelter: s })}>
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
            </Paper>
          );
        })}
        {visibleShelters.length === 0 && (
          <Paper variant="outlined">
            <EmptyState
              title={shelters.length === 0 ? 'Nincs befogadóhely hozzárendelve az eseményhez' : 'Nincs a keresésnek megfelelő befogadóhely'}
            />
          </Paper>
        )}
      </Stack>

      <Menu anchorEl={menuState?.anchor ?? null} open={!!menuState} onClose={() => setMenuState(null)}>
        <MenuItem
          onClick={() => {
            if (menuState) navigate(`/esemenyek/${eventId}/erkeztetes?shelter_id=${menuState.shelter.shelter.id}`);
            setMenuState(null);
          }}
        >
          <ListItemIcon><QrCodeScannerIcon fontSize="small" /></ListItemIcon>
          <ListItemText>QR érkeztetés</ListItemText>
        </MenuItem>
        {menuState && (user?.role?.code === 'admin' || user?.role?.code === 'manager' || user?.shelter_id === menuState.shelter.shelter.id) && (
          <MenuItem
            onClick={() => {
              setRosterShelter(menuState.shelter);
              setMenuState(null);
            }}
          >
            <ListItemIcon><PrintIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Nyomtatható névsor</ListItemText>
          </MenuItem>
        )}
      </Menu>

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
