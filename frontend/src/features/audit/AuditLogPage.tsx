import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Stack,
  TextField,
  MenuItem,
  Button,
  Pagination,
  Switch,
  FormControlLabel,
  Tooltip,
  Link,
  useMediaQuery,
  useTheme,
  type ChipProps,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { formatDistanceToNow } from 'date-fns';
import { hu } from 'date-fns/locale';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import AutoDeleteIcon from '@mui/icons-material/AutoDelete';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HomeIcon from '@mui/icons-material/Home';
import DownloadIcon from '@mui/icons-material/Download';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import type { AuditLogEntry, AuditLogFilterOptions } from '../../types';
import { auditLogExportUrl, fetchAuditLogFilterOptions, fetchAuditLogs, type AuditLogFilters } from '../../lib/api/endpoints';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';

const actionMeta: Record<string, { label: string; icon: ReactNode; color: ChipProps['color'] }> = {
  create: { label: 'Létrehozás', icon: <AddCircleIcon fontSize="small" />, color: 'success' },
  update: { label: 'Módosítás', icon: <EditIcon fontSize="small" />, color: 'info' },
  delete: { label: 'Törlés', icon: <DeleteIcon fontSize="small" />, color: 'error' },
  checkin: { label: 'Érkeztetés', icon: <LoginIcon fontSize="small" />, color: 'primary' },
  status_update: { label: 'Státuszváltás', icon: <SwapHorizIcon fontSize="small" />, color: 'secondary' },
  shelter_transfer: { label: 'Áthelyezés', icon: <SwapHorizIcon fontSize="small" />, color: 'secondary' },
  qr_issue: { label: 'QR-kód kiadás', icon: <QrCode2Icon fontSize="small" />, color: 'default' },
  qr_reissue_lost: { label: 'Elveszett kód pótlása', icon: <WarningAmberIcon fontSize="small" />, color: 'warning' },
  transport_board: { label: 'Felszállás', icon: <DirectionsBusIcon fontSize="small" />, color: 'primary' },
  transport_alight: { label: 'Leszállás', icon: <DirectionsBusIcon fontSize="small" />, color: 'primary' },
  transport_import: { label: 'Manifeszt import', icon: <UploadFileIcon fontSize="small" />, color: 'default' },
  self_update: { label: 'Önkiszolgáló frissítés', icon: <EditIcon fontSize="small" />, color: 'info' },
  self_arrival_confirmed: { label: 'Érkezés megerősítve', icon: <CheckCircleIcon fontSize="small" />, color: 'success' },
  self_return_confirmed: { label: 'Hazatérés megerősítve', icon: <HomeIcon fontSize="small" />, color: 'success' },
  data_retention_purge: { label: 'Adatmegőrzési törlés', icon: <AutoDeleteIcon fontSize="small" />, color: 'error' },
  login: { label: 'Bejelentkezés', icon: <LoginIcon fontSize="small" />, color: 'default' },
  logout: { label: 'Kijelentkezés', icon: <LogoutIcon fontSize="small" />, color: 'default' },
  login_failed: { label: 'Sikertelen bejelentkezés', icon: <WarningAmberIcon fontSize="small" />, color: 'error' },
  user_create: { label: 'Felhasználó létrehozása', icon: <AddCircleIcon fontSize="small" />, color: 'success' },
  user_update: { label: 'Felhasználó módosítása', icon: <EditIcon fontSize="small" />, color: 'info' },
  role_change: { label: 'Szerepkör módosítása', icon: <AdminPanelSettingsIcon fontSize="small" />, color: 'warning' },
};

function actionInfo(action: string) {
  return actionMeta[action] ?? { label: action, icon: <HelpOutlineIcon fontSize="small" />, color: 'default' as ChipProps['color'] };
}

function buildEntityLink(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case 'Person':
      return `/szemelyek/${entityId}`;
    case 'Family':
      return `/csaladok/${entityId}`;
    case 'EvacuationEvent':
      return `/esemenyek/${entityId}/attekintes`;
    default:
      return null;
  }
}

const FIELD_LABELS: Record<string, string> = {
  event_id: 'Esemény',
  family_id: 'Család',
  municipality_id: 'Település',
  last_name: 'Vezetéknév',
  first_name: 'Keresztnév',
  birth_last_name: 'Születési vezetéknév',
  birth_first_name: 'Születési keresztnév',
  birth_place: 'Születési hely',
  birth_date: 'Születési dátum',
  mother_birth_name: 'Anyja neve',
  address_postal_code: 'Irányítószám',
  address_settlement: 'Település (cím)',
  address_street: 'Utca',
  address_house_number: 'Házszám',
  phone: 'Telefon',
  email: 'E-mail',
  created_by: 'Létrehozta',
  updated_by: 'Módosította',
  gender: 'Nem',
  id_document_number: 'Okmányszám',
  document_photo_front_path: 'Okmányfénykép (elülső)',
  document_photo_back_path: 'Okmányfénykép (hátulsó)',
  person_id: 'Személy',
  status: 'Státusz',
  channel: 'Regisztráció csatorna',
  central_transport_required: 'Központi szállítás igénylése',
  central_accommodation_required: 'Központi elszállásolás igénylése',
  under_regular_medical_care: 'Rendszeres orvosi ellátás',
  own_vehicle: 'Saját jármű',
  travels_alone: 'Egyedül utazik',
  self_arrival_confirmed_at: 'Önálló megérkezés megerősítve',
  registered_at: 'Regisztráció időpontja',
  registered_by: 'Regisztrálta',
  shelter_id: 'Befogadóhely',
  bed_label: 'Ágy/szoba azonosító',
  checked_in_at: 'Érkeztetés időpontja',
  temporary_leave_at: 'Ideiglenes eltávozás',
  temporary_return_at: 'Visszaérkezés',
  checked_in_by: 'Érkeztette',
  name: 'Név',
  address: 'Cím',
  capacity_total: 'Teljes kapacitás',
  accessible_capacity: 'Akadálymentes férőhelyek',
  medical_support_available: 'Egészségügyi ellátás',
  drinking_water_available: 'Ivóvíz elérhető',
  meals_available: 'Étkezés elérhető',
  hygiene_facilities_available: 'Tisztálkodási lehetőség',
  childcare_available: 'Gyermekellátás',
  psychological_support_available: 'Lelki segítségnyújtás',
  house_rules: 'Házirend',
  public_health_notes: 'Közegészségügyi megjegyzés',
  contact_phone: 'Kapcsolattartó telefon',
  plate_number: 'Rendszám',
  label: 'Megnevezés',
  vehicle_type: 'Jármű típusa',
  capacity: 'Kapacitás',
  driver_name: 'Sofőr neve',
  notes: 'Megjegyzés',
  avatar_path: 'Profilkép',
  email_verified_at: 'E-mail megerősítve',
  password: 'Jelszó',
  remember_token: 'Munkamenet-token',
  role_id: 'Szerepkör',
  code: 'Kód',
  starts_at: 'Kezdés időpontja',
  ends_at: 'Befejezés időpontja',
  vehicle_id: 'Jármű',
  last_lat: 'Utolsó pozíció (szélesség)',
  last_lng: 'Utolsó pozíció (hosszúság)',
  last_position_at: 'Utolsó pozíció időpontja',
  origin: 'Indulási pont',
  destination: 'Célállomás',
  escort_name: 'Kísérő neve',
  departure_planned_at: 'Tervezett indulás',
  arrival_planned_at: 'Tervezett érkezés',
  delay_minutes: 'Késés (perc)',
  route_change_note: 'Útvonalváltozás megjegyzés',
  transport_id: 'Jármű/szállítás',
  boarded_at: 'Felszállás időpontja',
  boarded_by: 'Felszállást rögzítette',
  alighted_at: 'Leszállás időpontja',
  alighted_by: 'Leszállást rögzítette',
  family_code: 'Család kód',
  primary_contact_person_id: 'Elsődleges kapcsolattartó',
  category: 'Kategória',
  severity: 'Súlyosság',
  description: 'Leírás',
  reported_by: 'Bejelentette',
  resolved_by: 'Lezárta',
  resolved_at: 'Lezárás időpontja',
  lat: 'Szélesség',
  lng: 'Hosszúság',
  public_id: 'Nyilvános azonosító',
  previous_public_id: 'Korábbi azonosító (visszavont)',
  token_hash: 'Token (kódolt)',
  delivery_method: 'Átadás módja',
  delivered_at: 'Átadás időpontja',
  delivered_by: 'Átadta',
  issued_by: 'Kiállította',
  county: 'Vármegye',
  postal_code: 'Irányítószám',
  type: 'Típus',
  priority: 'Prioritás',
  animal_type: 'Állat típusa',
  count: 'Darabszám',
  stays_at_address: 'A címen marad',
  note: 'Megjegyzés',
  recorded_by: 'Rögzítette',
  recorded_at: 'Rögzítés időpontja',
  capacity_limit: 'Kapacitáskorlát',
  checked_in_count: 'Jelenlegi létszám',
};

const HIDDEN_FIELDS = new Set(['id']);
const ALWAYS_MASKED_FIELDS = new Set(['password', 'token_hash', 'remember_token']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

function formatValue(key: string, value: unknown): string {
  if (ALWAYS_MASKED_FIELDS.has(key)) return value ? '•••• (rejtve)' : '–';
  if (value === null || value === undefined || value === '') return '–';
  if (typeof value === 'boolean') return value ? 'igen' : 'nem';
  if (typeof value === 'string') {
    if (ISO_DATE_RE.test(value)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toLocaleString('hu-HU');
    }
    if (UUID_RE.test(value)) return `${value.slice(0, 8)}…`;
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// A napló "előtte" és "utána" JSON-állapotát hasonlítja össze mezőnként,
// és csak azokat a mezőket jeleníti meg, amelyeknek ténylegesen
// megváltozott az értéke (a JSON-szerializált formát vetjük össze, hogy a
// beágyazott objektum/tömb mezők is helyesen összehasonlíthatók legyenek)
function FieldDiff({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const keys = Array.from(new Set([...(before ? Object.keys(before) : []), ...(after ? Object.keys(after) : [])]))
    .filter((k) => !HIDDEN_FIELDS.has(k))
    .sort((a, b) => fieldLabel(a).localeCompare(fieldLabel(b), 'hu'));
  const changed = keys.filter((k) => JSON.stringify(before?.[k] ?? null) !== JSON.stringify(after?.[k] ?? null));

  if (changed.length === 0) {
    return <Typography variant="body2" color="text.secondary">Nincs mezőszintű eltérés.</Typography>;
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ border: 0, pl: 0 }}>Mező</TableCell>
          <TableCell sx={{ border: 0 }}>Régi érték</TableCell>
          <TableCell sx={{ border: 0, width: 32 }} />
          <TableCell sx={{ border: 0 }}>Új érték</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {changed.map((key) => (
          <TableRow key={key} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
            <TableCell sx={{ border: 0, pl: 0, fontWeight: 700, whiteSpace: 'nowrap' }}>{fieldLabel(key)}</TableCell>
            <TableCell sx={{ border: 0, color: 'text.secondary' }}>
              {before ? formatValue(key, before[key]) : '–'}
            </TableCell>
            <TableCell sx={{ border: 0, color: 'text.secondary', textAlign: 'center' }}>→</TableCell>
            <TableCell sx={{ border: 0, fontWeight: 600 }}>{after ? formatValue(key, after[key]) : '–'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RelativeTime({ value }: { value: string }) {
  const date = new Date(value);
  return (
    <Tooltip title={date.toLocaleString('hu-HU')}>
      <span>{formatDistanceToNow(date, { addSuffix: true, locale: hu })}</span>
    </Tooltip>
  );
}

export function AuditLogPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [summary, setSummary] = useState<{ today_count: number; today_significant_count: number } | null>(null);
  const [filterOptions, setFilterOptions] = useState<AuditLogFilterOptions>({ users: [], events: [] });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState<number | ''>('');
  const [eventId, setEventId] = useState('');
  const [search, setSearch] = useState('');
  const [significantOnly, setSignificantOnly] = useState(false);

  useEffect(() => {
    fetchAuditLogFilterOptions().then(setFilterOptions).catch(() => {});
  }, []);

  function currentFilters(): AuditLogFilters {
    return {
      date_from: dateFrom ? dateFrom.toISOString() : undefined,
      date_to: dateTo ? dateTo.toISOString() : undefined,
      action: action || undefined,
      user_id: userId || undefined,
      event_id: eventId || undefined,
      q: search || undefined,
      significant_only: significantOnly || undefined,
      page,
    };
  }

  function load() {
    setIsLoading(true);
    fetchAuditLogs(currentFilters())
      .then((res) => {
        setLogs(res.data);
        setTotal(res.meta?.total ?? res.data.length);
        setLastPage(res.meta?.last_page ?? 1);
        setSummary(res.meta?.summary ?? null);
      })
      .catch(() => setError('Nincs jogosultsága a napló megtekintéséhez.'))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [page]);

  function applyFilters() {
    setPage(1);
    setTimeout(load, 0);
  }

  function clearFilters() {
    setDateFrom(null);
    setDateTo(null);
    setAction('');
    setUserId('');
    setEventId('');
    setSearch('');
    setSignificantOnly(false);
    setPage(1);
    setTimeout(load, 0);
  }

  const hasActiveFilters = dateFrom || dateTo || action || userId || eventId || search || significantOnly;

  if (error) return <ErrorState message={error} />;

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>Műveleti napló</Typography>

      {summary && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Ma {summary.today_count} esemény történt, ebből {summary.today_significant_count} jelentős.
        </Typography>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }} alignItems={{ xs: 'stretch', sm: 'flex-end' }} flexWrap="wrap" useFlexGap>
          <DateTimePicker
            label="Kezdő időpont"
            value={dateFrom}
            onChange={setDateFrom}
            ampm={false}
            format="yyyy.MM.dd HH:mm"
            slotProps={{ textField: { size: 'small' } }}
          />
          <DateTimePicker
            label="Záró időpont"
            value={dateTo}
            onChange={setDateTo}
            ampm={false}
            format="yyyy.MM.dd HH:mm"
            slotProps={{ textField: { size: 'small' } }}
          />
          <TextField select label="Művelet" size="small" value={action} onChange={(e) => setAction(e.target.value)} sx={{ minWidth: 180, flex: 1 }}>
            <MenuItem value="">Összes</MenuItem>
            {Object.entries(actionMeta).map(([value, meta]) => (
              <MenuItem key={value} value={value}>{meta.label}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Felhasználó"
            size="small"
            value={userId}
            onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : '')}
            sx={{ minWidth: 180, flex: 1 }}
          >
            <MenuItem value="">Összes</MenuItem>
            {filterOptions.users.map((u) => (
              <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Esemény"
            size="small"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            sx={{ minWidth: 200, flex: 1 }}
          >
            <MenuItem value="">Összes</MenuItem>
            {filterOptions.events.map((ev) => (
              <MenuItem key={ev.id} value={ev.id}>{ev.code} — {ev.name}</MenuItem>
            ))}
          </TextField>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }} flexWrap="wrap" useFlexGap>
          <TextField
            label="Szabad szöveges keresés"
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Felhasználó neve, entitás azonosítója…"
            sx={{ minWidth: 240, flex: 1 }}
          />
          <FormControlLabel
            control={<Switch checked={significantOnly} onChange={(e) => setSignificantOnly(e.target.checked)} size="small" />}
            label="Csak jelentős változások"
          />
          <Button variant="contained" onClick={applyFilters}>Szűrés</Button>
          {hasActiveFilters && <Button color="inherit" onClick={clearFilters}>Törlés</Button>}
          <Button
            variant="text"
            startIcon={<DownloadIcon />}
            component="a"
            href={auditLogExportUrl(currentFilters())}
            target="_blank"
            rel="noopener"
          >
            CSV export
          </Button>
          <FormControlLabel
            control={<Switch checked={showRawJson} onChange={(e) => setShowRawJson(e.target.checked)} size="small" />}
            label="Nyers JSON nézet"
            sx={{ ml: { sm: 'auto' } }}
          />
        </Stack>
      </Paper>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : isMobile ? (
        <Stack spacing={1.5}>
          {logs.map((log) => {
            const isExpanded = expandedId === log.id;
            const hasDiff = log.before || log.after;
            const info = actionInfo(log.action);
            const link = buildEntityLink(log.entity_type, log.entity_id);
            return (
              <Paper
                key={log.id}
                variant="outlined"
                sx={{ p: 2, cursor: hasDiff ? 'pointer' : 'default', ...(log.significant && { borderColor: 'error.main', bgcolor: 'error.50' }) }}
                onClick={() => hasDiff && setExpandedId(isExpanded ? null : log.id)}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="body2" color="text.secondary"><RelativeTime value={log.created_at} /></Typography>
                    <Typography fontWeight={700}>
                      {link ? (
                        <Link component="button" onClick={(e) => { e.stopPropagation(); navigate(link); }} underline="hover">
                          {log.entity_type} #{log.entity_id.slice(0, 8)}
                        </Link>
                      ) : (
                        <>{log.entity_type} #{log.entity_id.slice(0, 8)}</>
                      )}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">{log.user ?? '–'}</Typography>
                  </Box>
                  <Chip size="small" icon={info.icon as never} label={info.label} color={info.color} variant={log.significant ? 'filled' : 'outlined'} />
                </Stack>
                {log.data_masked && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    Egyes érzékeny mezők a szerepköre miatt el vannak rejtve.
                  </Typography>
                )}
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
                    {showRawJson ? (
                      <>
                        <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">Előtte</Typography>
                        <Box component="pre" sx={{ fontSize: '0.7rem', overflowX: 'auto', m: 0 }}>
                          {log.before ? JSON.stringify(log.before, null, 2) : '–'}
                        </Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mt: 1 }}>Utána</Typography>
                        <Box component="pre" sx={{ fontSize: '0.7rem', overflowX: 'auto', m: 0 }}>
                          {log.after ? JSON.stringify(log.after, null, 2) : '–'}
                        </Box>
                      </>
                    ) : (
                      <FieldDiff before={log.before} after={log.after} />
                    )}
                  </Box>
                </Collapse>
              </Paper>
            );
          })}
          {logs.length === 0 && <EmptyState title="Nincs naplóbejegyzés" description="A jelenlegi szűrésnek megfelelő időszakban nem történt rögzített művelet." />}
        </Stack>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width={40}></TableCell>
                <TableCell>Időpont</TableCell>
                <TableCell>Felhasználó</TableCell>
                <TableCell>Művelet</TableCell>
                <TableCell>Entitás</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => {
                const isExpanded = expandedId === log.id;
                const hasDiff = log.before || log.after;
                const info = actionInfo(log.action);
                const link = buildEntityLink(log.entity_type, log.entity_id);
                return (
                  <Fragment key={log.id}>
                    <TableRow
                      hover
                      sx={{ cursor: hasDiff ? 'pointer' : 'default', ...(log.significant && { bgcolor: 'error.50' }) }}
                      onClick={() => hasDiff && setExpandedId(isExpanded ? null : log.id)}
                    >
                      <TableCell>
                        {hasDiff && (
                          <IconButton size="small">
                            {isExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                          </IconButton>
                        )}
                      </TableCell>
                      <TableCell><RelativeTime value={log.created_at} /></TableCell>
                      <TableCell>{log.user ?? '–'}</TableCell>
                      <TableCell>
                        <Chip size="small" icon={info.icon as never} label={info.label} color={info.color} variant={log.significant ? 'filled' : 'outlined'} />
                      </TableCell>
                      <TableCell>
                        {link ? (
                          <Link component="button" onClick={(e) => { e.stopPropagation(); navigate(link); }} underline="hover">
                            {log.entity_type} #{log.entity_id.slice(0, 8)}
                          </Link>
                        ) : (
                          <>{log.entity_type} #{log.entity_id.slice(0, 8)}</>
                        )}
                        {log.data_masked && (
                          <Tooltip title="Egyes érzékeny mezők a szerepköre miatt el vannak rejtve.">
                            <WarningAmberIcon fontSize="inherit" color="disabled" sx={{ ml: 0.5, verticalAlign: 'middle' }} />
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                    {hasDiff && (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ p: 0, borderBottom: isExpanded ? undefined : 'none' }}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
                              {showRawJson ? (
                                <Stack direction="row" spacing={4} flexWrap="wrap">
                                  <Box sx={{ minWidth: 240 }}>
                                    <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">Előtte</Typography>
                                    <Box component="pre" sx={{ fontSize: '0.75rem', overflowX: 'auto', m: 0 }}>
                                      {log.before ? JSON.stringify(log.before, null, 2) : '–'}
                                    </Box>
                                  </Box>
                                  <Box sx={{ minWidth: 240 }}>
                                    <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">Utána</Typography>
                                    <Box component="pre" sx={{ fontSize: '0.75rem', overflowX: 'auto', m: 0 }}>
                                      {log.after ? JSON.stringify(log.after, null, 2) : '–'}
                                    </Box>
                                  </Box>
                                </Stack>
                              ) : (
                                <FieldDiff before={log.before} after={log.after} />
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <EmptyState title="Nincs naplóbejegyzés" description="A jelenlegi szűrésnek megfelelő időszakban nem történt rögzített művelet." />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {lastPage > 1 && (
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
          <Typography variant="body2" color="text.secondary">{total} bejegyzés összesen</Typography>
          <Pagination count={lastPage} page={page} onChange={(_, value) => setPage(value)} color="primary" />
        </Stack>
      )}
    </Box>
  );
}
