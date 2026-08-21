import { useEffect, useState } from 'react';
import { Box, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Typography, List, ListItem, ListItemText, Chip, Button } from '@mui/material';
import type { RegistrationStatus } from '../../types';
import { fetchCitizenHistory, type CitizenHistoryEntry } from '../../lib/api/endpoints';
import { registrationStatusLabels as statusLabels } from '../../constants/registrationStatus';

export function CitizenHistoryDialog({
  citizenId,
  currentPersonId,
  onClose,
  onNavigateToPerson,
}: {
  citizenId: string;
  currentPersonId?: string;
  onClose: () => void;
  onNavigateToPerson: (personId: string) => void;
}) {
  const [citizenHistory, setCitizenHistory] = useState<CitizenHistoryEntry[] | null>(null);

  useEffect(() => {
    setCitizenHistory(null);
    fetchCitizenHistory(citizenId).then((result) => setCitizenHistory(result.registrations));
  }, [citizenId]);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Korábbi kitelepítések</DialogTitle>
      <DialogContent>
        {citizenHistory === null ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={28} /></Box>
        ) : citizenHistory.length <= 1 ? (
          <Typography color="text.secondary">Ez az egyetlen ismert kitelepítési regisztrációja.</Typography>
        ) : (
          <List>
            {citizenHistory.map((entry) => (
              <ListItem
                key={entry.person_id}
                disableGutters
                sx={{ cursor: entry.person_id !== currentPersonId ? 'pointer' : 'default' }}
                onClick={() => {
                  if (entry.person_id === currentPersonId) return;
                  onNavigateToPerson(entry.person_id);
                }}
              >
                <ListItemText
                  primary={
                    <>
                      {entry.event.name} ({entry.event.code})
                      {entry.person_id === currentPersonId && <Chip size="small" label="jelenlegi" sx={{ ml: 1 }} />}
                    </>
                  }
                  secondary={`${statusLabels[entry.registration_status as RegistrationStatus] ?? entry.registration_status ?? '–'}${entry.registered_at ? ` · ${new Date(entry.registered_at).toLocaleString('hu-HU')}` : ''}`}
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
