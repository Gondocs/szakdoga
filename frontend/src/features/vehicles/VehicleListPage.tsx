import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  TextField,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  InputAdornment,
  MenuItem,
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
import AddIcon from '@mui/icons-material/Add';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import { Link as RouterLink } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  createVehicle,
  deleteVehicle,
  fetchVehicles,
  updateVehicle,
  type Vehicle,
  type VehiclePayload,
  type VehicleType,
} from '../../lib/api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

const vehicleTypeLabels: Record<VehicleType, string> = {
  bus: 'Busz',
  minibus: 'Kisbusz',
  train: 'Vonat',
  car: 'Személygépkocsi',
  ambulance: 'Mentőjármű',
  truck: 'Teherautó',
  other: 'Egyéb',
};

export function VehicleListPage() {
  const { user } = useAuth();
  const canManage = user?.role?.code === 'admin' || user?.role?.code === 'manager';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'plate' | 'label' | 'type' | 'capacity'>('label');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function load() {
    setIsLoading(true);
    fetchVehicles().then(setVehicles).finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  function handleSort(column: typeof sortBy) {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  }

  const displayedVehicles = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? vehicles.filter((v) => v.label.toLowerCase().includes(term) || v.plate_number.toLowerCase().includes(term))
      : vehicles;

    return [...filtered].sort((a, b) => {
      let result = 0;
      switch (sortBy) {
        case 'plate':
          result = a.plate_number.localeCompare(b.plate_number, 'hu');
          break;
        case 'type':
          result = vehicleTypeLabels[a.vehicle_type].localeCompare(vehicleTypeLabels[b.vehicle_type], 'hu');
          break;
        case 'capacity':
          result = (a.capacity ?? 0) - (b.capacity ?? 0);
          break;
        default:
          result = a.label.localeCompare(b.label, 'hu');
      }
      return sortDir === 'asc' ? result : -result;
    });
  }, [vehicles, search, sortBy, sortDir]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteVehicle(deleteTarget.id);
      toast.success('Jármű törölve.');
      setDeleteTarget(null);
      load();
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(apiMessage ?? 'A jármű törlése nem sikerült.');
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5} sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <DirectionsBusIcon color="primary" />
          <Typography variant="h4" fontWeight={700}>Járműflotta</Typography>
        </Stack>
        {canManage && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Új jármű
          </Button>
        )}
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Ez a lista eseményfüggetlen: egy járművet egyszer kell felvenni, utána tetszőleges kitelepítési
        eseményhez hozzárendelhető szállítóeszközként. Ha egy jármű már egy folyamatban lévő eseményhez van
        rendelve, másik aktív eseményhez nem foglalható le újra.
      </Typography>

      <TextField
        placeholder="Keresés megnevezés vagy rendszám alapján…"
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
          {displayedVehicles.map((v) => (
            <Paper key={v.id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography fontWeight={700}>{v.label}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {vehicleTypeLabels[v.vehicle_type]} · {v.plate_number}{v.capacity ? ` · ${v.capacity} fő` : ''}
                  </Typography>
                  {v.driver_name && <Typography variant="body2" color="text.secondary">Sofőr: {v.driver_name}</Typography>}
                </Box>
                {canManage && (
                  <Stack direction="row" spacing={0}>
                    <IconButton size="small" onClick={() => setEditVehicle(v)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(v)}><DeleteIcon fontSize="small" /></IconButton>
                  </Stack>
                )}
              </Stack>
              <Box sx={{ mt: 1 }}>
                {v.active_assignment ? (
                  <Chip
                    size="small"
                    color="warning"
                    label={`Használatban: ${v.active_assignment.event_name} (${v.active_assignment.transport_code})`}
                    component={RouterLink}
                    to={`/esemenyek/${v.active_assignment.event_id}/szallitas`}
                    clickable
                  />
                ) : (
                  <Chip size="small" color="success" variant="outlined" label="Szabad" />
                )}
              </Box>
            </Paper>
          ))}
          {displayedVehicles.length === 0 && <Typography color="text.secondary" textAlign="center">Még nincs felvéve jármű.</Typography>}
        </Stack>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sortDirection={sortBy === 'plate' ? sortDir : false}>
                  <TableSortLabel active={sortBy === 'plate'} direction={sortBy === 'plate' ? sortDir : 'asc'} onClick={() => handleSort('plate')}>
                    Rendszám
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sortBy === 'label' ? sortDir : false}>
                  <TableSortLabel active={sortBy === 'label'} direction={sortBy === 'label' ? sortDir : 'asc'} onClick={() => handleSort('label')}>
                    Megnevezés
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sortBy === 'type' ? sortDir : false}>
                  <TableSortLabel active={sortBy === 'type'} direction={sortBy === 'type' ? sortDir : 'asc'} onClick={() => handleSort('type')}>
                    Típus
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sortBy === 'capacity' ? sortDir : false}>
                  <TableSortLabel active={sortBy === 'capacity'} direction={sortBy === 'capacity' ? sortDir : 'asc'} onClick={() => handleSort('capacity')}>
                    Kapacitás
                  </TableSortLabel>
                </TableCell>
                <TableCell>Sofőr</TableCell>
                <TableCell>Állapot</TableCell>
                {canManage && <TableCell align="right"></TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {displayedVehicles.map((v) => (
                <TableRow key={v.id} hover>
                  <TableCell>{v.plate_number}</TableCell>
                  <TableCell>{v.label}</TableCell>
                  <TableCell>{vehicleTypeLabels[v.vehicle_type]}</TableCell>
                  <TableCell>{v.capacity ?? '–'}</TableCell>
                  <TableCell>{v.driver_name ?? '–'}</TableCell>
                  <TableCell>
                    {v.active_assignment ? (
                      <Chip
                        size="small"
                        color="warning"
                        label={`Használatban: ${v.active_assignment.event_name} (${v.active_assignment.transport_code})`}
                        component={RouterLink}
                        to={`/esemenyek/${v.active_assignment.event_id}/szallitas`}
                        clickable
                      />
                    ) : (
                      <Chip size="small" color="success" variant="outlined" label="Szabad" />
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => setEditVehicle(v)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(v)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {displayedVehicles.length === 0 && (
                <TableRow><TableCell colSpan={canManage ? 7 : 6} align="center">Még nincs felvéve jármű.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {createOpen && (
        <VehicleFormDialog
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}

      {editVehicle && (
        <VehicleFormDialog
          vehicle={editVehicle}
          onClose={() => setEditVehicle(null)}
          onSaved={() => {
            setEditVehicle(null);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Jármű törlése"
        description={`Biztosan törli a(z) "${deleteTarget?.label}" járművet a flottából? A törlés csak akkor sikeres, ha jelenleg nincs folyamatban lévő eseményhez rendelve.`}
        confirmLabel="Törlés"
        severity="error"
        isSubmitting={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </Box>
  );
}

function VehicleFormDialog({
  vehicle,
  onClose,
  onSaved,
}: {
  vehicle?: Vehicle;
  onClose: () => void;
  onSaved: (vehicle: Vehicle) => void;
}) {
  const [plateNumber, setPlateNumber] = useState(vehicle?.plate_number ?? '');
  const [label, setLabel] = useState(vehicle?.label ?? '');
  const [vehicleType, setVehicleType] = useState<VehicleType>(vehicle?.vehicle_type ?? 'bus');
  const [capacity, setCapacity] = useState(vehicle?.capacity ? String(vehicle.capacity) : '');
  const [driverName, setDriverName] = useState(vehicle?.driver_name ?? '');
  const [notes, setNotes] = useState(vehicle?.notes ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!plateNumber.trim() || !label.trim()) return;
    setIsSubmitting(true);
    try {
      const payload: VehiclePayload = {
        plate_number: plateNumber.trim(),
        label: label.trim(),
        vehicle_type: vehicleType,
        capacity: capacity ? Number(capacity) : undefined,
        driver_name: driverName.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      const saved = vehicle ? await updateVehicle(vehicle.id, payload) : await createVehicle(payload);
      toast.success(vehicle ? 'Jármű frissítve.' : 'Jármű felvéve.');
      onSaved(saved);
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(apiMessage ?? 'A jármű mentése nem sikerült. Ellenőrizze, hogy a rendszám egyedi-e.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{vehicle ? 'Jármű szerkesztése' : 'Új jármű felvétele'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Rendszám" required fullWidth value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} />
          <TextField label="Megnevezés" placeholder="pl. 1. sz. busz" required fullWidth value={label} onChange={(e) => setLabel(e.target.value)} />
          <TextField select label="Típus" fullWidth value={vehicleType} onChange={(e) => setVehicleType(e.target.value as VehicleType)}>
            {Object.entries(vehicleTypeLabels).map(([value, typeLabel]) => (
              <MenuItem key={value} value={value}>{typeLabel}</MenuItem>
            ))}
          </TextField>
          <TextField label="Kapacitás (opcionális)" type="number" fullWidth value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          <TextField label="Sofőr neve (opcionális)" fullWidth value={driverName} onChange={(e) => setDriverName(e.target.value)} />
          <TextField label="Megjegyzés (opcionális)" fullWidth multiline minRows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Mégse</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Mentés…' : 'Mentés'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
