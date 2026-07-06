import { useEffect, useState, type FormEvent } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import { toast } from 'react-toastify';
import { useAuth } from '../auth/AuthContext';
import type { Municipality } from '../../types';
import { createMunicipality, deleteMunicipality, fetchMunicipalities, updateMunicipality } from '../../lib/api/endpoints';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

export function MunicipalityManagementPage() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogMunicipality, setDialogMunicipality] = useState<Municipality | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Municipality | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canManage = user?.role?.code === 'admin' || user?.role?.code === 'manager';
  const isAdmin = user?.role?.code === 'admin';

  function load() {
    setIsLoading(true);
    fetchMunicipalities().then(setMunicipalities).finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteMunicipality(deleteTarget.id);
      toast.success('Település törölve.');
      setDeleteTarget(null);
      load();
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(apiMessage ?? 'A település nem törölhető.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5} sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <LocationCityIcon color="primary" />
          <Typography variant="h4" fontWeight={700}>Települések (törzsadat)</Typography>
        </Stack>
        {canManage && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogMunicipality('new')}>
            Új település
          </Button>
        )}
      </Stack>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : isMobile ? (
        <Stack spacing={1.5}>
          {municipalities.map((m) => (
            <Paper key={m.id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography fontWeight={700}>{m.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{m.county} · {m.postal_code}</Typography>
                </Box>
                <Stack direction="row" spacing={0.5}>
                  {canManage && (
                    <IconButton size="small" onClick={() => setDialogMunicipality(m)}><EditIcon fontSize="small" /></IconButton>
                  )}
                  {isAdmin && (
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(m)}><DeleteIcon fontSize="small" /></IconButton>
                  )}
                </Stack>
              </Stack>
            </Paper>
          ))}
          {municipalities.length === 0 && <Typography color="text.secondary">Nincs rögzített település.</Typography>}
        </Stack>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Név</TableCell>
                <TableCell>Megye</TableCell>
                <TableCell>Irányítószám</TableCell>
                <TableCell align="right"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {municipalities.map((m) => (
                <TableRow key={m.id} hover>
                  <TableCell>{m.name}</TableCell>
                  <TableCell>{m.county}</TableCell>
                  <TableCell>{m.postal_code}</TableCell>
                  <TableCell align="right">
                    {canManage && (
                      <Tooltip title="Szerkesztés">
                        <IconButton onClick={() => setDialogMunicipality(m)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                    {isAdmin && (
                      <Tooltip title="Törlés">
                        <IconButton color="error" onClick={() => setDeleteTarget(m)}><DeleteIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {municipalities.length === 0 && (
                <TableRow><TableCell colSpan={4} align="center">Nincs rögzített település.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {dialogMunicipality && (
        <MunicipalityDialog
          municipality={dialogMunicipality === 'new' ? null : dialogMunicipality}
          onClose={() => setDialogMunicipality(null)}
          onSaved={() => {
            setDialogMunicipality(null);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Település törlése"
        description={`Biztosan törli a(z) "${deleteTarget?.name}" települést? A törlés csak akkor sikeres, ha nincs hozzá kapcsolódó személy vagy befogadóhely.`}
        confirmLabel="Törlés"
        severity="error"
        isSubmitting={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </Box>
  );
}

function MunicipalityDialog({
  municipality,
  onClose,
  onSaved,
}: {
  municipality: Municipality | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(municipality?.name ?? '');
  const [county, setCounty] = useState(municipality?.county ?? 'Győr-Moson-Sopron');
  const [postalCode, setPostalCode] = useState(municipality?.postal_code ?? '');
  const [lat, setLat] = useState(municipality?.lat != null ? String(municipality.lat) : '');
  const [lng, setLng] = useState(municipality?.lng != null ? String(municipality.lng) : '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        name,
        county,
        postal_code: postalCode || undefined,
        lat: lat ? Number(lat) : undefined,
        lng: lng ? Number(lng) : undefined,
      };
      if (municipality) {
        await updateMunicipality(municipality.id, payload);
        toast.success('Település frissítve.');
      } else {
        await createMunicipality(payload);
        toast.success('Település létrehozva.');
      }
      onSaved();
    } catch {
      toast.error('A mentés nem sikerült.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" fullScreen={isMobile}>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>{municipality ? 'Település szerkesztése' : 'Új település'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Név" required fullWidth value={name} onChange={(e) => setName(e.target.value)} />
            <TextField label="Megye" required fullWidth value={county} onChange={(e) => setCounty(e.target.value)} />
            <TextField label="Irányítószám (opcionális)" fullWidth value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
            <Stack direction="row" spacing={2}>
              <TextField label="Szélesség (lat, opcionális)" fullWidth value={lat} onChange={(e) => setLat(e.target.value)} />
              <TextField label="Hosszúság (lng, opcionális)" fullWidth value={lng} onChange={(e) => setLng(e.target.value)} />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              A szélesség/hosszúság megadása esetén a település megjelenik a térképes nézeteken is.
            </Typography>
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
