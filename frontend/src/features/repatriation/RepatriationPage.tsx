import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  CircularProgress,
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
import { toast } from 'react-toastify';
import type { RepatriationAuthorization, RepatriationStatus } from '../../types';
import { fetchRepatriationAuthorizations, upsertRepatriationAuthorization } from '../../lib/api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { EventSubNav } from '../../components/layout/EventSubNav';

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

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      {eventId && <EventSubNav eventId={eventId} />}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <HomeIcon color="primary" />
        <Typography variant="h4" fontWeight={700}>Visszatelepítés</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Településenkénti visszatelepítési engedélyezési státusz. Csak engedélyezett vagy feltételes státuszú
        településhez tartozó lakos erősítheti meg önkiszolgálóan a visszatérését.
      </Typography>

      {rows.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">Nincs regisztrált személyekhez tartozó település.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Település</TableCell>
                <TableCell>Státusz</TableCell>
                <TableCell>Létszám</TableCell>
                <TableCell>Visszatelepült</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.municipality_id} hover>
                  <TableCell>{r.municipality_name}</TableCell>
                  <TableCell>
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
                  <TableCell>{r.returned_count} / {r.person_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
