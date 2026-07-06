import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, CircularProgress } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  isSubmitting?: boolean;
  severity?: 'warning' | 'error';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Egységes megerősítő dialógus a visszafordíthatatlan/kritikus műveletekhez
 * (törlés, státusz "törölt"-re állítása), hogy ezek ne fussanak le véletlen
 * kattintásra.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Megerősítés',
  isSubmitting,
  severity = 'warning',
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon color={severity} />
        {title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>{description}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} color="inherit">Mégse</Button>
        <Button
          onClick={onConfirm}
          color={severity === 'error' ? 'error' : 'warning'}
          variant="contained"
          disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
