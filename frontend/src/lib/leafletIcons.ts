import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

/**
 * Vite a Leaflet alapértelmezett marker-ikonjainak relatív útvonalát nem
 * tudja feloldani csomagolás után; explicit módon kell újrakötni azokat.
 */
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export const busIcon = new L.DivIcon({
  html: '<div style="background:#a3172b;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.4);font-size:16px;">🚌</div>',
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export const shelterIcon = new L.DivIcon({
  html: '<div style="background:#3c6e91;color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.4);font-size:14px;">🏠</div>',
  className: '',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

export const assemblyPointIcon = new L.DivIcon({
  html: '<div style="background:#2e7d32;color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.4);font-size:14px;">📍</div>',
  className: '',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const incidentSeverityColors: Record<'low' | 'medium' | 'high', string> = {
  low: '#f0a202',
  medium: '#e8590c',
  high: '#c0182b',
};

/**
 * A településenkénti regisztráció-számláló jelvénye: fix, szűk méret-
 * tartományban skálázunk (nem a kör TERÜLETÉVEL arányosan, mint korábban a
 * CircleMarker-nél), hogy szomszédos települések jelvényei ne fedjék/olvadjanak
 * össze a térképen — a pontos létszám úgyis rajta van a jelvényen.
 */
export function municipalityIcon(count: number): L.DivIcon {
  const size = Math.round(Math.min(26 + Math.sqrt(count) * 2.5, 42));
  const fontSize = size > 34 ? 13 : 11;

  return new L.DivIcon({
    html: `<div style="background:#a3172b;color:#fff;border-radius:50%;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.4);font-size:${fontSize}px;font-weight:700;border:2px solid #fff;">${count}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function incidentIcon(severity: 'low' | 'medium' | 'high'): L.DivIcon {
  const color = incidentSeverityColors[severity];

  return new L.DivIcon({
    html: `<div style="background:${color};color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.4);font-size:14px;">⚠️</div>`,
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}
