import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Button } from '@mui/material';
import { toast } from 'react-toastify';
import type { CheckInRecord, ShelterWithRisk } from '../../types';
import { fetchShelters, transferPerson } from '../../lib/api/endpoints';

export function TransferShelterDialog({
  personId,
  eventId,
  currentShelterId,
  onClose,
  onTransferred,
}: {
  personId: string;
  eventId: string;
  currentShelterId?: string;
  onClose: () => void;
  onTransferred: (checkIn: CheckInRecord) => void;
}) {
  const [eventShelters, setEventShelters] = useState<ShelterWithRisk[]>([]);
  const [shelterId, setShelterId] = useState('');
  const [bedLabel, setBedLabel] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    fetchShelters(eventId).then(setEventShelters).catch(() => setEventShelters([]));
  }, [eventId]);

  async function handleTransfer() {
    if (!shelterId) return;
    setIsTransferring(true);
    try {
      const { checkIn, familySplitWarning } = await transferPerson(personId, shelterId, false, bedLabel.trim() || undefined);
      toast.success('Áthelyezés rögzítve.');
      if (familySplitWarning) {
        toast.warning(familySplitWarning, { autoClose: 10000 });
      }
      onTransferred(checkIn);
    } catch (err: unknown) {
      const apiCode = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (apiCode === 'SHELTER_FULL') {
        toast.error('A kiválasztott befogadóhely megtelt.');
      } else {
        toast.error('Az áthelyezés nem sikerült.');
      }
    } finally {
      setIsTransferring(false);
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Áthelyezés másik befogadóhelyre</DialogTitle>
      <DialogContent>
        <TextField
          select
          label="Célbefogadóhely"
          fullWidth
          sx={{ mt: 1 }}
          value={shelterId}
          onChange={(e) => setShelterId(e.target.value)}
        >
          {eventShelters
            .filter((s) => s.shelter.id !== currentShelterId)
            .map((s) => (
              <MenuItem key={s.shelter.id} value={s.shelter.id}>
                {s.shelter.name} ({s.checked_in_count}/{s.capacity_limit})
              </MenuItem>
            ))}
        </TextField>
        <TextField
          label="Ágy/szoba/szektor azonosító (opcionális)"
          fullWidth
          sx={{ mt: 2 }}
          value={bedLabel}
          onChange={(e) => setBedLabel(e.target.value)}
          placeholder="pl. A terem, 12. ágy"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Mégse</Button>
        <Button variant="contained" onClick={handleTransfer} disabled={isTransferring || !shelterId}>
          {isTransferring ? 'Áthelyezés…' : 'Áthelyezés'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
