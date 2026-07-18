import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMapEvents } from 'react-leaflet';
import {
  Box,
  Typography,
  Stack,
  Paper,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { toast } from 'react-toastify';
import 'leaflet/dist/leaflet.css';
import { assemblyPointIcon, busIcon, shelterIcon } from '../../lib/leafletIcons';
import type { AssemblyPoint, ShelterWithRisk, TransportPositionUpdatedPayload } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { connectEcho } from '../../lib/echo';
import {
  createAssemblyPoint,
  deleteAssemblyPoint,
  fetchAssemblyPoints,
  fetchPersonMunicipalitySummary,
  fetchShelters,
  fetchTransports,
  simulateTransportPosition,
  updateAssemblyPoint,
  type MunicipalityPersonSummary,
  type Transport,
} from '../../lib/api/endpoints';

const GYMS_CENTER: [number, number] = [47.75, 17.35];

export function EventMapPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManageAssemblyPoints = user?.role?.code === 'admin' || user?.role?.code === 'manager';
  const [shelters, setShelters] = useState<ShelterWithRisk[]>([]);
  const [transports, setTransports] = useState<Transport[]>([]);
  const [municipalitySummary, setMunicipalitySummary] = useState<MunicipalityPersonSummary[]>([]);
  const [assemblyPoints, setAssemblyPoints] = useState<AssemblyPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [simulatingId, setSimulatingId] = useState<string | null>(null);
  const [isPlacingPoint, setIsPlacingPoint] = useState(false);
  const [editingPoint, setEditingPoint] = useState<AssemblyPoint | 'new' | null>(null);
  const [draftCoords, setDraftCoords] = useState<{ lat: number; lng: number } | null>(null);

  function load() {
    if (!eventId) return;
    setIsLoading(true);
    Promise.all([
      fetchShelters(eventId),
      fetchTransports(eventId),
      fetchPersonMunicipalitySummary(eventId),
      fetchAssemblyPoints(eventId),
    ])
      .then(([shelterList, transportList, summary, assemblyPointList]) => {
        setShelters(shelterList);
        setTransports(transportList);
        setMunicipalitySummary(summary);
        setAssemblyPoints(assemblyPointList);
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [eventId]);

  // A busz-markerek más felhasználó (vagy a Szállítás oldal) által
  // szimulált pozícióváltásra is élőben mozdulnak — a csatorna
  // (event.{id}.updates) élettartamát az EventSubNav birtokolja, itt csak
  // a saját listenert vesszük fel/le.
  useEffect(() => {
    if (!eventId) return;

    const channel = connectEcho().private(`event.${eventId}.updates`);
    channel.listen('.transport.position.updated', (payload: TransportPositionUpdatedPayload) => {
      setTransports((prev) =>
        prev.map((t) =>
          t.id === payload.transport_id
            ? { ...t, last_lat: payload.last_lat, last_lng: payload.last_lng, last_position_at: payload.last_position_at }
            : t
        )
      );
    });

    return () => {
      channel.stopListening('.transport.position.updated');
    };
  }, [eventId]);

  function handleMapClickForNewPoint(lat: number, lng: number) {
    setIsPlacingPoint(false);
    setDraftCoords({ lat, lng });
    setEditingPoint('new');
  }

  async function handleDeleteAssemblyPoint(point: AssemblyPoint) {
    if (!window.confirm(`Biztosan törli a(z) "${point.name}" gyülekezési pontot?`)) return;
    try {
      await deleteAssemblyPoint(point.id);
      setAssemblyPoints((prev) => prev.filter((p) => p.id !== point.id));
      toast.success('Gyülekezési pont törölve.');
    } catch {
      toast.error('A törlés nem sikerült.');
    }
  }

  async function handleSimulate(transportId: string) {
    setSimulatingId(transportId);
    try {
      const updated = await simulateTransportPosition(transportId);
      setTransports((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(apiMessage ?? 'A pozíció szimulálása nem sikerült.');
    } finally {
      setSimulatingId(null);
    }
  }

  const shelterMarkers = shelters.filter((s) => s.shelter.coordinates);
  const transportMarkers = transports.filter((t) => t.last_lat !== null && t.last_lng !== null);

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>Térképes áttekintés</Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        A befogadóhelyek a település valós koordinátái alapján jelennek meg. Mivel a járművekhez nincs
        valós GPS-integráció bekötve, a szállítóeszközök pozíciója szimulált (a "Pozíció szimulálása"
        gombbal frissíthető) — ez demonstrálja a tanulmányban leírt geografikus nyomon követési koncepciót.
        A regisztrált személyek adatvédelmi okból nem egyedi címükön, hanem lakóhelyük (település)
        szerint, összesítve jelennek meg a térképen.
      </Alert>

      {transports.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Szállítóeszközök pozíciójának frissítése</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {transports.map((t) => (
              <Button
                key={t.id}
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon fontSize="small" />}
                disabled={simulatingId === t.id}
                onClick={() => handleSimulate(t.id)}
              >
                {t.code}
              </Button>
            ))}
          </Stack>
        </Paper>
      )}

      {canManageAssemblyPoints && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
            <Typography variant="subtitle2" fontWeight={700}>Gyülekezési pontok</Typography>
            <Button
              size="small"
              variant={isPlacingPoint ? 'contained' : 'outlined'}
              color={isPlacingPoint ? 'secondary' : 'primary'}
              startIcon={<AddLocationAltIcon fontSize="small" />}
              onClick={() => setIsPlacingPoint((prev) => !prev)}
            >
              {isPlacingPoint ? 'Kattintson a térképre…' : 'Új gyülekezési pont'}
            </Button>
          </Stack>
          {assemblyPoints.length > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
              {assemblyPoints.map((p) => (
                <Paper key={p.id} variant="outlined" sx={{ px: 1.5, py: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2">{p.name}</Typography>
                  <Tooltip title="Szerkesztés">
                    <IconButton size="small" onClick={() => setEditingPoint(p)}>
                      <EditIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Törlés">
                    <IconButton size="small" color="error" onClick={() => handleDeleteAssemblyPoint(p)}>
                      <DeleteIcon fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>
      )}

      <Paper variant="outlined" sx={{ overflow: 'hidden', height: { xs: 420, sm: 560 } }}>
        <MapContainer center={GYMS_CENTER} zoom={9} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> közreműködők'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {isPlacingPoint && <MapClickCatcher onClick={handleMapClickForNewPoint} />}
          {municipalitySummary.map((m) => (
            <CircleMarker
              key={m.municipality_id}
              center={[m.lat, m.lng]}
              // Négyzetgyökös skálázás, hogy a kör területe (és ne csak a
              // sugara) legyen arányos a létszámmal, felső korláttal
              radius={Math.min(6 + Math.sqrt(m.person_count) * 2, 22)}
              pathOptions={{ color: '#a3172b', fillColor: '#a3172b', fillOpacity: 0.3, weight: 1 }}
              eventHandlers={{
                click: () => navigate(`/esemenyek/${eventId}/szemelyek?municipality_id=${m.municipality_id}`),
              }}
            >
              <Popup>
                <strong>{m.name}</strong>
                <br />
                Regisztráltak: {m.person_count} fő
                <br />
                <em>Kattintson a listázáshoz</em>
              </Popup>
            </CircleMarker>
          ))}
          {shelterMarkers.map((s) => (
            <Marker
              key={s.shelter.id}
              position={[s.shelter.coordinates!.lat, s.shelter.coordinates!.lng]}
              icon={shelterIcon}
            >
              <Popup>
                <strong>{s.shelter.name}</strong>
                <br />
                {s.shelter.address}
                <br />
                Foglaltság: {s.checked_in_count} / {s.capacity_limit} ({Math.round(s.utilization * 100)}%)
              </Popup>
            </Marker>
          ))}
          {transportMarkers.map((t) => (
            <Marker key={t.id} position={[t.last_lat!, t.last_lng!]} icon={busIcon}>
              <Popup>
                <strong>{t.code}</strong>
                <br />
                Fedélzeten: {t.onboard_count} fő
                <br />
                Utolsó pozíció: {t.last_position_at ? new Date(t.last_position_at).toLocaleTimeString('hu-HU') : '–'}
              </Popup>
            </Marker>
          ))}
          {assemblyPoints.map((p) => (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={assemblyPointIcon}>
              <Popup>
                <strong>{p.name}</strong>
                <br />
                {p.address}
                {p.notes && (
                  <>
                    <br />
                    {p.notes}
                  </>
                )}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </Paper>

      {shelterMarkers.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Egyik hozzárendelt befogadóhely településéhez sincs rögzítve koordináta.
        </Typography>
      )}

      {editingPoint && eventId && (
        <AssemblyPointDialog
          eventId={eventId}
          point={editingPoint === 'new' ? null : editingPoint}
          initialCoords={draftCoords}
          onClose={() => {
            setEditingPoint(null);
            setDraftCoords(null);
          }}
          onSaved={(saved) => {
            setAssemblyPoints((prev) => {
              const exists = prev.some((p) => p.id === saved.id);
              return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved];
            });
            setEditingPoint(null);
            setDraftCoords(null);
          }}
        />
      )}
    </Box>
  );
}

function MapClickCatcher({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onClick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

function AssemblyPointDialog({
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
      const payload = { name, address: address || null, lat, lng, notes: notes || null };
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
