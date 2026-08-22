import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface SelectableToggleCardProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: ReactNode;
  label: string;
  description?: string;
  disabled?: boolean;
  disabledHint?: string;
}

/**
 * Egy be-/kikapcsolható jelölő, ami egy kártyaszerű, ikonos, kattintható
 * dobozként jelenik meg a hagyományos jelölőnégyzet + hosszú felirat pár
 * helyett. Az opcionális `description` egy rövid, egyszerű nyelvű
 * magyarázat a jelölő alatt — első alkalommal kitöltőknek/idősebb
 * felhasználóknak segít eldönteni, mikor melyiket válasszák, anélkül hogy
 * külön súgót kellene megnyitniuk.
 */
export function SelectableToggleCard({ checked, onChange, icon, label, description, disabled, disabledHint }: SelectableToggleCardProps) {
  return (
    <Box
      component="button"
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.25,
        width: '100%',
        minHeight: 56,
        border: '1.5px solid',
        borderColor: checked ? 'primary.main' : 'divider',
        bgcolor: checked ? 'rgba(163, 23, 43, 0.06)' : 'background.paper',
        borderRadius: 2,
        px: 1.75,
        py: 1.25,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
        '&:hover': disabled ? undefined : {
          borderColor: 'primary.main',
          bgcolor: checked ? 'rgba(163, 23, 43, 0.09)' : 'action.hover',
        },
      }}
    >
      <Box sx={{ display: 'flex', color: checked ? 'primary.main' : 'text.secondary', flexShrink: 0, mt: '2px' }}>
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={checked ? 600 : 500} color={checked ? 'text.primary' : 'text.primary'}>
          {label}
        </Typography>
        {(description || (disabled && disabledHint)) && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.4 }}>
            {disabled && disabledHint ? disabledHint : description}
          </Typography>
        )}
      </Box>
      {checked && <CheckCircleIcon fontSize="small" color="primary" sx={{ flexShrink: 0, mt: '2px' }} />}
    </Box>
  );
}
