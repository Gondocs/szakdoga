import { Chip } from '@mui/material';
import type { RiskLevel } from '../../types';

const labels: Record<RiskLevel, string> = {
  low: 'Alacsony',
  medium: 'Közepes',
  high: 'Magas',
  critical: 'Kritikus',
};

const colors: Record<RiskLevel, 'success' | 'warning' | 'error'> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
  critical: 'error',
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <Chip
      label={labels[level]}
      color={colors[level]}
      size="small"
      variant={level === 'critical' ? 'filled' : 'outlined'}
      sx={level === 'critical' ? { fontWeight: 700 } : undefined}
    />
  );
}
