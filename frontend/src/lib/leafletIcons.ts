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
