import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Button,
  CircularProgress,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
} from '@mui/material';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import GroupsIcon from '@mui/icons-material/Groups';
import HomeIcon from '@mui/icons-material/Home';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import HotelIcon from '@mui/icons-material/Hotel';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LinkIcon from '@mui/icons-material/Link';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { toast } from 'react-toastify';
import type { DashboardData, EvacuationEvent, Shelter, SpecialNeedCategory } from '../../types';
import {
  fetchAllShelters,
  fetchDashboard,
  fetchEvent,
  fetchStockForecast,
  summaryReportExportUrl,
  updateEvent,
  type StockForecastData,
} from '../../lib/api/endpoints';
import { ErrorState } from '../../components/ui/ErrorState';
import { KpiCard } from '../../components/ui/KpiCard';
import { RiskBadge } from '../../components/ui/RiskBadge';
import { EventStatusBadge } from '../events/EventStatusBadge';
import { useAuth } from '../auth/AuthContext';
import { specialNeedCategoryLabels } from '../../constants/specialNeeds';
import { SpecialNeedIcon } from '../../components/ui/SpecialNeedIcon';
import { DashboardCharts } from './DashboardCharts';

export function EventDashboardPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [event, setEvent] = useState<EvacuationEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [stockForecast, setStockForecast] = useState<StockForecastData | null>(null);

  const canEditEvent = user?.role?.code === 'admin' || user?.role?.code === 'manager';

  function reload() {
    if (!eventId) return;
    fetchDashboard(eventId).then(setData).catch(() => setError('A dashboard adatok betöltése nem sikerült (lehet, hogy nincs jogosultsága).'));
    fetchEvent(eventId).then(setEvent).catch(() => setEvent(null));
    fetchStockForecast(eventId).then(setStockForecast).catch(() => setStockForecast(null));
  }

  useEffect(() => {
    setIsLoading(true);
    reload();
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    const interval = setInterval(() => {
      fetchDashboard(eventId).then(setData).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [eventId]);

  const selfRegisterUrl = event ? `${window.location.origin}/onkiszolgalo/${event.code}` : '';

  function handleCopyLink() {
    if (!selfRegisterUrl) return;
    navigator.clipboard.writeText(selfRegisterUrl);
    toast.info('Előregisztrációs link a vágólapra másolva.');
  }

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  if (error) return <ErrorState message={error} />;
  if (!data || !eventId) return null;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Typography variant="h4" fontWeight={700}>{event ? event.name : 'Esemény dashboard'}</Typography>
        {event && <EventStatusBadge status={event.status} />}
        {canEditEvent && (
          <Tooltip title="Esemény szerkesztése">
            <IconButton size="small" onClick={() => setEditOpen(true)}><EditIcon fontSize="small" /></IconButton>
          </Tooltip>
        )}
      </Stack>

      <Paper variant="outlined" sx={{ p: 1.5, mb: 3 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
          {canEditEvent && (
            <Button
              size="small"
              variant="text"
              color="inherit"
              startIcon={<DownloadIcon />}
              component="a"
              href={summaryReportExportUrl(eventId!)}
              target="_blank"
              rel="noopener"
            >
              Összesítő jelentés
            </Button>
          )}
          <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => navigate(`/esemenyek/${eventId}/uj-regisztracio`)}>
            Új regisztráció
          </Button>
          <Button variant="contained" size="small" startIcon={<QrCodeScannerIcon />} onClick={() => navigate(`/esemenyek/${eventId}/erkeztetes`)}>
            QR érkeztetés
          </Button>
        </Stack>
      </Paper>

      {event && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <LinkIcon fontSize="small" color="secondary" />
            <Typography variant="subtitle2" fontWeight={700}>Lakossági önkiszolgáló előregisztrációs link</Typography>
          </Stack>
          <TextField
            value={selfRegisterUrl}
            size="small"
            fullWidth
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title="Másolás">
                    <IconButton onClick={handleCopyLink} edge="end"><ContentCopyIcon fontSize="small" /></IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Ossza meg ezt a linket a lakossággal (pl. közérdekű közlemény, önkormányzati honlap), hogy még a
            kitelepítés helyszíni megkezdése előtt regisztrálhassanak és QR-kódot kapjanak.
          </Typography>
        </Paper>
      )}

      <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mb: 3 }}>
        <KpiCard
          label="Regisztráltak"
          value={data.registered_count}
          icon={<PeopleAltIcon fontSize="small" />}
          onClick={() => navigate(`/esemenyek/${eventId}/szemelyek`)}
        />
        <KpiCard
          label="Családok"
          value={data.families_count}
          icon={<GroupsIcon fontSize="small" />}
          onClick={() => navigate(`/esemenyek/${eventId}/csaladok`)}
        />
        <KpiCard
          label="Érkezettek"
          value={data.arrived_count}
          icon={<HomeIcon fontSize="small" />}
          onClick={() => navigate(`/esemenyek/${eventId}/szemelyek?status=arrived_shelter`)}
        />
        <KpiCard
          label="Központi szállítást igényel"
          value={data.central_transport_required_count}
          icon={<DirectionsBusIcon fontSize="small" />}
          onClick={() => navigate(`/esemenyek/${eventId}/szemelyek?central_transport_required=1`)}
        />
        <KpiCard
          label="Elszállásolást igényel"
          value={data.central_accommodation_required_count}
          icon={<HotelIcon fontSize="small" />}
          onClick={() => navigate(`/esemenyek/${eventId}/szemelyek?central_accommodation_required=1`)}
        />
        <KpiCard
          label="Hiányzók"
          value={data.status_breakdown.missing ?? 0}
          icon={<WarningAmberIcon fontSize="small" />}
          onClick={() => navigate(`/esemenyek/${eventId}/szemelyek?status=missing`)}
        />
      </Stack>

      <DashboardCharts data={data} eventId={eventId} />

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Befogadóhelyi kapacitások</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Kattintson egy sorra az ott tartózkodók listázásához.</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Befogadóhely</TableCell>
                <TableCell>Foglalt / Kapacitás</TableCell>
                <TableCell>Telítettség</TableCell>
                <TableCell>Kockázat</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.shelters.map((s) => (
                <TableRow
                  key={s.shelter_id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/esemenyek/${eventId}/szemelyek?shelter_id=${s.shelter_id}`)}
                >
                  <TableCell>{s.shelter_name}</TableCell>
                  <TableCell>{s.checked_in_count} / {s.capacity_limit}</TableCell>
                  <TableCell>{Math.round(s.utilization * 100)}%</TableCell>
                  <TableCell><RiskBadge level={s.risk_level} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {stockForecast && (
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Napi készletigény-előrejelzés</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            A jelenleg befogadóhelyen tartózkodók száma és egyedi igényei alapján becsült napi szükséglet.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Kattintson egy mutatóra vagy táblázatsorra az érintettek listázásához.
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mb: 2 }}>
            <KpiCard
              label="Étkezési adag / nap"
              value={stockForecast.totals.meal_portions_per_day}
              icon={<PeopleAltIcon fontSize="small" />}
              onClick={() => navigate(`/esemenyek/${eventId}/szemelyek?status=arrived_shelter`)}
            />
            <KpiCard
              label="Ebből speciális diéta"
              value={stockForecast.totals.special_diet_portions_per_day}
              icon={<PeopleAltIcon fontSize="small" />}
              onClick={() => navigate(`/esemenyek/${eventId}/szemelyek?special_need_category=diet`)}
            />
            <KpiCard
              label="Takaró"
              value={stockForecast.totals.blankets_needed}
              icon={<HotelIcon fontSize="small" />}
              onClick={() => navigate(`/esemenyek/${eventId}/szemelyek?status=arrived_shelter`)}
            />
            <KpiCard
              label="Matrac"
              value={stockForecast.totals.mattresses_needed}
              icon={<HotelIcon fontSize="small" />}
              onClick={() => navigate(`/esemenyek/${eventId}/szemelyek?status=arrived_shelter`)}
            />
            <KpiCard
              label="Gyógyszerre szoruló"
              value={stockForecast.totals.medicine_needed_count}
              icon={<WarningAmberIcon fontSize="small" />}
              onClick={() => navigate(`/esemenyek/${eventId}/szemelyek?special_need_category=medical`)}
            />
          </Stack>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Befogadóhely</TableCell>
                  <TableCell>Létszám</TableCell>
                  <TableCell>Étkezési adag/nap</TableCell>
                  <TableCell>Speciális diéta/nap</TableCell>
                  <TableCell>Takaró</TableCell>
                  <TableCell>Matrac</TableCell>
                  <TableCell>Gyógyszerre szoruló</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stockForecast.by_shelter.map((row) => (
                  <TableRow
                    key={row.shelter_id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/esemenyek/${eventId}/szemelyek?shelter_id=${row.shelter_id}`)}
                  >
                    <TableCell>{row.shelter_name}</TableCell>
                    <TableCell>{row.checked_in_count}</TableCell>
                    <TableCell>{row.meal_portions_per_day}</TableCell>
                    <TableCell
                      sx={row.special_diet_portions_per_day > 0 ? { textDecoration: 'underline', textDecorationStyle: 'dotted' } : undefined}
                      onClick={(e) => {
                        if (row.special_diet_portions_per_day === 0) return;
                        e.stopPropagation();
                        navigate(`/esemenyek/${eventId}/szemelyek?shelter_id=${row.shelter_id}&special_need_category=diet`);
                      }}
                    >
                      {row.special_diet_portions_per_day}
                    </TableCell>
                    <TableCell>{row.blankets_needed}</TableCell>
                    <TableCell>{row.mattresses_needed}</TableCell>
                    <TableCell
                      sx={row.medicine_needed_count > 0 ? { textDecoration: 'underline', textDecorationStyle: 'dotted' } : undefined}
                      onClick={(e) => {
                        if (row.medicine_needed_count === 0) return;
                        e.stopPropagation();
                        navigate(`/esemenyek/${eventId}/szemelyek?shelter_id=${row.shelter_id}&special_need_category=medical`);
                      }}
                    >
                      {row.medicine_needed_count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Speciális igények kategóriánként</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Kattintson egy kategóriára az érintettek listázásához.</Typography>
        <Stack direction="row" flexWrap="wrap" gap={2}>
          {Object.entries(data.special_needs_by_category).map(([category, count]) => (
            <KpiCard
              key={category}
              label={specialNeedCategoryLabels[category as SpecialNeedCategory] ?? category}
              value={count}
              icon={<SpecialNeedIcon category={category as SpecialNeedCategory} fontSize="small" />}
              onClick={() => navigate(`/esemenyek/${eventId}/szemelyek?special_need_category=${category}`)}
            />
          ))}
        </Stack>
      </Paper>

      {editOpen && event && (
        <EditEventDialog
          event={event}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            reload();
          }}
        />
      )}
    </Box>
  );
}

function EditEventDialog({ event, onClose, onSaved }: { event: EvacuationEvent; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(event.name);
  const [status, setStatus] = useState<EvacuationEvent['status']>(event.status);
  const [shelterRows, setShelterRows] = useState(
    (event.shelters ?? []).map((s) => ({ shelter_id: s.shelter_id, name: s.shelter_name, capacity_limit: s.capacity_limit }))
  );
  const [allShelters, setAllShelters] = useState<Shelter[]>([]);
  const [newShelterId, setNewShelterId] = useState('');
  const [newCapacity, setNewCapacity] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchAllShelters().then(setAllShelters).catch(() => setAllShelters([]));
  }, []);

  function handleSelectNewShelter(shelterId: string) {
    setNewShelterId(shelterId);
    const shelter = allShelters.find((s) => s.id === shelterId);
    if (shelter) {
      setNewCapacity(shelter.capacity_total);
    }
  }

  function addShelterRow() {
    if (!newShelterId) return;
    const shelter = allShelters.find((s) => s.id === newShelterId);
    if (!shelter) return;
    if (shelterRows.some((r) => r.shelter_id === newShelterId)) {
      toast.warning('Ez a befogadóhely már hozzá van rendelve.');
      return;
    }
    setShelterRows((rows) => [...rows, { shelter_id: shelter.id, name: shelter.name, capacity_limit: newCapacity }]);
    setNewShelterId('');
    setNewCapacity(50);
  }

  function removeShelterRow(shelterId: string) {
    setShelterRows((rows) => rows.filter((r) => r.shelter_id !== shelterId));
  }

  function updateCapacity(shelterId: string, capacity: number) {
    setShelterRows((rows) => rows.map((r) => (r.shelter_id === shelterId ? { ...r, capacity_limit: capacity } : r)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateEvent(event.id, {
        name,
        status,
        shelters: shelterRows.map((r) => ({ shelter_id: r.shelter_id, capacity_limit: r.capacity_limit })),
      });
      toast.success('Esemény frissítve.');
      onSaved();
    } catch {
      toast.error('A mentés nem sikerült.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const availableShelters = allShelters.filter((s) => !shelterRows.some((r) => r.shelter_id === s.id));

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>Esemény szerkesztése</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Esemény neve" required fullWidth value={name} onChange={(e) => setName(e.target.value)} />
            <TextField select label="Státusz" required fullWidth value={status} onChange={(e) => setStatus(e.target.value as EvacuationEvent['status'])}>
              <MenuItem value="draft">Tervezet</MenuItem>
              <MenuItem value="active">Aktív</MenuItem>
              <MenuItem value="paused">Szüneteltetve</MenuItem>
              <MenuItem value="closed">Lezárva</MenuItem>
            </TextField>

            <Typography variant="subtitle2" fontWeight={700}>Befogadóhelyek és kapacitás</Typography>
            <Stack spacing={1}>
              {shelterRows.map((row) => (
                <Stack key={row.shelter_id} direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" sx={{ flex: 1 }}>{row.name}</Typography>
                  <TextField
                    type="number"
                    size="small"
                    value={row.capacity_limit}
                    onChange={(e) => updateCapacity(row.shelter_id, Number(e.target.value))}
                    sx={{ width: 100 }}
                  />
                  <IconButton size="small" color="error" onClick={() => removeShelterRow(row.shelter_id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <TextField select label="Új befogadóhely" size="small" fullWidth value={newShelterId} onChange={(e) => handleSelectNewShelter(e.target.value)}>
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
            {isSubmitting ? 'Mentés…' : 'Mentés'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
