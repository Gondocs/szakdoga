import { Fragment, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Chip,
  CircularProgress,
  InputAdornment,
  Alert,
  Checkbox,
  MenuItem,
  IconButton,
  Collapse,
  Grid,
  Pagination,
  TableSortLabel,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import PersonIcon from '@mui/icons-material/Person';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MapIcon from '@mui/icons-material/Map';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'react-toastify';
import type { Municipality, Person, RegistrationStatus, Shelter } from '../../types';
import {
  bulkImportPersons,
  bulkUpdateRegistrationStatus,
  fetchAllShelters,
  fetchMunicipalities,
  fetchPersonMunicipalitySummary,
  fetchPersons,
  personsExportUrl,
  type MunicipalityPersonSummary,
} from '../../lib/api/endpoints';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { specialNeedCategoryLabels, specialNeedOptions } from '../../constants/specialNeeds';
import { SpecialNeedIcon } from '../../components/ui/SpecialNeedIcon';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { MunicipalityAutocomplete } from '../../components/ui/MunicipalityAutocomplete';
import { EventSubNav } from '../../components/layout/EventSubNav';
import { useAuth } from '../auth/AuthContext';

const statusLabels: Record<string, string> = {
  registered: 'Regisztrált',
  checked_in_assembly: 'Megjelent a gyülekezőponton',
  in_transport: 'Szállítás alatt',
  arrived_shelter: 'Megérkezett',
  left_shelter: 'Befogadóhelyet elhagyta',
  returned_home: 'Visszatelepült',
  missing: 'Hiányzik',
  cancelled: 'Törölt',
};

const channelLabels: Record<string, string> = {
  staff: 'Hatósági',
  self_service: 'Önkiszolgáló',
};

const PER_PAGE_OPTIONS = [25, 50, 100, 200];
const PER_PAGE_ALL = 1000;
const GYMS_CENTER: [number, number] = [47.75, 17.35];

function filterDescription(searchParams: URLSearchParams, shelters: Shelter[], municipalities: Municipality[]): string | null {
  const category = searchParams.get('special_need_category');
  const type = searchParams.get('special_need_type');
  const status = searchParams.get('status');
  const transport = searchParams.get('central_transport_required');
  const accommodation = searchParams.get('central_accommodation_required');
  const shelterId = searchParams.get('shelter_id');
  const municipalityId = searchParams.get('municipality_id');

  if (category) {
    const label = type
      ? specialNeedOptions[category as keyof typeof specialNeedOptions]?.find((o) => o.value === type)?.label
      : specialNeedCategoryLabels[category as keyof typeof specialNeedCategoryLabels];
    return `Szűrve: ${label ?? category}`;
  }
  if (status) return `Szűrve: ${statusLabels[status] ?? status} státuszúak`;
  if (transport === '1') return 'Szűrve: központi szállítást igénylők';
  if (accommodation === '1') return 'Szűrve: központi elszállásolást igénylők';
  if (shelterId) {
    const shelter = shelters.find((s) => s.id === shelterId);
    return `Szűrve: ${shelter ? shelter.name : 'kiválasztott befogadóhely'}`;
  }
  if (municipalityId) {
    const municipality = municipalities.find((m) => String(m.id) === municipalityId);
    return `Szűrve: ${municipality ? municipality.name : 'kiválasztott település'}`;
  }
  return null;
}

const bulkStatusOptions: { value: RegistrationStatus; label: string }[] = [
  { value: 'checked_in_assembly', label: 'Megjelent a gyülekezőponton' },
  { value: 'in_transport', label: 'Szállítás alatt' },
  { value: 'arrived_shelter', label: 'Megérkezett' },
  { value: 'left_shelter', label: 'Befogadóhelyet elhagyta' },
  { value: 'returned_home', label: 'Visszatelepült' },
  { value: 'missing', label: 'Hiányzik' },
  { value: 'cancelled', label: 'Törölt' },
];

function PersonQuickInfo({ person }: { person: Person }) {
  const address = [person.address.postal_code, person.address.settlement, person.address.street, person.address.house_number]
    .filter(Boolean)
    .join(', ');

  return (
    <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Typography variant="caption" color="text.secondary" display="block">Telefon</Typography>
          <Typography variant="body2">{person.phone ?? '–'}</Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Typography variant="caption" color="text.secondary" display="block">E-mail</Typography>
          <Typography variant="body2">{person.email ?? '–'}</Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Typography variant="caption" color="text.secondary" display="block">Születési hely/idő</Typography>
          <Typography variant="body2">{person.birth_place ?? '–'} / {person.birth_date ?? '–'}</Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Typography variant="caption" color="text.secondary" display="block">Okmányszám</Typography>
          <Typography variant="body2">{person.id_document_number ?? '–'}</Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 6 }}>
          <Typography variant="caption" color="text.secondary" display="block">Cím</Typography>
          <Typography variant="body2">{address || '–'}</Typography>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 6 }}>
          <Typography variant="caption" color="text.secondary" display="block">Egyedi igények</Typography>
          {person.special_needs?.length ? (
            <Stack spacing={0.25}>
              {person.special_needs.map((n) => (
                <Typography key={n.id} variant="body2">
                  {specialNeedCategoryLabels[n.category] ?? n.category}{n.description ? ` — ${n.description}` : ''}
                </Typography>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2">–</Typography>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}

export function PersonListPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [searchParams, setSearchParams] = useSearchParams();
  const [persons, setPersons] = useState<Person[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<RegistrationStatus | ''>('');
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [pendingBulkCancel, setPendingBulkCancel] = useState(false);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'municipality' | 'created_at'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showTransportMap, setShowTransportMap] = useState(false);
  const [transportMapData, setTransportMapData] = useState<MunicipalityPersonSummary[]>([]);
  const [isLoadingTransportMap, setIsLoadingTransportMap] = useState(false);

  const canBulkEdit = user?.role?.code === 'admin' || user?.role?.code === 'manager' || user?.role?.code === 'registrar';
  const activeFilterLabel = filterDescription(searchParams, shelters, municipalities);
  const isTransportFilterActive = searchParams.get('central_transport_required') === '1';

  useEffect(() => {
    fetchAllShelters().then(setShelters).catch(() => setShelters([]));
    fetchMunicipalities().then(setMunicipalities).catch(() => setMunicipalities([]));
  }, []);

  useEffect(() => {
    setShowTransportMap(false);
  }, [isTransportFilterActive, eventId]);

  useEffect(() => {
    if (!eventId || !isTransportFilterActive || !showTransportMap) return;
    setIsLoadingTransportMap(true);
    fetchPersonMunicipalitySummary(eventId, { central_transport_required: true })
      .then(setTransportMapData)
      .catch(() => setTransportMapData([]))
      .finally(() => setIsLoadingTransportMap(false));
  }, [eventId, isTransportFilterActive, showTransportMap, refreshKey]);

  // Szűrés/keresés/oldalméret változásakor vissza az első oldalra.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, search, searchParams, perPage]);

  useEffect(() => {
    if (!eventId) return;
    setIsLoading(true);
    const municipalityIdParam = searchParams.get('municipality_id');
    fetchPersons(eventId, {
      search: search || undefined,
      status: searchParams.get('status') ?? undefined,
      special_need_category: searchParams.get('special_need_category') ?? undefined,
      special_need_type: searchParams.get('special_need_type') ?? undefined,
      central_transport_required: searchParams.get('central_transport_required') === '1' ? true : undefined,
      central_accommodation_required: searchParams.get('central_accommodation_required') === '1' ? true : undefined,
      shelter_id: searchParams.get('shelter_id') ?? undefined,
      municipality_id: municipalityIdParam ? Number(municipalityIdParam) : undefined,
      sort_by: sortBy,
      sort_dir: sortDir,
      page,
      per_page: perPage,
    })
      .then((res) => {
        setPersons(res.data);
        setSelected(new Set());
        setExpandedIds(new Set());
        setTotal(res.meta?.total ?? res.data.length);
        setLastPage(res.meta?.last_page ?? 1);
      })
      .finally(() => setIsLoading(false));
  }, [eventId, search, searchParams, refreshKey, page, perPage, sortBy, sortDir]);

  function handleSort(column: 'name' | 'status' | 'municipality') {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  }

  function updateFilterParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  }

  function toggleSelected(personId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === persons.length ? new Set() : new Set(persons.map((p) => p.id))));
  }

  function toggleExpanded(personId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  }

  async function applyBulkStatus(status: RegistrationStatus) {
    if (!eventId || selected.size === 0) return;
    setIsBulkSubmitting(true);
    try {
      const result = await bulkUpdateRegistrationStatus(eventId, [...selected], status);
      if (result.failed.length > 0) {
        toast.warning(`${result.updated.length} személy frissítve, ${result.failed.length} sikertelen volt.`);
      } else {
        toast.success(`${result.updated.length} személy státusza frissítve.`);
      }
      setBulkStatus('');
      setRefreshKey((k) => k + 1);
    } catch {
      toast.error('A tömeges státuszváltás nem sikerült.');
    } finally {
      setIsBulkSubmitting(false);
    }
  }

  async function handleBulkImport(file: File) {
    if (!eventId) return;
    setIsBulkImporting(true);
    try {
      const result = await bulkImportPersons(eventId, file);
      toast.success(`${result.created_count} személy importálva, QR-kóddal ellátva.`);
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} sor kihagyva: ${result.errors.join(' ')}`, { autoClose: 12000 });
      }
      setRefreshKey((k) => k + 1);
    } catch {
      toast.error('A tömeges import nem sikerült.');
    } finally {
      setIsBulkImporting(false);
    }
  }

  function handleBulkStatusChange(status: RegistrationStatus) {
    setBulkStatus(status);
    if (status === 'cancelled') {
      setPendingBulkCancel(true);
    } else {
      applyBulkStatus(status);
    }
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, total);

  return (
    <Box>
      {eventId && <EventSubNav eventId={eventId} />}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Regisztrált személyek</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            component="a"
            href={eventId ? personsExportUrl(eventId) : undefined}
            target="_blank"
            rel="noopener"
          >
            CSV export
          </Button>
          {canBulkEdit && (
            <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} disabled={isBulkImporting}>
              {isBulkImporting ? 'Importálás…' : 'Tömeges import (CSV)'}
              <input
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) handleBulkImport(file);
                }}
              />
            </Button>
          )}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate(`/esemenyek/${eventId}/uj-regisztracio`)}>
            Új regisztráció
          </Button>
        </Stack>
      </Stack>

      {activeFilterLabel && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          onClose={() => {
            setSearch('');
            setSearchParams({}, { replace: true });
          }}
          action={
            <Stack direction="row" spacing={1}>
              {isTransportFilterActive && (
                <Button
                  color="inherit"
                  size="small"
                  startIcon={<MapIcon />}
                  onClick={() => setShowTransportMap((prev) => !prev)}
                >
                  {showTransportMap ? 'Térkép elrejtése' : 'Térkép mutatása'}
                </Button>
              )}
              <Button
                color="inherit"
                size="small"
                startIcon={<FilterAltOffIcon />}
                onClick={() => {
                  setSearch('');
                  setSearchParams({}, { replace: true });
                }}
              >
                Szűrő törlése
              </Button>
            </Stack>
          }
        >
          {activeFilterLabel}
        </Alert>
      )}

      {isTransportFilterActive && (
        <Collapse in={showTransportMap} timeout="auto" unmountOnExit>
          <Paper variant="outlined" sx={{ overflow: 'hidden', height: 360, mb: 2 }}>
            {isLoadingTransportMap ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <MapContainer center={GYMS_CENTER} zoom={9} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> közreműködők'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {transportMapData.map((m) => (
                  <CircleMarker
                    key={m.municipality_id}
                    center={[m.lat, m.lng]}
                    radius={Math.min(6 + Math.sqrt(m.person_count) * 2, 22)}
                    pathOptions={{ color: '#a3172b', fillColor: '#a3172b', fillOpacity: 0.3, weight: 1 }}
                    eventHandlers={{
                      click: () => updateFilterParam('municipality_id', String(m.municipality_id)),
                    }}
                  >
                    <Popup>
                      <strong>{m.name}</strong>
                      <br />
                      Központi szállítást igénylők: {m.person_count} fő
                      <br />
                      <em>Kattintson a szűkítéshez</em>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            )}
          </Paper>
          {transportMapData.length === 0 && !isLoadingTransportMap && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Egyik érintett település sincs koordinátával ellátva.
            </Typography>
          )}
        </Collapse>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems={{ xs: 'stretch', sm: 'center' }}>
        <TextField
          placeholder="Keresés név alapján…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ maxWidth: { sm: 360 } }}
          size="small"
          fullWidth
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
          }}
        />
        {canBulkEdit && persons.length > 0 && (
          <Button size="small" color="inherit" onClick={toggleSelectAll}>
            {selected.size === persons.length ? 'Kijelölés törlése' : `Összes kijelölése (${persons.length})`}
          </Button>
        )}
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <TextField
          select
          size="small"
          label="Státusz"
          value={searchParams.get('status') ?? ''}
          onChange={(e) => updateFilterParam('status', e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">Összes</MenuItem>
          {Object.entries(statusLabels).map(([value, label]) => (
            <MenuItem key={value} value={value}>{label}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Speciális igény"
          value={searchParams.get('special_need_category') ?? ''}
          onChange={(e) => updateFilterParam('special_need_category', e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">Összes</MenuItem>
          {Object.entries(specialNeedCategoryLabels).map(([value, label]) => (
            <MenuItem key={value} value={value}>{label}</MenuItem>
          ))}
        </TextField>
        <MunicipalityAutocomplete
          label="Település"
          size="small"
          municipalities={municipalities}
          value={searchParams.get('municipality_id') ? Number(searchParams.get('municipality_id')) : ''}
          onChange={(id) => updateFilterParam('municipality_id', id === '' ? '' : String(id))}
          sx={{ minWidth: 180 }}
        />
        <TextField
          select
          size="small"
          label="Befogadóhely"
          value={searchParams.get('shelter_id') ?? ''}
          onChange={(e) => updateFilterParam('shelter_id', e.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">Összes</MenuItem>
          {shelters.map((s) => (
            <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
          ))}
        </TextField>
        {isMobile && (
          <TextField
            select
            size="small"
            label="Rendezés"
            value={`${sortBy}:${sortDir}`}
            onChange={(e) => {
              const [by, dir] = e.target.value.split(':') as ['name' | 'status' | 'municipality' | 'created_at', 'asc' | 'desc'];
              setSortBy(by);
              setSortDir(dir);
            }}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="name:asc">Név (A–Z)</MenuItem>
            <MenuItem value="name:desc">Név (Z–A)</MenuItem>
            <MenuItem value="status:asc">Státusz szerint</MenuItem>
            <MenuItem value="municipality:asc">Település szerint</MenuItem>
            <MenuItem value="created_at:desc">Legújabb elöl</MenuItem>
          </TextField>
        )}
      </Stack>

      {canBulkEdit && selected.size > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Typography variant="body2" sx={{ flex: 1 }}>{selected.size} személy kijelölve</Typography>
            <TextField
              select
              size="small"
              label="Új státusz"
              value={bulkStatus}
              onChange={(e) => handleBulkStatusChange(e.target.value as RegistrationStatus)}
              disabled={isBulkSubmitting}
              sx={{ minWidth: 220 }}
            >
              {bulkStatusOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : isMobile ? (
        <Stack spacing={1.5}>
          {persons.map((person) => (
            <Paper key={person.id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ cursor: 'pointer' }} onClick={() => navigate(`/szemelyek/${person.id}`)}>
                <Stack direction="row" spacing={1} alignItems="center">
                  {canBulkEdit && (
                    <Checkbox
                      checked={selected.has(person.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelected(person.id)}
                      size="small"
                    />
                  )}
                  <PersonIcon color="secondary" />
                  <Box>
                    <Typography fontWeight={700}>{person.full_name}</Typography>
                    <Typography variant="body2" color="text.secondary">{person.municipality?.name ?? '–'}</Typography>
                  </Box>
                </Stack>
                <Stack direction="row" alignItems="center">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(person.id);
                    }}
                    sx={{ transform: expandedIds.has(person.id) ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                  >
                    <ExpandMoreIcon fontSize="small" />
                  </IconButton>
                  <ChevronRightIcon color="action" />
                </Stack>
              </Stack>
              <Stack
                direction="row"
                spacing={1}
                sx={{ mt: 1.5, cursor: 'pointer' }}
                flexWrap="wrap"
                alignItems="center"
                onClick={() => navigate(`/szemelyek/${person.id}`)}
              >
                {person.registration && <Chip size="small" label={statusLabels[person.registration.status]} />}
                {person.registration?.channel && (
                  <Chip size="small" variant="outlined" label={channelLabels[person.registration.channel] ?? person.registration.channel} />
                )}
                {[...new Set((person.special_needs ?? []).map((n) => n.category))].map((cat) => (
                  <SpecialNeedIcon key={cat} category={cat} fontSize="small" color="secondary" />
                ))}
                {person.family_id && (
                  <Chip
                    size="small"
                    variant="outlined"
                    color="secondary"
                    label={person.family?.family_code ?? 'Család'}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/csaladok/${person.family_id}`);
                    }}
                  />
                )}
              </Stack>
              <Collapse in={expandedIds.has(person.id)} timeout="auto" unmountOnExit>
                <Box sx={{ mt: 1.5 }}>
                  <PersonQuickInfo person={person} />
                </Box>
              </Collapse>
            </Paper>
          ))}
          {persons.length === 0 && <EmptyState title="Nincs találat" description="A keresésnek/szűrésnek megfelelő regisztrált személy nem található." />}
        </Stack>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox"></TableCell>
                {canBulkEdit && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selected.size > 0 && selected.size < persons.length}
                      checked={persons.length > 0 && selected.size === persons.length}
                      onChange={toggleSelectAll}
                      size="small"
                    />
                  </TableCell>
                )}
                <TableCell sortDirection={sortBy === 'name' ? sortDir : false}>
                  <TableSortLabel active={sortBy === 'name'} direction={sortBy === 'name' ? sortDir : 'asc'} onClick={() => handleSort('name')}>
                    Név
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }} sortDirection={sortBy === 'municipality' ? sortDir : false}>
                  <TableSortLabel active={sortBy === 'municipality'} direction={sortBy === 'municipality' ? sortDir : 'asc'} onClick={() => handleSort('municipality')}>
                    Település
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Csatorna</TableCell>
                <TableCell sortDirection={sortBy === 'status' ? sortDir : false}>
                  <TableSortLabel active={sortBy === 'status'} direction={sortBy === 'status' ? sortDir : 'asc'} onClick={() => handleSort('status')}>
                    Státusz
                  </TableSortLabel>
                </TableCell>
                <TableCell>Speciális igény</TableCell>
                <TableCell>Család</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {persons.map((person) => (
                <Fragment key={person.id}>
                  <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/szemelyek/${person.id}`)}>
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <IconButton
                        size="small"
                        onClick={() => toggleExpanded(person.id)}
                        sx={{ transform: expandedIds.has(person.id) ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                      >
                        <ExpandMoreIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                    {canBulkEdit && (
                      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(person.id)} onChange={() => toggleSelected(person.id)} size="small" />
                      </TableCell>
                    )}
                    <TableCell>{person.full_name}</TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{person.municipality?.name ?? '–'}</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                      {person.registration?.channel && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={channelLabels[person.registration.channel] ?? person.registration.channel}
                        />
                      )}
                    </TableCell>
                    <TableCell>{person.registration ? statusLabels[person.registration.status] : '–'}</TableCell>
                    <TableCell>
                      {person.special_needs?.length ? (
                        <Stack direction="row" spacing={0.5}>
                          {[...new Set(person.special_needs.map((n) => n.category))].map((cat) => (
                            <SpecialNeedIcon key={cat} category={cat} fontSize="small" color="secondary" />
                          ))}
                        </Stack>
                      ) : '–'}
                    </TableCell>
                    <TableCell>
                      {person.family_id && (
                        <Chip
                          size="small"
                          variant="outlined"
                          color="secondary"
                          label={person.family?.family_code ?? 'Család'}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/csaladok/${person.family_id}`);
                          }}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={canBulkEdit ? 8 : 7} sx={{ py: 0, borderBottom: expandedIds.has(person.id) ? undefined : 'none' }}>
                      <Collapse in={expandedIds.has(person.id)} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 1.5 }}>
                          <PersonQuickInfo person={person} />
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              ))}
              {persons.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canBulkEdit ? 8 : 7}>
                    <EmptyState title="Nincs találat" description="A keresésnek/szűrésnek megfelelő regisztrált személy nem található." />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!isLoading && total > 0 && (
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={1.5} sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {rangeStart}–{rangeEnd} / {total} fő
          </Typography>
          <Pagination
            count={lastPage}
            page={page}
            onChange={(_, value) => setPage(value)}
            size={isMobile ? 'small' : 'medium'}
            color="primary"
          />
          <TextField
            select
            size="small"
            label="Oldalanként"
            value={perPage}
            onChange={(e) => setPerPage(Number(e.target.value))}
            sx={{ minWidth: 140 }}
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <MenuItem key={n} value={n}>{n}</MenuItem>
            ))}
            <MenuItem value={PER_PAGE_ALL}>Mind</MenuItem>
          </TextField>
        </Stack>
      )}

      <ConfirmDialog
        open={pendingBulkCancel}
        title="Regisztrációk törlése"
        description={`Biztosan törölt státuszúra állítja a kijelölt ${selected.size} személy regisztrációját? A művelet a naplóban visszakövethető marad, de a személyek kikerülnek az aktív listákból.`}
        confirmLabel="Törlés megerősítése"
        severity="error"
        isSubmitting={isBulkSubmitting}
        onCancel={() => {
          setPendingBulkCancel(false);
          setBulkStatus('');
        }}
        onConfirm={async () => {
          await applyBulkStatus('cancelled');
          setPendingBulkCancel(false);
        }}
      />
    </Box>
  );
}
