import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
  FormControlLabel,
  Checkbox,
  TableSortLabel,
  InputAdornment,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import SearchIcon from '@mui/icons-material/Search';
import { toast } from 'react-toastify';
import { useAuth } from '../auth/AuthContext';
import type { Municipality, Shelter } from '../../types';
import { createShelter, deleteShelter, fetchAllShelters, fetchMunicipalities, updateShelter } from '../../lib/api/endpoints';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { MunicipalityAutocomplete } from '../../components/ui/MunicipalityAutocomplete';

const statusLabels: Record<string, string> = {
  planned: 'Tervezett',
  active: 'Aktív',
  full: 'Betelt',
  inactive: 'Inaktív',
};

const statusColors: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  planned: 'default',
  active: 'success',
  full: 'warning',
  inactive: 'error',
};

function serviceLabels(s: Shelter): string[] {
  const labels: string[] = [];
  if (s.medical_support_available) labels.push('Egészségügyi ellátás');
  if (s.drinking_water_available) labels.push('Ivóvíz');
  if (s.meals_available) labels.push('Étkeztetés');
  if (s.hygiene_facilities_available) labels.push('Higiénia');
  if (s.childcare_available) labels.push('Gyermekellátás');
  if (s.psychological_support_available) labels.push('Lelki segítségnyújtás');
  return labels;
}

export function ShelterManagementPage() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogShelter, setDialogShelter] = useState<Shelter | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Shelter | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'municipality' | 'capacity' | 'status'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const canManage = user?.role?.code === 'admin' || user?.role?.code === 'manager';
  const isAdmin = user?.role?.code === 'admin';

  function handleSort(column: typeof sortBy) {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  }

  // Névre/településre szűrjük, majd a kiválasztott oszlop szerint (település,
  // kapacitás vagy státusz) rendezzük a befogadóhelyek listáját
  const displayedShelters = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? shelters.filter((s) => s.name.toLowerCase().includes(term) || (s.municipality ?? '').toLowerCase().includes(term))
      : shelters;

    const sorted = [...filtered].sort((a, b) => {
      let result = 0;
      switch (sortBy) {
        case 'municipality':
          result = (a.municipality ?? '').localeCompare(b.municipality ?? '', 'hu');
          break;
        case 'capacity':
          result = a.capacity_total - b.capacity_total;
          break;
        case 'status':
          result = statusLabels[a.status].localeCompare(statusLabels[b.status], 'hu');
          break;
        default:
          result = a.name.localeCompare(b.name, 'hu');
      }
      return sortDir === 'asc' ? result : -result;
    });

    return sorted;
  }, [shelters, search, sortBy, sortDir]);

  function load() {
    setIsLoading(true);
    Promise.all([fetchAllShelters(), fetchMunicipalities()])
      .then(([s, m]) => {
        setShelters(s);
        setMunicipalities(m);
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteShelter(deleteTarget.id);
      toast.success('Befogadóhely törölve.');
      setDeleteTarget(null);
      load();
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(apiMessage ?? 'A befogadóhely nem törölhető.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5} sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Befogadóhelyek (törzsadat)</Typography>
        {canManage && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogShelter('new')}>
            Új befogadóhely
          </Button>
        )}
      </Stack>

      <TextField
        placeholder="Keresés név vagy település alapján…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        sx={{ mb: 2, maxWidth: 360 }}
        fullWidth
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
        }}
      />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : isMobile ? (
        <Stack spacing={1.5}>
          {displayedShelters.map((s) => (
            <Paper key={s.id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <HomeWorkIcon color="secondary" />
                  <Box>
                    <Typography fontWeight={700}>{s.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{s.municipality ?? '–'}</Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={0.5}>
                  {canManage && (
                    <IconButton size="small" onClick={() => setDialogShelter(s)}><EditIcon fontSize="small" /></IconButton>
                  )}
                  {isAdmin && (
                    <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" alignItems="center">
                <Chip size="small" label={statusLabels[s.status]} color={statusColors[s.status]} />
                <Typography variant="body2" color="text.secondary">Kapacitás: {s.capacity_total} fő</Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                {serviceLabels(s).map((label) => (
                  <Chip key={label} size="small" variant="outlined" label={label} />
                ))}
              </Stack>
            </Paper>
          ))}
          {displayedShelters.length === 0 && <EmptyState title="Nincs rögzített befogadóhely" />}
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
                <TableCell sortDirection={sortBy === 'municipality' ? sortDir : false}>
                  <TableSortLabel active={sortBy === 'municipality'} direction={sortBy === 'municipality' ? sortDir : 'asc'} onClick={() => handleSort('municipality')}>
                    Település
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sortBy === 'capacity' ? sortDir : false}>
                  <TableSortLabel active={sortBy === 'capacity'} direction={sortBy === 'capacity' ? sortDir : 'asc'} onClick={() => handleSort('capacity')}>
                    Kapacitás
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sortBy === 'status' ? sortDir : false}>
                  <TableSortLabel active={sortBy === 'status'} direction={sortBy === 'status' ? sortDir : 'asc'} onClick={() => handleSort('status')}>
                    Státusz
                  </TableSortLabel>
                </TableCell>
                <TableCell>Szolgáltatások</TableCell>
                <TableCell align="right"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayedShelters.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.municipality ?? '–'}</TableCell>
                  <TableCell>{s.capacity_total}</TableCell>
                  <TableCell><Chip size="small" label={statusLabels[s.status]} color={statusColors[s.status]} /></TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {serviceLabels(s).map((label) => (
                        <Chip key={label} size="small" variant="outlined" label={label} />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    {canManage && (
                      <Tooltip title="Szerkesztés">
                        <IconButton onClick={() => setDialogShelter(s)}><EditIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                    {isAdmin && (
                      <Tooltip title="Törlés">
                        <IconButton color="error" onClick={() => setDeleteTarget(s)}><DeleteIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {displayedShelters.length === 0 && (
                <TableRow><TableCell colSpan={6}><EmptyState title="Nincs rögzített befogadóhely" /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {dialogShelter && (
        <ShelterDialog
          shelter={dialogShelter === 'new' ? null : dialogShelter}
          municipalities={municipalities}
          onClose={() => setDialogShelter(null)}
          onSaved={() => {
            setDialogShelter(null);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Befogadóhely törlése"
        description={`Biztosan törli a(z) "${deleteTarget?.name}" befogadóhelyet? A törlés csak akkor sikeres, ha jelenleg nincs eseményhez rendelve.`}
        confirmLabel="Törlés"
        severity="error"
        isSubmitting={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </Box>
  );
}

function ShelterDialog({
  shelter,
  municipalities,
  onClose,
  onSaved,
}: {
  shelter: Shelter | null;
  municipalities: Municipality[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(shelter?.name ?? '');
  const [municipalityId, setMunicipalityId] = useState<number | ''>('');
  const [address, setAddress] = useState(shelter?.address ?? '');
  const [capacityTotal, setCapacityTotal] = useState(shelter?.capacity_total ?? 50);
  const [accessibleCapacity, setAccessibleCapacity] = useState(shelter?.accessible_capacity ?? 0);
  const [medicalSupport, setMedicalSupport] = useState(shelter?.medical_support_available ?? false);
  const [drinkingWater, setDrinkingWater] = useState(shelter?.drinking_water_available ?? false);
  const [meals, setMeals] = useState(shelter?.meals_available ?? false);
  const [hygiene, setHygiene] = useState(shelter?.hygiene_facilities_available ?? false);
  const [childcare, setChildcare] = useState(shelter?.childcare_available ?? false);
  const [psychSupport, setPsychSupport] = useState(shelter?.psychological_support_available ?? false);
  const [houseRules, setHouseRules] = useState(shelter?.house_rules ?? '');
  const [publicHealthNotes, setPublicHealthNotes] = useState(shelter?.public_health_notes ?? '');
  const [status, setStatus] = useState<Shelter['status']>(shelter?.status ?? 'planned');
  const [contactPhone, setContactPhone] = useState(shelter?.contact_phone ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  useEffect(() => {
    if (shelter && municipalities.length > 0) {
      const match = municipalities.find((m) => m.name === shelter.municipality);
      if (match) setMunicipalityId(match.id);
    }
  }, [shelter, municipalities]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (municipalityId === '') return;
    setIsSubmitting(true);
    try {
      const payload = {
        name,
        municipality_id: municipalityId,
        address,
        capacity_total: capacityTotal,
        accessible_capacity: accessibleCapacity,
        medical_support_available: medicalSupport,
        drinking_water_available: drinkingWater,
        meals_available: meals,
        hygiene_facilities_available: hygiene,
        childcare_available: childcare,
        psychological_support_available: psychSupport,
        house_rules: houseRules || undefined,
        public_health_notes: publicHealthNotes || undefined,
        status,
        contact_phone: contactPhone || undefined,
      };
      if (shelter) {
        await updateShelter(shelter.id, payload);
        toast.success('Befogadóhely frissítve.');
      } else {
        await createShelter(payload);
        toast.success('Befogadóhely létrehozva.');
      }
      onSaved();
    } catch {
      toast.error('A mentés nem sikerült.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile}>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>{shelter ? 'Befogadóhely szerkesztése' : 'Új befogadóhely'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Név" required fullWidth value={name} onChange={(e) => setName(e.target.value)} />
            <MunicipalityAutocomplete municipalities={municipalities} value={municipalityId} onChange={setMunicipalityId} required sx={{ width: '100%' }} />
            <TextField label="Cím" required fullWidth value={address} onChange={(e) => setAddress(e.target.value)} />
            <Stack direction="row" spacing={2}>
              <TextField label="Teljes kapacitás" type="number" required fullWidth value={capacityTotal} onChange={(e) => setCapacityTotal(Number(e.target.value))} />
              <TextField label="Akadálymentes kapacitás" type="number" fullWidth value={accessibleCapacity} onChange={(e) => setAccessibleCapacity(Number(e.target.value))} />
            </Stack>
            <TextField select label="Státusz" required fullWidth value={status} onChange={(e) => setStatus(e.target.value as Shelter['status'])}>
              <MenuItem value="planned">Tervezett</MenuItem>
              <MenuItem value="active">Aktív</MenuItem>
              <MenuItem value="full">Betelt</MenuItem>
              <MenuItem value="inactive">Inaktív</MenuItem>
            </TextField>
            <TextField label="Kapcsolattartó telefonszám" fullWidth value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 1 }}>Szolgáltatások</Typography>
            <Stack direction="row" flexWrap="wrap" useFlexGap>
              <FormControlLabel
                control={<Checkbox checked={medicalSupport} onChange={(e) => setMedicalSupport(e.target.checked)} />}
                label="Egészségügyi támogatás"
              />
              <FormControlLabel
                control={<Checkbox checked={drinkingWater} onChange={(e) => setDrinkingWater(e.target.checked)} />}
                label="Ivóvíz biztosított"
              />
              <FormControlLabel
                control={<Checkbox checked={meals} onChange={(e) => setMeals(e.target.checked)} />}
                label="Étkeztetés biztosított"
              />
              <FormControlLabel
                control={<Checkbox checked={hygiene} onChange={(e) => setHygiene(e.target.checked)} />}
                label="Higiéniai/tisztálkodási lehetőség"
              />
              <FormControlLabel
                control={<Checkbox checked={childcare} onChange={(e) => setChildcare(e.target.checked)} />}
                label="Gyermekellátás"
              />
              <FormControlLabel
                control={<Checkbox checked={psychSupport} onChange={(e) => setPsychSupport(e.target.checked)} />}
                label="Lelki segítségnyújtás"
              />
            </Stack>
            <TextField
              label="Házirend / működési rend (opcionális)"
              multiline
              minRows={2}
              fullWidth
              value={houseRules}
              onChange={(e) => setHouseRules(e.target.value)}
            />
            <TextField
              label="Közegészségügyi/közbiztonsági megjegyzések (opcionális)"
              multiline
              minRows={2}
              fullWidth
              value={publicHealthNotes}
              onChange={(e) => setPublicHealthNotes(e.target.value)}
            />
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
