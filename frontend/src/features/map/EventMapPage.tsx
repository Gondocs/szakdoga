import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import { Box, Typography, Stack, Paper, Button, CircularProgress, Alert } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { toast } from 'react-toastify';
import 'leaflet/dist/leaflet.css';
import { busIcon, shelterIcon } from '../../lib/leafletIcons';
import type { ShelterWithRisk } from '../../types';
import {
  fetchPersonMunicipalitySummary,
  fetchShelters,
  fetchTransports,
  simulateTransportPosition,
  type MunicipalityPersonSummary,
  type Transport,
} from '../../lib/api/endpoints';

const GYMS_CENTER: [number, number] = [47.75, 17.35];

export function EventMapPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [shelters, setShelters] = useState<ShelterWithRisk[]>([]);
  const [transports, setTransports] = useState<Transport[]>([]);
  const [municipalitySummary, setMunicipalitySummary] = useState<MunicipalityPersonSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [simulatingId, setSimulatingId] = useState<string | null>(null);

  function load() {
    if (!eventId) return;
    setIsLoading(true);
    Promise.all([fetchShelters(eventId), fetchTransports(eventId), fetchPersonMunicipalitySummary(eventId)])
      .then(([shelterList, transportList, summary]) => {
        setShelters(shelterList);
        setTransports(transportList);
        setMunicipalitySummary(summary);
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [eventId]);

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

      <Paper variant="outlined" sx={{ overflow: 'hidden', height: { xs: 420, sm: 560 } }}>
        <MapContainer center={GYMS_CENTER} zoom={9} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> közreműködők'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {municipalitySummary.map((m) => (
            <CircleMarker
              key={m.municipality_id}
              center={[m.lat, m.lng]}
              radius={Math.min(10 + Math.sqrt(m.person_count) * 4, 40)}
              pathOptions={{ color: '#a3172b', fillColor: '#a3172b', fillOpacity: 0.35, weight: 1 }}
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
        </MapContainer>
      </Paper>

      {shelterMarkers.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Egyik hozzárendelt befogadóhely településéhez sincs rögzítve koordináta.
        </Typography>
      )}
    </Box>
  );
}
