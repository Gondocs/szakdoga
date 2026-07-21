import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  TextField,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  InputAdornment,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TableSortLabel,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import 'leaflet/dist/leaflet.css';
import { assemblyPointIcon } from '../../lib/leafletIcons';
import AddIcon from '@mui/icons-material/Add';
import PlaceIcon from '@mui/icons-material/Place';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import { toast } from 'react-toastify';
import {
  createAssemblyPoint,
  deleteAssemblyPoint,
  fetchAssemblyPoints,
  updateAssemblyPoint,
  type AssemblyPointPayload,
} from '../../lib/api/endpoints';
import type { AssemblyPoint } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';

const GYMS_CENTER: [number, number] = [47.75, 17.35];

export function AssemblyPointListPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuth();
  const canManage = user?.role?.code === 'admin' || user?.role?.code === 'manager';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [points, setPoints] = useState<AssemblyPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editPoint, setEditPoint] = useState<AssemblyPoint | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssemblyPoint | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'address'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function load() {
    if (!eventId) return;
    setIsLoading(true);
    fetchAssemblyPoints(eventId).then(setPoints).finally(() => setIsLoading(false));
  }

  useEffect(load, [eventId]);

  function handleSort(column: typeof sortBy) {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  }

  const displayedPoints = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? points.filter((p) => p.name.toLowerCase().includes(term) || (p.address ?? '').toLowerCase().includes(term))
      : points;

    return [...filtered].sort((a, b) => {
      const result = sortBy === 'address'
        ? (a.address ?? '').localeCompare(b.address ?? '', 'hu')
        : a.name.localeCompare(b.name, 'hu');
      return sortDir === 'asc' ? result : -result;
    });
  }, [points, search, sortBy, sortDir]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAssemblyPoint(deleteTarget.id);
      toast.success('Gyülekezési pont törölve.');
      setDeleteTarget(null);
      load();
    } catch {
      toast.error('A törlés nem sikerült.');
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5} sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <PlaceIcon color="primary" />
          <Typography variant="h4" fontWeight={700}>Gyülekezési pontok</Typography>
        </Stack>
        {canManage && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Új gyülekezési pont
          </Button>
        )}
      </Stack>

      {points.length > 0 && (
        <Paper variant="outlined" sx={{ overflow: 'hidden', height: 320, mb: 3 }}>
          <MapContainer center={GYMS_CENTER} zoom={9} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> közreműködők'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {points.map((p) => (
              <Marker key={p.id} position={[p.lat, p.lng]} icon={assemblyPointIcon}>
                <Popup>
                  <strong>{p.name}</strong>
                  {p.address && <><br />{p.address}</>}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </Paper>
      )}

      <TextField
        placeholder="Keresés név vagy cím alapján…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        sx={{ mb: 2, maxWidth: 360 }}
        fullWidth
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
        }}
      />

      {isMobile ? (
        <Stack spacing={1.5}>
          {displayedPoints.map((p) => (
            <Paper key={p.id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography fontWeight={700}>{p.name}</Typography>
                  {p.address && <Typography variant="body2" color="text.secondary">{p.address}</Typography>}
                  <Typography variant="caption" color="text.secondary">
                    {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                  </Typography>
                  {p.notes && <Typography variant="body2" sx={{ mt: 0.5 }}>{p.notes}</Typography>}
                </Box>
                {canManage && (
                  <Stack direction="row" spacing={0}>
                    <IconButton size="small" onClick={() => setEditPoint(p)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(p)}><DeleteIcon fontSize="small" /></IconButton>
                  </Stack>
                )}
              </Stack>
            </Paper>
          ))}
          {displayedPoints.length === 0 && <EmptyState title="Még nincs felvéve gyülekezési pont" />}
        </Stack>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sortDirection={sortBy === 'name' ? sortDir : false}>
                  <TableSortLabel active={sortBy === 'name'} direction={sortBy === 'name' ? sortDir : 'asc'} onClick={() => handleSort('name')}>
                    Név
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sortBy === 'address' ? sortDir : false}>
                  <TableSortLabel active={sortBy === 'address'} direction={sortBy === 'address' ? sortDir : 'asc'} onClick={() => handleSort('address')}>
                    Cím
                  </TableSortLabel>
                </TableCell>
                <TableCell>Koordináta</TableCell>
                <TableCell>Megjegyzés</TableCell>
                {canManage && <TableCell align="right"></TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {displayedPoints.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.address ?? '–'}</TableCell>
                  <TableCell>{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</TableCell>
                  <TableCell>{p.notes ?? '–'}</TableCell>
                  {canManage && (
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => setEditPoint(p)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(p)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {displayedPoints.length === 0 && (
                <TableRow><TableCell colSpan={canManage ? 5 : 4}><EmptyState title="Még nincs felvéve gyülekezési pont" /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {createOpen && eventId && (
        <AssemblyPointDialog
          eventId={eventId}
          point={null}
          initialCoords={null}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}

      {editPoint && eventId && (
        <AssemblyPointDialog
          eventId={eventId}
          point={editPoint}
          initialCoords={null}
          onClose={() => setEditPoint(null)}
          onSaved={() => {
            setEditPoint(null);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Gyülekezési pont törlése"
        description={`Biztosan törli a(z) "${deleteTarget?.name}" gyülekezési pontot?`}
        confirmLabel="Törlés"
        severity="error"
        isSubmitting={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </Box>
  );
}

/**
 * A térképes oldal (EventMapPage) is ezt használja "kattintás a térképre →
 * új pont" folyamathoz (initialCoords-szal), ezért innen exportálva, nem
 * duplikálva.
 */
export function AssemblyPointDialog({
  eventId,
  point,
  initialCoords,
  onClose,
  onSaved,
}: {
  eventId: string;
  point: AssemblyPoint | null;
  initialCoords: { lat: number; lng: number } | null;
  onClose: () => void;
  onSaved: (point: AssemblyPoint) => void;
}) {
  const [name, setName] = useState(point?.name ?? '');
  const [address, setAddress] = useState(point?.address ?? '');
  const [lat, setLat] = useState(point?.lat ?? initialCoords?.lat ?? GYMS_CENTER[0]);
  const [lng, setLng] = useState(point?.lng ?? initialCoords?.lng ?? GYMS_CENTER[1]);
  const [notes, setNotes] = useState(point?.notes ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload: AssemblyPointPayload = { name, address: address || null, lat, lng, notes: notes || null };
      const saved = point ? await updateAssemblyPoint(point.id, payload) : await createAssemblyPoint(eventId, payload);
      toast.success('Gyülekezési pont mentve.');
      onSaved(saved);
    } catch {
      toast.error('A mentés nem sikerült.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>{point ? 'Gyülekezési pont szerkesztése' : 'Új gyülekezési pont'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Név" required fullWidth value={name} onChange={(e) => setName(e.target.value)} />
            <TextField label="Cím" fullWidth value={address} onChange={(e) => setAddress(e.target.value)} />
            <Stack direction="row" spacing={1}>
              <TextField
                label="Szélesség (lat)"
                type="number"
                required
                fullWidth
                value={lat}
                onChange={(e) => setLat(Number(e.target.value))}
                inputProps={{ step: 'any' }}
              />
              <TextField
                label="Hosszúság (lng)"
                type="number"
                required
                fullWidth
                value={lng}
                onChange={(e) => setLng(Number(e.target.value))}
                inputProps={{ step: 'any' }}
              />
            </Stack>
            <TextField label="Megjegyzés" fullWidth multiline minRows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} color="inherit">Mégse</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Mentés…' : 'Mentés'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
