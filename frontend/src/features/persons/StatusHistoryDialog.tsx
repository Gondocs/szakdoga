import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Typography, List, ListItem, ListItemText, Button } from '@mui/material';
import type { RegistrationStatus, StatusHistoryEntry } from '../../types';
import { fetchStatusHistory } from '../../lib/api/endpoints';
import { registrationStatusLabels as statusLabels } from '../../constants/registrationStatus';

export function StatusHistoryDialog({ personId, onClose }: { personId: string; onClose: () => void }) {
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);

  useEffect(() => {
    fetchStatusHistory(personId).then(setHistory);
  }, [personId]);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Státusztörténet</DialogTitle>
      <DialogContent>
        {history.length === 0 ? (
          <Typography color="text.secondary">Nincs rögzített státuszváltás.</Typography>
        ) : (
          <List>
            {history.map((h) => (
              <ListItem key={h.id} disableGutters>
                <ListItemText
                  primary={`${h.old_status ? `${statusLabels[h.old_status as RegistrationStatus] ?? h.old_status} → ` : ''}${statusLabels[h.new_status as RegistrationStatus] ?? h.new_status}`}
                  secondary={`${new Date(h.created_at).toLocaleString('hu-HU')}${h.changed_by ? ` · ${h.changed_by}` : ''}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Bezárás</Button>
      </DialogActions>
    </Dialog>
  );
}
