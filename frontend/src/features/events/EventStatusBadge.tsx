import { Chip } from '@mui/material';
import type { EventStatus } from '../../types';

const labelMap: Record<EventStatus, string> = {
  draft: 'Tervezet',
  active: 'Aktív',
  paused: 'Szüneteltetve',
  closed: 'Lezárva',
};

const colorMap: Record<EventStatus, 'default' | 'success' | 'warning'> = {
  draft: 'default',
  active: 'success',
  paused: 'warning',
  closed: 'default',
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <Chip label={labelMap[status]} color={colorMap[status]} size="small" />;
}
