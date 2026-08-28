import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Box, TextField, MenuItem, Typography, Alert } from '@mui/material';
import 'leaflet/dist/leaflet.css';
import type { AssemblyPoint } from '../../types';
import { assemblyPointIcon } from '../../lib/leafletIcons';

const FALLBACK_CENTER: [number, number] = [47.75, 17.35];

interface AssemblyPointFieldProps {
  assemblyPoints: AssemblyPoint[];
  value: number | '';
  onChange: (id: number | '') => void;
  required?: boolean;
}

/**
 * Gyülekezőpont-választó a regisztrációhoz: a legördülő lista mellett egy
 * kis térkép is megjeleníti a pontokat, hogy a lakos (vagy a regisztrátor)
 * ténylegesen lássa is, melyik gyülekezőhelyre kell mennie. A helyszíni
 * regisztrációs varázsló és az önkiszolgáló előregisztráció közös eleme
 * (lásd FamilyMemberForm), hogy a két felület ne tudjon szétdriftelni.
 */
export function AssemblyPointField({ assemblyPoints, value, onChange, required = true }: AssemblyPointFieldProps) {
  const center = useMemo<[number, number]>(() => {
    if (assemblyPoints.length === 0) return FALLBACK_CENTER;
    const lat = assemblyPoints.reduce((sum, p) => sum + p.lat, 0) / assemblyPoints.length;
    const lng = assemblyPoints.reduce((sum, p) => sum + p.lng, 0) / assemblyPoints.length;
    return [lat, lng];
  }, [assemblyPoints]);

  if (assemblyPoints.length === 0) {
    return (
      <Alert severity="warning" sx={{ borderRadius: 2 }}>
        Ehhez az eseményhez még nincs kijelölt gyülekezőpont — kérjük, egyeztessen a helyszíni ügyeletessel.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Gyülekezőpont</Typography>
      <TextField
        select
        label="Válasszon gyülekezőpontot"
        required={required}
        fullWidth
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        sx={{ mb: 1.5 }}
      >
        {assemblyPoints.map((p) => (
          <MenuItem key={p.id} value={p.id}>
            {p.name}{p.address ? ` — ${p.address}` : ''}
          </MenuItem>
        ))}
      </TextField>

      <Box sx={{ height: 240, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
        <MapContainer center={center} zoom={9} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> közreműködők'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {assemblyPoints.map((p) => (
            <Marker
              key={p.id}
              position={[p.lat, p.lng]}
              icon={assemblyPointIcon}
              eventHandlers={{ click: () => onChange(p.id) }}
            >
              <Popup>
                <strong>{p.name}</strong>
                {p.address && <><br />{p.address}</>}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </Box>
    </Box>
  );
}
