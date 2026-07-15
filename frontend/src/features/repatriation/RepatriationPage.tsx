import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  CircularProgress,
  LinearProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TextField,
  MenuItem,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BlockIcon from '@mui/icons-material/Block';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import { toast } from 'react-toastify';
import type { RepatriationAuthorization, RepatriationStatus } from '../../types';
import { fetchRepatriationAuthorizations, upsertRepatriationAuthorization } from '../../lib/api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { KpiCard } from '../../components/ui/KpiCard';
import { EmptyState } from '../../components/ui/EmptyState';

const statusLabels: Record<RepatriationStatus, string> = {
  not_permitted: 'Nem engedélyezett',
  conditional: 'Feltételes',
  permitted: 'Engedélyezett',
};

const statusColors: Record<RepatriationStatus, 'default' | 'warning' | 'success'> = {
  not_permitted: 'default',
  conditional: 'warning',
  permitted: 'success',
};

export function RepatriationPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role?.code === 'admin' || user?.role?.code === 'manager';

  const [rows, setRows] = useState<RepatriationAuthorization[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  function load() {
    if (!eventId) return;
    setIsLoading(true);
    fetchRepatriationAuthorizations(eventId).then(setRows).finally(() => setIsLoading(false));
  }

  useEffect(load, [eventId]);

  async function handleStatusChange(municipalityId: number, status: RepatriationStatus) {
    if (!eventId) return;
    try {
      await upsertRepatriationAuthorization(eventId, { municipality_id: municipalityId, status });
      toast.success('Visszatelepítési státusz frissítve.');
      load();
    } catch {
      toast.error('A frissítés nem sikerült.');
    }
  }

  // Településenkénti visszatelepítési adatok összesítése a KPI-sávhoz:
  // engedélyezési státuszok szerinti darabszám, valamint az érintett és
  // már ténylegesen hazatért személyek összesített száma
  const summary = useMemo(() => {
    const totalPersons = rows.reduce((sum, r) => sum + r.person_count, 0);
    const totalReturned = rows.reduce((sum, r) => sum + r.returned_count, 0);
    return {
      municipalityCount: rows.length,
      permittedCount: rows.filter((r) => r.status === 'permitted').length,
      conditionalCount: rows.filter((r) => r.status === 'conditional').length,
      notPermittedCount: rows.filter((r) => r.status === 'not_permitted').length,
      totalPersons,
      totalReturned,
    };
  }, [rows]);

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <HomeIcon color="primary" />
        <Typography variant="h4" fontWeight={700}>Visszatelepítés</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Településenkénti visszatelepítési engedélyezési státusz. Csak engedélyezett vagy feltételes státuszú
        településhez tartozó lakos erősítheti meg önkiszolgálóan a visszatérését.
      </Typography>

      {rows.length === 0 ? (
        <Paper variant="outlined">
          <EmptyState title="Nincs regisztrált személyekhez tartozó település" />
        </Paper>
      ) : (
        <>
          <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mb: 3 }}>
            <KpiCard label="Érintett települések" value={summary.municipalityCount} icon={<LocationCityIcon fontSize="small" />} />
            <KpiCard
              label="Engedélyezett"
              value={summary.permittedCount}
              icon={<CheckCircleIcon fontSize="small" color="success" />}
            />
            <KpiCard
              label="Feltételes"
              value={summary.conditionalCount}
              icon={<WarningAmberIcon fontSize="small" color="warning" />}
            />
            <KpiCard
              label="Nem engedélyezett"
              value={summary.notPermittedCount}
              icon={<BlockIcon fontSize="small" color="error" />}
            />
            <KpiCard
              label="Visszatért"
              value={`${summary.totalReturned} / ${summary.totalPersons}`}
              icon={<PeopleAltIcon fontSize="small" />}
              onClick={() => navigate(`/esemenyek/${eventId}/szemelyek?status=returned_home`)}
            />
          </Stack>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Településenkénti engedélyezés</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Kattintson egy településre a regisztráltak listázásához.
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Település</TableCell>
                    <TableCell>Státusz</TableCell>
                    <TableCell>Létszám</TableCell>
                    <TableCell>Visszatelepült</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => {
                    const returnedRatio = r.person_count > 0 ? r.returned_count / r.person_count : 0;
                    return (
                      <TableRow
                        key={r.municipality_id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/esemenyek/${eventId}/szemelyek?municipality_id=${r.municipality_id}`)}
                      >
                        <TableCell>{r.municipality_name}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {canManage ? (
                            <TextField
                              select
                              size="small"
                              value={r.status}
                              onChange={(e) => handleStatusChange(r.municipality_id, e.target.value as RepatriationStatus)}
                              sx={{ minWidth: 160 }}
                            >
                              {Object.entries(statusLabels).map(([value, label]) => (
                                <MenuItem key={value} value={value}>{label}</MenuItem>
                              ))}
                            </TextField>
                          ) : (
                            <Chip size="small" color={statusColors[r.status]} label={statusLabels[r.status]} />
                          )}
                        </TableCell>
                        <TableCell>{r.person_count}</TableCell>
                        <TableCell sx={{ minWidth: 140 }}>
                          <Stack spacing={0.5}>
                            <Typography variant="body2">{r.returned_count} / {r.person_count}</Typography>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(returnedRatio * 100, 100)}
                              sx={{ height: 6, borderRadius: 3 }}
                              color={returnedRatio >= 1 ? 'success' : returnedRatio > 0 ? 'warning' : 'inherit'}
                            />
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </Box>
  );
}
