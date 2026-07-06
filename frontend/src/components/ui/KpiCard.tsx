import { Paper, Typography, Box } from '@mui/material';
import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: string | number;
  icon?: ReactNode;
  onClick?: () => void;
}

export function KpiCard({ label, value, icon, onClick }: Props) {
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        p: 2.5,
        minWidth: 170,
        flex: '1 1 170px',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        ...(onClick && {
          '&:hover': {
            boxShadow: 2,
            borderColor: 'primary.main',
          },
        }),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, color: 'text.secondary', minHeight: '2.6em' }}>
        {icon && <Box sx={{ display: 'flex', mt: '2px' }}>{icon}</Box>}
        <Typography
          variant="body2"
          sx={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {label}
        </Typography>
      </Box>
      <Typography variant="h3" fontWeight={700} sx={{ mt: 'auto' }}>{value}</Typography>
    </Paper>
  );
}
