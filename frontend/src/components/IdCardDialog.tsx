import { Dialog, DialogContent, DialogActions, Button, Box, Typography, Stack, Divider } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import CloseIcon from '@mui/icons-material/Close';
import { QRCodeCanvas } from 'qrcode.react';

interface IdCardDialogProps {
  open: boolean;
  onClose: () => void;
  fullName: string;
  publicId: string;
  eventName?: string;
  eventCode?: string;
  familyCode?: string | null;
}

export function IdCardDialog({ open, onClose, fullName, publicId, eventName, eventCode, familyCode }: IdCardDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogContent>
        <Box
          className="printable-id-card"
          sx={{
            border: '2px solid',
            borderColor: 'primary.main',
            borderRadius: 2,
            p: 3,
            textAlign: 'center',
            bgcolor: '#fff',
            color: '#1a1a1a',
          }}
        >
          <Typography variant="overline" sx={{ letterSpacing: 1 }}>Kitelepítési azonosító kártya</Typography>
          {eventName && <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5 }}>{eventName}</Typography>}
          {eventCode && <Typography variant="caption" color="text.secondary">Esemény kód: {eventCode}</Typography>}
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'inline-block', p: 1.5, border: '1px solid #ddd', borderRadius: 2 }}>
            <QRCodeCanvas value={publicId} size={180} />
          </Box>
          <Typography variant="h6" fontWeight={700} sx={{ mt: 2 }}>{fullName}</Typography>
          {familyCode && <Typography variant="body2" color="text.secondary">Családkód: {familyCode}</Typography>}
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, wordBreak: 'break-all' }}>
            {publicId}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Stack direction="row" spacing={1} sx={{ p: 1, width: '100%' }}>
          <Button startIcon={<CloseIcon />} onClick={onClose} fullWidth>
            Bezárás
          </Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()} fullWidth>
            Nyomtatás
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
