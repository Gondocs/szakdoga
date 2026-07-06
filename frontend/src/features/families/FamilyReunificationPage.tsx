import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { toast } from 'react-toastify';
import type { FamilyReunificationEntry, FamilyReunificationNote } from '../../types';
import { addReunificationNote, fetchReunificationNotes, fetchReunificationWorklist } from '../../lib/api/endpoints';

export function FamilyReunificationPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [families, setFamilies] = useState<FamilyReunificationEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFamily, setActiveFamily] = useState<FamilyReunificationEntry | null>(null);

  function load() {
    if (!eventId) return;
    setIsLoading(true);
    fetchReunificationWorklist(eventId).then(setFamilies).finally(() => setIsLoading(false));
  }

  useEffect(load, [eventId]);

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <GroupsIcon color="primary" />
        <Typography variant="h4" fontWeight={700}>Családegyesítési munkalista</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Azok a családok, amelyek tagjai jelenleg különböző befogadóhelyeken tartózkodnak. Rögzítse itt az
        ügyintézés lépéseit, amíg a család újra egy helyre nem kerül.
      </Typography>

      {families.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">Jelenleg nincs szétszakadt család.</Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {families.map((f) => (
            <Paper key={f.id} variant="outlined" sx={{ p: 2 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                spacing={1}
                sx={{ mb: 1.5 }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <WarningAmberIcon color="warning" fontSize="small" />
                  <Typography fontWeight={700}>{f.family_code}</Typography>
                </Stack>
                <Button variant="outlined" size="small" onClick={() => setActiveFamily(f)} sx={{ flexShrink: 0 }}>
                  Bejegyzések ({f.notes_count})
                </Button>
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {f.members.map((m) => (
                  <Chip key={m.id} size="small" label={`${m.full_name}: ${m.current_shelter ?? 'nincs befogadóhelyen'}`} />
                ))}
              </Stack>

              {f.latest_note && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                  Utolsó bejegyzés: {f.latest_note.note} {f.latest_note.resolved && '(megoldva jelölve)'}
                </Typography>
              )}
            </Paper>
          ))}
        </Stack>
      )}

      {activeFamily && (
        <ReunificationNotesDialog
          family={activeFamily}
          onClose={() => setActiveFamily(null)}
          onNoteAdded={() => load()}
        />
      )}
    </Box>
  );
}

function ReunificationNotesDialog({
  family,
  onClose,
  onNoteAdded,
}: {
  family: FamilyReunificationEntry;
  onClose: () => void;
  onNoteAdded: () => void;
}) {
  const [notes, setNotes] = useState<FamilyReunificationNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [resolved, setResolved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchReunificationNotes(family.id).then(setNotes).finally(() => setIsLoading(false));
  }, [family.id]);

  async function handleSubmit() {
    if (!newNote.trim()) return;
    setIsSubmitting(true);
    try {
      const created = await addReunificationNote(family.id, { note: newNote.trim(), resolved });
      setNotes((prev) => [created, ...prev]);
      setNewNote('');
      setResolved(false);
      toast.success('Bejegyzés rögzítve.');
      onNoteAdded();
    } catch {
      toast.error('A bejegyzés rögzítése nem sikerült.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{family.family_code} — családegyesítési bejegyzések</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          <TextField
            label="Új bejegyzés"
            multiline
            minRows={2}
            fullWidth
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <FormControlLabel
              control={<Checkbox checked={resolved} onChange={(e) => setResolved(e.target.checked)} />}
              label="Megoldottnak jelölöm"
            />
            <Button variant="contained" onClick={handleSubmit} disabled={isSubmitting || !newNote.trim()}>
              {isSubmitting ? 'Mentés…' : 'Hozzáadás'}
            </Button>
          </Stack>
        </Stack>

        <Divider sx={{ mb: 1 }} />

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={24} /></Box>
        ) : notes.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Még nincs bejegyzés.</Typography>
        ) : (
          <List dense>
            {notes.map((n) => (
              <ListItem key={n.id} disableGutters>
                <ListItemText
                  primary={`${n.note}${n.resolved ? ' (megoldva)' : ''}`}
                  secondary={`${new Date(n.created_at).toLocaleString('hu-HU')}${n.created_by ? ` · ${n.created_by}` : ''}`}
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
