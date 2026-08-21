import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from '@mui/material';
import { toast } from 'react-toastify';
import type { CheckInRecord } from '../../types';
import { updateBedAssignment } from '../../lib/api/endpoints';

export function BedLabelDialog({
  personId,
  initialBedLabel,
  onClose,
  onSaved,
}: {
  personId: string;
  initialBedLabel: string;
  onClose: () => void;
  onSaved: (checkIn: CheckInRecord) => void;
}) {
  const [bedLabelDraft, setBedLabelDraft] = useState(initialBedLabel);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      const checkIn = await updateBedAssignment(personId, bedLabelDraft.trim() || null);
      toast.success('Ágy/szoba azonosító frissítve.');
      onSaved(checkIn);
    } catch {
      toast.error('A frissítés nem sikerült.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Ágy/szoba azonosító módosítása</DialogTitle>
      <DialogContent>
        <TextField
          label="Ágy/szoba/szektor azonosító"
          fullWidth
          sx={{ mt: 1 }}
          value={bedLabelDraft}
          onChange={(e) => setBedLabelDraft(e.target.value)}
          placeholder="pl. A terem, 12. ágy"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Mégse</Button>
        <Button variant="contained" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Mentés…' : 'Mentés'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
