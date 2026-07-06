import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Stack,
  CircularProgress,
  IconButton,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EventIcon from '@mui/icons-material/Event';
import { toast } from 'react-toastify';
import type { EvacuationEvent, Shelter } from '../../types';
import { createEvent, deleteEvent, fetchAllShelters, fetchEvents } from '../../lib/api/endpoints';
import { EventStatusBadge } from './EventStatusBadge';
import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

export function EventListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [events, setEvents] = useState<EvacuationEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EvacuationEvent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canCreate = user?.role?.code === 'admin' || user?.role?.code === 'manager';
  const isAdmin = user?.role?.code === 'admin';

  function load() {
    setIsLoading(true);
    fetchEvents()
      .then((res) => setEvents(res.data))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteEvent(deleteTarget.id);
      toast.success('Esemény törölve.');
      setDeleteTarget(null);
      load();
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(apiMessage ?? 'Az esemény nem törölhető.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <EventIcon color="primary" />
          <Typography variant="h4" fontWeight={700}>Kitelepítési események</Typography>
        </Stack>
        {canCreate && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            Új esemény
          </Button>
        )}
      </Stack>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : isMobile ? (
        <Stack spacing={1.5}>
          {events.map((event) => (
            <Paper key={event.id} variant="outlined" sx={{ p: 2, cursor: 'pointer' }} onClick={() => navigate(`/esemenyek/${event.id}/attekintes`)}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography fontWeight={700}>{event.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{event.code}</Typography>
                </Box>
                <Stack direction="row" alignItems="center">
                  {isAdmin && (
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(event);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                  <ArrowForwardIcon color="primary" fontSize="small" />
                </Stack>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} alignItems="center">
                <EventStatusBadge status={event.status} />
                {event.starts_at && (
                  <Typography variant="body2" color="text.secondary">
                    {new Date(event.starts_at).toLocaleDateString('hu-HU')}
                  </Typography>
                )}
              </Stack>
            </Paper>
          ))}
          {events.length === 0 && <Typography color="text.secondary" textAlign="center">Nincs esemény.</Typography>}
        </Stack>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Kód</TableCell>
                <TableCell>Név</TableCell>
                <TableCell>Státusz</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Kezdés</TableCell>
                <TableCell align="right"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/esemenyek/${event.id}/attekintes`)}>
                  <TableCell>{event.code}</TableCell>
                  <TableCell>{event.name}</TableCell>
                  <TableCell><EventStatusBadge status={event.status} /></TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                    {event.starts_at ? new Date(event.starts_at).toLocaleDateString('hu-HU') : '–'}
                  </TableCell>
                  <TableCell align="right">
                    {isAdmin && (
                      <Tooltip title="Törlés">
                        <IconButton
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(event);
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Megnyitás">
                      <IconButton color="primary">
                        <ArrowForwardIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {events.length === 0 && (
                <TableRow><TableCell colSpan={5} align="center">Nincs esemény.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <CreateEventDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={() => {
          setDialogOpen(false);
          load();
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Esemény törlése"
        description={`Biztosan törli a(z) "${deleteTarget?.name}" eseményt? A törlés csak akkor sikeres, ha még nincs hozzá regisztrált személy.`}
        confirmLabel="Törlés"
        severity="error"
        isSubmitting={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </Box>
  );
}

function CreateEventDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<EvacuationEvent['status']>('draft');
  const [allShelters, setAllShelters] = useState<Shelter[]>([]);
  const [shelterRows, setShelterRows] = useState<{ shelter_id: string; name: string; capacity_limit: number }[]>([]);
  const [newShelterId, setNewShelterId] = useState('');
  const [newCapacity, setNewCapacity] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    if (open) {
      fetchAllShelters().then(setAllShelters).catch(() => setAllShelters([]));
    }
  }, [open]);

  function handleSelectShelter(shelterId: string) {
    setNewShelterId(shelterId);
    const shelter = allShelters.find((s) => s.id === shelterId);
    if (shelter) setNewCapacity(shelter.capacity_total);
  }

  function addShelterRow() {
    if (!newShelterId) return;
    const shelter = allShelters.find((s) => s.id === newShelterId);
    if (!shelter) return;
    if (shelterRows.some((r) => r.shelter_id === newShelterId)) {
      toast.warning('Ez a befogadóhely már hozzá van adva.');
      return;
    }
    setShelterRows((rows) => [...rows, { shelter_id: shelter.id, name: shelter.name, capacity_limit: newCapacity }]);
    setNewShelterId('');
    setNewCapacity(50);
  }

  function removeShelterRow(shelterId: string) {
    setShelterRows((rows) => rows.filter((r) => r.shelter_id !== shelterId));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createEvent({
        code,
        name,
        status,
        shelters: shelterRows.map((r) => ({ shelter_id: r.shelter_id, capacity_limit: r.capacity_limit })),
      });
      toast.success('Esemény sikeresen létrehozva.');
      setCode('');
      setName('');
      setStatus('draft');
      setShelterRows([]);
      onCreated();
    } catch {
      toast.error('Az esemény létrehozása sikertelen. Ellenőrizze, hogy a kód egyedi-e.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const availableShelters = allShelters.filter((s) => !shelterRows.some((r) => r.shelter_id === s.id));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile}>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>Új kitelepítési esemény</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Esemény kód" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="EVT-2026-002" fullWidth />
            <TextField label="Esemény neve" required value={name} onChange={(e) => setName(e.target.value)} fullWidth />
            <TextField select label="Státusz" value={status} onChange={(e) => setStatus(e.target.value as EvacuationEvent['status'])} fullWidth>
              <MenuItem value="draft">Tervezet</MenuItem>
              <MenuItem value="active">Aktív</MenuItem>
              <MenuItem value="paused">Szüneteltetve</MenuItem>
              <MenuItem value="closed">Lezárva</MenuItem>
            </TextField>

            <Typography variant="subtitle2" fontWeight={700}>Befogadóhelyek (opcionális, később is hozzáadható)</Typography>
            {shelterRows.length > 0 && (
              <Stack spacing={1}>
                {shelterRows.map((row) => (
                  <Stack key={row.shelter_id} direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ flex: 1 }}>{row.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{row.capacity_limit} fő</Typography>
                    <IconButton size="small" color="error" onClick={() => removeShelterRow(row.shelter_id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            )}
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField select label="Befogadóhely hozzáadása" size="small" fullWidth value={newShelterId} onChange={(e) => handleSelectShelter(e.target.value)}>
                {availableShelters.map((s) => (
                  <MenuItem key={s.id} value={s.id}>{s.name} (kapacitás: {s.capacity_total})</MenuItem>
                ))}
              </TextField>
              <TextField type="number" size="small" label="Kapacitás" value={newCapacity} onChange={(e) => setNewCapacity(Number(e.target.value))} sx={{ width: 120 }} />
              <IconButton onClick={addShelterRow} color="primary"><AddIcon /></IconButton>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} color="inherit">Mégse</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Létrehozás…' : 'Létrehozás'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
