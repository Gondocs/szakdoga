import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  TextField,
  MenuItem,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import SearchIcon from '@mui/icons-material/Search';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { busIcon } from '../../lib/leafletIcons';
import { toast } from 'react-toastify';
import type { Person } from '../../types';
import {
  alightTransport,
  boardTransport,
  createTransport,
  deleteTransport,
  fetchTransportPassengers,
  fetchTransports,
  fetchVehicles,
  importTransportManifest,
  resolveQrToken,
  simulateTransportPosition,
  updateTransport,
  type Transport,
  type Vehicle,
} from '../../lib/api/endpoints';
import { specialNeedCategoryLabels } from '../../constants/specialNeeds';
import { SpecialNeedIcon } from '../../components/ui/SpecialNeedIcon';
import { useAuth } from '../auth/AuthContext';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { QrScannerDialog } from '../../components/QrScannerDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { EventSubNav } from '../../components/layout/EventSubNav';

function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export function TransportPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuth();
  const canManage = user?.role?.code === 'admin' || user?.role?.code === 'manager';

  const [transports, setTransports] = useState<Transport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTransport, setEditTransport] = useState<Transport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transport | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [publicId, setPublicId] = useState('');
  const [previewPerson, setPreviewPerson] = useState<Person | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [passengers, setPassengers] = useState<Person[]>([]);
  const [isLoadingPassengers, setIsLoadingPassengers] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [detailsPerson, setDetailsPerson] = useState<Person | null>(null);

  function load() {
    if (!eventId) return;
    setIsLoading(true);
    fetchTransports(eventId)
      .then((list) => {
        setTransports(list);
        setSelectedId((current) => current || list[0]?.id || '');
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [eventId]);

  function loadPassengers(transportId: string) {
    setIsLoadingPassengers(true);
    fetchTransportPassengers(transportId)
      .then(setPassengers)
      .catch(() => setPassengers([]))
      .finally(() => setIsLoadingPassengers(false));
  }

  useEffect(() => {
    if (selectedId) loadPassengers(selectedId);
    else setPassengers([]);
  }, [selectedId]);

  const selectedTransport = transports.find((t) => t.id === selectedId) ?? null;

  async function handleSimulatePosition(transportId: string) {
    setIsSimulating(true);
    try {
      const updated = await simulateTransportPosition(transportId);
      setTransports((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(apiMessage ?? 'A pozíció szimulálása nem sikerült.');
    } finally {
      setIsSimulating(false);
    }
  }

  async function handleLookup(overridePublicId?: string) {
    const idToLookup = (overridePublicId ?? publicId).trim();
    if (!idToLookup) return;
    setPreviewPerson(null);
    setIsBusy(true);
    try {
      const person = await resolveQrToken(idToLookup);
      setPublicId(idToLookup);
      setPreviewPerson(person);

      if (person.special_needs && person.special_needs.length > 0) {
        const labels = [...new Set(person.special_needs.map((n) => specialNeedCategoryLabels[n.category] ?? n.category))];
        toast.warning(`Figyelem: ${person.full_name} egyedi igénnyel rendelkezik — ${labels.join(', ')}.`, { autoClose: 8000 });
      }
    } catch {
      toast.error('A kód nem található vagy hibás.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleBoard(overrideCapacity = false) {
    if (!selectedTransport) return;
    setIsBusy(true);
    try {
      await boardTransport(selectedTransport.id, publicId.trim(), overrideCapacity);
      toast.success(`${previewPerson?.full_name ?? 'A személy'} felszállása rögzítve.`);
      setPreviewPerson(null);
      setPublicId('');
      load();
      loadPassengers(selectedTransport.id);
    } catch (err: unknown) {
      const apiCode = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (apiCode === 'TRANSPORT_OVERCAPACITY') {
        toast.warning(
          <Stack spacing={1}>
            <span>{apiMessage}</span>
            <Button size="small" variant="outlined" color="warning" onClick={() => handleBoard(true)}>
              Mégis felszállítom
            </Button>
          </Stack>,
          { autoClose: false }
        );
      } else {
        toast.error(apiMessage ?? 'A felszállás rögzítése nem sikerült.');
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAlight() {
    if (!selectedTransport) return;
    setIsBusy(true);
    try {
      await alightTransport(selectedTransport.id, publicId.trim());
      toast.success(`${previewPerson?.full_name ?? 'A személy'} leszállása rögzítve.`);
      setPreviewPerson(null);
      setPublicId('');
      load();
      loadPassengers(selectedTransport.id);
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(apiMessage ?? 'A leszállás rögzítése nem sikerült.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleImportManifest(file: File) {
    if (!selectedTransport) return;
    setIsImporting(true);
    try {
      const result = await importTransportManifest(selectedTransport.id, file);
      const parts = [`${result.boarded_count} fő felszállítva`];
      if (result.already_onboard.length > 0) parts.push(`${result.already_onboard.length} már fedélzeten volt`);
      if (result.not_found.length > 0) parts.push(`${result.not_found.length} okmányszám nem található`);
      if (result.capacity_exceeded.length > 0) parts.push(`${result.capacity_exceeded.length} a kapacitás miatt kimaradt`);
      toast.success(parts.join(', ') + '.');
      if (result.not_found.length > 0) {
        toast.warning(`Nem található okmányszámok: ${result.not_found.join(', ')}`, { autoClose: 10000 });
      }
      if (result.capacity_exceeded.length > 0) {
        toast.warning(`A kapacitás miatt kimaradt okmányszámok: ${result.capacity_exceeded.join(', ')}`, { autoClose: 10000 });
      }
      load();
      loadPassengers(selectedTransport.id);
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(apiMessage ?? 'Az utaslista importálása nem sikerült.');
    } finally {
      setIsImporting(false);
    }
  }

  async function handleDeleteTransport() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteTransport(deleteTarget.id);
      toast.success('Jármű törölve.');
      setDeleteTarget(null);
      if (selectedId === deleteTarget.id) setSelectedId('');
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
      {eventId && <EventSubNav eventId={eventId} />}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5} sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Szállítás nyomon követése</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Új jármű
        </Button>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
        <Stack spacing={1.5} sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0 }}>
          {transports.map((t) => (
            <Paper
              key={t.id}
              variant="outlined"
              sx={{
                p: 2,
                cursor: 'pointer',
                borderColor: t.id === selectedId ? 'primary.main' : undefined,
                borderWidth: t.id === selectedId ? 2 : 1,
              }}
              onClick={() => setSelectedId(t.id)}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <DirectionsBusIcon color="secondary" />
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={700}>{t.code}</Typography>
                  {t.vehicle && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t.vehicle.label} ({t.vehicle.plate_number})
                    </Typography>
                  )}
                  {(t.origin || t.destination) && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t.origin ?? '–'} → {t.destination ?? '–'}
                    </Typography>
                  )}
                  {t.escort_name && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Kísérő: {t.escort_name}
                    </Typography>
                  )}
                  {!!t.delay_minutes && (
                    <Typography variant="caption" color="warning.main" display="block">
                      Késés: {t.delay_minutes} perc{t.route_change_note ? ` — ${t.route_change_note}` : ''}
                    </Typography>
                  )}
                  <Typography
                    variant="body2"
                    color={t.capacity && t.onboard_count >= t.capacity ? 'warning.main' : 'text.secondary'}
                  >
                    Fedélzeten: {t.onboard_count}{t.capacity ? ` / ${t.capacity}` : ''} fő
                  </Typography>
                </Box>
                {canManage && (
                  <Stack direction="row" spacing={0} onClick={(e) => e.stopPropagation()}>
                    <IconButton size="small" onClick={() => setEditTransport(t)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(t)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                )}
              </Stack>
            </Paper>
          ))}
          {transports.length === 0 && (
            <EmptyState title="Még nincs felvéve szállítóeszköz ehhez az eseményhez" />
          )}
        </Stack>

        {selectedTransport && (
          <Paper variant="outlined" sx={{ p: 3, flex: 1, width: '100%' }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6" fontWeight={700}>{selectedTransport.code}</Typography>
              <Chip size="small" label={`${selectedTransport.onboard_count} fő a fedélzeten`} />
            </Stack>

            <Box sx={{ mb: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>Jelenlegi pozíció</Typography>
                <Button
                  size="small"
                  startIcon={<RefreshIcon fontSize="small" />}
                  disabled={isSimulating}
                  onClick={() => handleSimulatePosition(selectedTransport.id)}
                >
                  Pozíció szimulálása
                </Button>
              </Stack>
              {selectedTransport.last_lat !== null && selectedTransport.last_lng !== null ? (
                <Paper variant="outlined" sx={{ overflow: 'hidden', height: 240 }}>
                  <MapContainer
                    center={[selectedTransport.last_lat, selectedTransport.last_lng]}
                    zoom={12}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> közreműködők'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapRecenter lat={selectedTransport.last_lat} lng={selectedTransport.last_lng} />
                    <Marker position={[selectedTransport.last_lat, selectedTransport.last_lng]} icon={busIcon}>
                      <Popup>
                        <strong>{selectedTransport.code}</strong>
                        <br />
                        Utolsó pozíció: {selectedTransport.last_position_at ? new Date(selectedTransport.last_position_at).toLocaleTimeString('hu-HU') : '–'}
                      </Popup>
                    </Marker>
                  </MapContainer>
                </Paper>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Nincs még rögzített pozíció ehhez a járműhöz. Kattintson a "Pozíció szimulálása" gombra.
                </Typography>
              )}
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Jelenleg a fedélzeten</Typography>
              {isLoadingPassengers ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={24} /></Box>
              ) : passengers.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Jelenleg senki nincs felszállva erre a járműre.</Typography>
              ) : (
                <List dense sx={{ maxHeight: 260, overflowY: 'auto', bgcolor: 'action.hover', borderRadius: 1 }}>
                  {passengers.map((p) => (
                    <ListItemButton key={p.id} onClick={() => setDetailsPerson(p)}>
                      <ListItemText
                        primary={p.full_name}
                        secondary={p.municipality?.name ?? '–'}
                      />
                      {[...new Set((p.special_needs ?? []).map((n) => n.category))].map((cat) => (
                        <SpecialNeedIcon key={cat} category={cat} fontSize="small" color="secondary" />
                      ))}
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Box>

            <Stack spacing={3}>
              <Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    label="QR-kód azonosító (kézi bevitel is elfogadott)"
                    value={publicId}
                    onChange={(e) => setPublicId(e.target.value)}
                    placeholder="Illessze be vagy írja be az azonosítót"
                    fullWidth
                  />
                  <Button variant="outlined" onClick={() => handleLookup()} disabled={isBusy || !publicId} startIcon={<SearchIcon />} sx={{ flexShrink: 0 }}>
                    Keresés
                  </Button>
                  <Button variant="outlined" onClick={() => setScannerOpen(true)} disabled={isBusy} startIcon={<QrCodeScannerIcon />} sx={{ flexShrink: 0 }}>
                    Kamera
                  </Button>
                </Stack>
              </Box>

              <QrScannerDialog
                open={scannerOpen}
                onClose={() => setScannerOpen(false)}
                onDetected={(value) => {
                  setScannerOpen(false);
                  handleLookup(value);
                }}
              />

              <Box>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<UploadFileIcon />}
                  disabled={isImporting}
                >
                  {isImporting ? 'Importálás…' : 'Szervezett utaslista importálása (CSV)'}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) handleImportManifest(file);
                    }}
                  />
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  A CSV első oszlopában szereplő okmányszámok alapján tömegesen felszállítja az előre
                  regisztrált, egyező személyeket erre a járműre — nem kell egyenként beszkennelni a
                  QR-kódjukat.
                </Typography>
              </Box>

              {previewPerson && (
                <Alert severity={previewPerson.special_needs && previewPerson.special_needs.length > 0 ? 'warning' : 'info'} icon={false}>
                  <Stack spacing={1}>
                    <Typography fontWeight={700}>{previewPerson.full_name}</Typography>
                    <Typography variant="body2">Település: {previewPerson.municipality?.name ?? '–'}</Typography>
                    <Typography variant="body2">Státusz: {previewPerson.registration?.status ?? '–'}</Typography>
                    {previewPerson.special_needs && previewPerson.special_needs.length > 0 && (
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {previewPerson.special_needs.map((n) => (
                          <Chip
                            key={n.id}
                            icon={<SpecialNeedIcon category={n.category} fontSize="small" />}
                            label={specialNeedCategoryLabels[n.category] ?? n.category}
                            size="small"
                            color="warning"
                          />
                        ))}
                      </Stack>
                    )}
                    <Divider />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button
                        variant="contained"
                        color="success"
                        startIcon={<LoginIcon />}
                        onClick={() => handleBoard()}
                        disabled={isBusy}
                      >
                        Felszállás rögzítése
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<LogoutIcon />}
                        onClick={handleAlight}
                        disabled={isBusy}
                      >
                        Leszállás rögzítése
                      </Button>
                    </Stack>
                  </Stack>
                </Alert>
              )}
            </Stack>
          </Paper>
        )}
      </Stack>

      {createOpen && (
        <TransportFormDialog
          eventId={eventId!}
          onClose={() => setCreateOpen(false)}
          onSaved={(transport) => {
            setCreateOpen(false);
            setTransports((prev) => [...prev, transport]);
            setSelectedId(transport.id);
          }}
        />
      )}

      {editTransport && (
        <TransportFormDialog
          eventId={eventId!}
          transport={editTransport}
          onClose={() => setEditTransport(null)}
          onSaved={(transport) => {
            setEditTransport(null);
            setTransports((prev) => prev.map((t) => (t.id === transport.id ? transport : t)));
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Jármű törlése"
        description={`Biztosan törli a(z) "${deleteTarget?.code}" járművet? A törlés csak akkor sikeres, ha jelenleg senki nincs a fedélzetén.`}
        confirmLabel="Törlés"
        severity="error"
        isSubmitting={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteTransport}
      />

      <Dialog open={!!detailsPerson} onClose={() => setDetailsPerson(null)} fullWidth maxWidth="xs">
        <DialogTitle>Utas adatai</DialogTitle>
        <DialogContent>
          {detailsPerson && (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Typography variant="h6" fontWeight={700}>{detailsPerson.full_name}</Typography>
              <Typography variant="body2">Település: {detailsPerson.municipality?.name ?? '–'}</Typography>
              <Typography variant="body2">Telefon: {detailsPerson.phone ?? '–'}</Typography>
              <Typography variant="body2">Státusz: {detailsPerson.registration?.status ?? '–'}</Typography>
              {detailsPerson.special_needs && detailsPerson.special_needs.length > 0 && (
                <Box>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>Egyedi igények:</Typography>
                  <Stack spacing={0.5}>
                    {detailsPerson.special_needs.map((n) => (
                      <Stack key={n.id} direction="row" spacing={1} alignItems="center">
                        <SpecialNeedIcon category={n.category} fontSize="small" color="secondary" />
                        <Typography variant="body2">
                          {specialNeedCategoryLabels[n.category] ?? n.category}
                          {n.description ? ` — ${n.description}` : ''}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsPerson(null)}>Bezárás</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function TransportFormDialog({
  eventId,
  transport,
  onClose,
  onSaved,
}: {
  eventId: string;
  transport?: Transport;
  onClose: () => void;
  onSaved: (transport: Transport) => void;
}) {
  const [code, setCode] = useState(transport?.code ?? '');
  const [capacity, setCapacity] = useState(transport?.capacity ? String(transport.capacity) : '');
  const [vehicleId, setVehicleId] = useState(transport?.vehicle?.id ?? '');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [origin, setOrigin] = useState(transport?.origin ?? '');
  const [destination, setDestination] = useState(transport?.destination ?? '');
  const [escortName, setEscortName] = useState(transport?.escort_name ?? '');
  const [departurePlannedAt, setDeparturePlannedAt] = useState<Date | null>(
    transport?.departure_planned_at ? new Date(transport.departure_planned_at) : null
  );
  const [arrivalPlannedAt, setArrivalPlannedAt] = useState<Date | null>(
    transport?.arrival_planned_at ? new Date(transport.arrival_planned_at) : null
  );
  const [delayMinutes, setDelayMinutes] = useState(transport?.delay_minutes ? String(transport.delay_minutes) : '');
  const [routeChangeNote, setRouteChangeNote] = useState(transport?.route_change_note ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchVehicles().then(setVehicles).catch(() => setVehicles([]));
  }, []);

  function handleSelectVehicle(id: string) {
    setVehicleId(id);
    const vehicle = vehicles.find((v) => v.id === id);
    if (vehicle) {
      if (!code.trim()) setCode(`${vehicle.label} (${vehicle.plate_number})`);
      if (!capacity && vehicle.capacity) setCapacity(String(vehicle.capacity));
    }
  }

  async function handleSubmit() {
    if (!code.trim()) return;
    setIsSubmitting(true);
    try {
      const payload = {
        code: code.trim(),
        capacity: capacity ? Number(capacity) : undefined,
        vehicle_id: vehicleId || null,
        origin: origin.trim() || undefined,
        destination: destination.trim() || undefined,
        escort_name: escortName.trim() || undefined,
        departure_planned_at: departurePlannedAt ? departurePlannedAt.toISOString() : undefined,
        arrival_planned_at: arrivalPlannedAt ? arrivalPlannedAt.toISOString() : undefined,
        delay_minutes: delayMinutes ? Number(delayMinutes) : undefined,
        route_change_note: routeChangeNote.trim() || undefined,
      };
      const saved = transport ? await updateTransport(transport.id, payload) : await createTransport(eventId, payload);
      toast.success(transport ? 'Jármű frissítve.' : 'Jármű felvéve.');
      onSaved(saved);
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(apiMessage ?? 'A jármű mentése nem sikerült.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{transport ? 'Szállítóeszköz szerkesztése' : 'Új szállítóeszköz'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label="Flottajármű hozzárendelése (opcionális)"
            fullWidth
            value={vehicleId}
            onChange={(e) => handleSelectVehicle(e.target.value)}
          >
            <MenuItem value="">Nincs (kézi bevitel)</MenuItem>
            {vehicles.map((v) => {
              const inUseElsewhere = v.active_assignment && v.active_assignment.transport_id !== transport?.id;
              return (
                <MenuItem key={v.id} value={v.id} disabled={!!inUseElsewhere}>
                  {v.label} ({v.plate_number}){inUseElsewhere ? ` — foglalt: ${v.active_assignment?.event_name}` : ''}
                </MenuItem>
              );
            })}
          </TextField>
          <TextField label="Megnevezés" placeholder="pl. 1. sz. busz - Győr" required fullWidth value={code} onChange={(e) => setCode(e.target.value)} />
          <TextField label="Kapacitás (opcionális)" type="number" fullWidth value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          <TextField label="Indulási pont (opcionális)" fullWidth value={origin} onChange={(e) => setOrigin(e.target.value)} />
          <TextField label="Célállomás (opcionális)" fullWidth value={destination} onChange={(e) => setDestination(e.target.value)} />
          <TextField label="Kísérő neve (opcionális)" fullWidth value={escortName} onChange={(e) => setEscortName(e.target.value)} />
          <DateTimePicker
            label="Tervezett indulás (opcionális)"
            value={departurePlannedAt}
            onChange={setDeparturePlannedAt}
            ampm={false}
            format="yyyy.MM.dd HH:mm"
            slotProps={{ textField: { fullWidth: true } }}
          />
          <DateTimePicker
            label="Tervezett érkezés (opcionális)"
            value={arrivalPlannedAt}
            onChange={setArrivalPlannedAt}
            ampm={false}
            format="yyyy.MM.dd HH:mm"
            slotProps={{ textField: { fullWidth: true } }}
          />
          <TextField
            label="Késés percben (opcionális)"
            type="number"
            fullWidth
            value={delayMinutes}
            onChange={(e) => setDelayMinutes(e.target.value)}
          />
          <TextField
            label="Útvonalváltozás megjegyzés (opcionális)"
            fullWidth
            value={routeChangeNote}
            onChange={(e) => setRouteChangeNote(e.target.value)}
          />
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
