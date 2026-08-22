import type { ReactNode } from 'react';
import { Paper, Stack, Box, Avatar, Typography, IconButton, Tooltip } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

interface FamilyMemberCardProps {
  index: number;
  total: number;
  primaryContact?: boolean;
  onRemove?: () => void;
  children: ReactNode;
}

/**
 * Egy családtag adatlapját keretező kártya, sorszámozott jelvénnyel — a
 * korábbi, puszta elválasztóvonalakkal tagolt űrlap helyett minden
 * családtag vizuálisan is önálló, letisztult egység, ami több tagnál is
 * jól követhető marad.
 */
export function FamilyMemberCard({ index, total, primaryContact, onRemove, children }: FamilyMemberCardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 3 },
        borderRadius: 3,
        borderColor: 'divider',
        transition: 'box-shadow 0.15s ease',
        '&:hover': { boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 34, height: 34, fontSize: '0.9rem', fontWeight: 700 }}>
          {index + 1}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            {total === 1 ? 'Személyes adatok' : `${index + 1}. családtag`}
          </Typography>
          {primaryContact && (
            <Typography variant="caption" color="text.secondary">Kapcsolattartó</Typography>
          )}
        </Box>
        {onRemove && (
          <Tooltip title="Családtag eltávolítása">
            <IconButton size="small" color="error" onClick={onRemove}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      {children}
    </Paper>
  );
}
