import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

/**
 * Egységes "üres állapot" megjelenítés a lista- és táblázatoldalakon, hogy a
 * korábban oldalanként eltérő, ad hoc "Nincs találat" / "Nincs rögzítve"
 * szövegek helyett konzisztens elrendezés és hangsúly legyen.
 */
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
      <Box sx={{ color: 'text.disabled', fontSize: 40, display: 'flex', justifyContent: 'center', mb: 1 }}>
        {icon ?? <InboxIcon fontSize="inherit" />}
      </Box>
      <Typography variant="body1" fontWeight={600}>{title}</Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 420, mx: 'auto' }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}
