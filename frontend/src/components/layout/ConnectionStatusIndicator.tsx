import { useEffect, useState } from 'react';
import { Tooltip, Box } from '@mui/material';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import SyncIcon from '@mui/icons-material/Sync';
import { subscribeConnectionState, type EchoConnectionState } from '../../lib/echo';

const stateMeta: Record<EchoConnectionState, { label: string; color: string; icon: 'on' | 'off' | 'sync' }> = {
  connected: { label: 'Élő kapcsolat — a valós idejű frissítések működnek', color: '#2e7d32', icon: 'on' },
  connecting: { label: 'Csatlakozás a valós idejű frissítésekhez…', color: '#ed6c02', icon: 'sync' },
  initialized: { label: 'Csatlakozás a valós idejű frissítésekhez…', color: '#ed6c02', icon: 'sync' },
  unavailable: { label: 'A valós idejű kapcsolat egyelőre nem elérhető — az adatok elavultak lehetnek', color: '#c62828', icon: 'off' },
  failed: { label: 'A valós idejű kapcsolat nem sikerült — az adatok elavultak lehetnek', color: '#c62828', icon: 'off' },
  disconnected: { label: 'Megszakadt a valós idejű kapcsolat — újracsatlakozás…', color: '#c62828', icon: 'off' },
};

/**
 * Diszkrét jelző a fejlécben arról, hogy a Reverb WebSocket-kapcsolat él-e —
 * enélkül semmi nem jelezné, ha megszakad a kapcsolat, és a dashboard/térkép
 * élő frissítései (kapacitás, incidens, jármű-pozíció) csendben elavulnának.
 */
export function ConnectionStatusIndicator() {
  const [state, setState] = useState<EchoConnectionState>('connecting');

  useEffect(() => subscribeConnectionState(setState), []);

  const meta = stateMeta[state];
  const Icon = meta.icon === 'on' ? WifiIcon : meta.icon === 'off' ? WifiOffIcon : SyncIcon;

  return (
    <Tooltip title={meta.label}>
      <Box sx={{ display: 'flex', alignItems: 'center', color: meta.color }}>
        <Icon fontSize="small" />
      </Box>
    </Tooltip>
  );
}
