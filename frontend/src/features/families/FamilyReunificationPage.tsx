import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  CircularProgress,
  Button,
  IconButton,
  Tooltip,
  Collapse,
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
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MapIcon from '@mui/icons-material/Map';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { shelterIcon } from '../../lib/leafletIcons';
import { toast } from 'react-toastify';
import type { FamilyReunificationEntry, FamilyReunificationNote } from '../../types';
import { addReunificationNote, fetchReunificationNotes, fetchReunificationWorklist } from '../../lib/api/endpoints';
import { EmptyState } from '../../components/ui/EmptyState';
import { EventSubNav } from '../../components/layout/EventSubNav';

export function FamilyReunificationPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [families, setFamilies] = useState<FamilyReunificationEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFamily, setActiveFamily] = useState<FamilyReunificationEntry | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function load() {
    if (!eventId) return;
    setIsLoading(true);
    fetchReunificationWorklist(eventId).then(setFamilies).finally(() => setIsLoading(false));
  }

  useEffect(load, [eventId]);

  function toggleExpanded(familyId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(familyId)) next.delete(familyId);
      else next.add(familyId);
      return next;
    });
  }

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      {eventId && <EventSubNav eventId={eventId} />}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <GroupsIcon color="primary" />
        <Typography variant="h4" fontWeight={700}>Családegyesítési munkalista</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Azok a családok, amelyek tagjai jelenleg különböző befogadóhelyeken tartózkodnak. Rögzítse itt az
        ügyintézés lépéseit, amíg a család újra egy helyre nem kerül.
      </Typography>

      {families.length === 0 ? (
        <Paper variant="outlined">
          <EmptyState icon={<GroupsIcon fontSize="inherit" />} title="Jelenleg nincs szétszakadt család" />
        </Paper>
      ) : (
        <Stack spacing={2}>
          {families.map((f) => (
            <FamilyCard
              key={f.id}
              family={f}
              isExpanded={expandedIds.has(f.id)}
              onToggleExpand={() => toggleExpanded(f.id)}
              onOpenNotes={() => setActiveFamily(f)}
              onPersonClick={(personId) => navigate(`/szemelyek/${personId}`)}
            />
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

function FamilyCard({
  family,
  isExpanded,
  onToggleExpand,
  onOpenNotes,
  onPersonClick,
}: {
  family: FamilyReunificationEntry;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenNotes: () => void;
  onPersonClick: (personId: string) => void;
}) {
  const shelterGroups = useMemo(() => {
    const groups = new Map<string, { name: string; coordinates: { lat: number; lng: number }; members: string[] }>();
    for (const m of family.members) {
      if (!m.shelter_id || !m.shelter_coordinates) continue;
      const existing = groups.get(m.shelter_id);
      if (existing) {
        existing.members.push(m.full_name);
      } else {
        groups.set(m.shelter_id, {
          name: m.current_shelter ?? 'Befogadóhely',
          coordinates: m.shelter_coordinates,
          members: [m.full_name],
        });
      }
    }
    return [...groups.values()];
  }, [family.members]);

  const withoutLocation = family.members.filter((m) => !m.shelter_id).length;
  const distinctShelters = new Set(family.members.map((m) => m.shelter_id ?? 'none')).size;

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Box sx={{ p: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={1}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <WarningAmberIcon color="warning" fontSize="small" />
            <Typography fontWeight={700}>{family.family_code}</Typography>
            <Chip
              size="small"
              variant="outlined"
              color="warning"
              label={`${distinctShelters} különböző helyszín`}
            />
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Button variant="outlined" size="small" onClick={onOpenNotes}>
              Bejegyzések ({family.notes_count})
            </Button>
            <Tooltip title={isExpanded ? 'Összecsukás' : 'Részletek és térkép'}>
              <IconButton
                size="small"
                onClick={onToggleExpand}
                sx={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
              >
                <ExpandMoreIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
          {family.members.map((m) => (
            <Chip
              key={m.id}
              size="small"
              clickable
              icon={m.shelter_id ? <HomeWorkIcon fontSize="small" /> : <HelpOutlineIcon fontSize="small" />}
              label={`${m.full_name}: ${m.current_shelter ?? 'nincs befogadóhelyen'}`}
              onClick={() => onPersonClick(m.id)}
              color={m.shelter_id ? 'default' : 'default'}
              variant={m.shelter_id ? 'filled' : 'outlined'}
            />
          ))}
        </Stack>

        {family.latest_note && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Utolsó bejegyzés: {family.latest_note.note} {family.latest_note.resolved && '(megoldva jelölve)'}
          </Typography>
        )}
      </Box>

      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <Divider />
        <Box sx={{ p: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <MapIcon fontSize="small" color="action" />
            <Typography variant="subtitle2" fontWeight={700}>Hol vannak most</Typography>
          </Stack>

          {shelterGroups.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              A család egyik tagja sincs jelenleg befogadóhelyen — nincs megjeleníthető pozíció.
            </Typography>
          ) : (
            <Paper variant="outlined" sx={{ overflow: 'hidden', height: 280 }}>
              <MapContainer
                center={[shelterGroups[0].coordinates.lat, shelterGroups[0].coordinates.lng]}
                zoom={9}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> közreműködők'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {shelterGroups.map((g, index) => (
                  <Marker key={index} position={[g.coordinates.lat, g.coordinates.lng]} icon={shelterIcon}>
                    <Popup>
                      <strong>{g.name}</strong>
                      <br />
                      {g.members.join(', ')}
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </Paper>
          )}

          {withoutLocation > 0 && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              {withoutLocation} családtagnak nincs rögzített befogadóhelye, ő(k) nem szerepel(nek) a térképen.
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
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
