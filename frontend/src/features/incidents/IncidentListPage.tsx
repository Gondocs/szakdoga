import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  TextField,
  MenuItem,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { toast } from 'react-toastify';
import type { Incident, IncidentCategory, IncidentSeverity, ShelterWithRisk } from '../../types';
import { createIncident, fetchIncidents, fetchShelters, resolveIncident } from '../../lib/api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { EmptyState } from '../../components/ui/EmptyState';

const categoryLabels: Record<IncidentCategory, string> = {
  complaint: 'Panasz',
  conflict: 'Konfliktus',
  security: 'Biztonsági esemény',
  damage: 'Káresemény',
  other: 'Egyéb',
};

const severityLabels: Record<IncidentSeverity, string> = {
  low: 'Alacsony',
  medium: 'Közepes',
  high: 'Magas',
};

const severityColors: Record<IncidentSeverity, 'success' | 'warning' | 'error'> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
};

export function IncidentListPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuth();
  const canManage = ['admin', 'manager', 'registrar', 'shelter_operator'].includes(user?.role?.code ?? '');

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'open' | 'resolved' | 'all'>('open');
  const [createOpen, setCreateOpen] = useState(false);

  function load() {
    if (!eventId) return;
    setIsLoading(true);
    fetchIncidents(eventId, statusFilter === 'all' ? undefined : statusFilter)
      .then(setIncidents)
      .finally(() => setIsLoading(false));
  }

  useEffect(load, [eventId, statusFilter]);

  async function handleResolve(id: number) {
    try {
      await resolveIncident(id);
      toast.success('Esemény lezárva.');
      load();
    } catch {
      toast.error('A lezárás nem sikerült.');
    }
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5} sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <ReportProblemIcon color="primary" />
          <Typography variant="h4" fontWeight={700}>Panaszok / rendkívüli események</Typography>
        </Stack>
        {canManage && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Új bejegyzés
          </Button>
        )}
      </Stack>

      <ToggleButtonGroup
        size="small"
        exclusive
        value={statusFilter}
        onChange={(_, value: 'open' | 'resolved' | 'all' | null) => value && setStatusFilter(value)}
        sx={{ mb: 2 }}
      >
        <ToggleButton value="open">Nyitott</ToggleButton>
        <ToggleButton value="resolved">Lezárt</ToggleButton>
        <ToggleButton value="all">Összes</ToggleButton>
      </ToggleButtonGroup>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : incidents.length === 0 ? (
        <Paper variant="outlined">
          <EmptyState title="Nincs megjeleníthető bejegyzés" />
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {incidents.map((i) => (
            <Paper key={i.id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                <Box sx={{ flex: 1, minWidth: 200 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Chip size="small" label={categoryLabels[i.category]} />
                    <Chip size="small" color={severityColors[i.severity]} label={severityLabels[i.severity]} />
                    {i.status === 'resolved' && <Chip size="small" color="success" variant="outlined" label="Lezárva" />}
                    {i.shelter && <Chip size="small" variant="outlined" label={i.shelter.name} />}
                    {i.person && <Chip size="small" variant="outlined" label={i.person.full_name} />}
                  </Stack>
                  <Typography variant="body2" sx={{ mt: 1 }}>{i.description}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    {new Date(i.created_at).toLocaleString('hu-HU')}{i.reported_by ? ` · ${i.reported_by}` : ''}
                    {i.resolved_at ? ` · Lezárva: ${new Date(i.resolved_at).toLocaleString('hu-HU')}${i.resolved_by ? ` (${i.resolved_by})` : ''}` : ''}
                  </Typography>
                </Box>
                {i.status === 'open' && canManage && (
                  <Button size="small" variant="outlined" color="success" startIcon={<CheckCircleIcon />} onClick={() => handleResolve(i.id)}>
                    Lezárás
                  </Button>
                )}
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      {createOpen && (
        <CreateIncidentDialog
          eventId={eventId!}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            load();
          }}
        />
      )}
    </Box>
  );
}

function CreateIncidentDialog({
  eventId,
  onClose,
  onCreated,
}: {
  eventId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [category, setCategory] = useState<IncidentCategory>('complaint');
  const [severity, setSeverity] = useState<IncidentSeverity>('low');
  const [description, setDescription] = useState('');
  const [shelterId, setShelterId] = useState('');
  const [shelters, setShelters] = useState<ShelterWithRisk[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchShelters(eventId).then(setShelters).catch(() => setShelters([]));
  }, [eventId]);

  async function handleSubmit() {
    if (!description.trim()) return;
    setIsSubmitting(true);
    try {
      await createIncident(eventId, {
        category,
        severity,
        description: description.trim(),
        shelter_id: shelterId || undefined,
      });
      toast.success('Bejegyzés rögzítve.');
      onCreated();
    } catch {
      toast.error('A bejegyzés rögzítése nem sikerült.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Új panasz / rendkívüli esemény</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField select label="Kategória" value={category} onChange={(e) => setCategory(e.target.value as IncidentCategory)} fullWidth>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <MenuItem key={value} value={value}>{label}</MenuItem>
            ))}
          </TextField>
          <TextField select label="Súlyosság" value={severity} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)} fullWidth>
            {Object.entries(severityLabels).map(([value, label]) => (
              <MenuItem key={value} value={value}>{label}</MenuItem>
            ))}
          </TextField>
          <TextField select label="Befogadóhely (opcionális)" value={shelterId} onChange={(e) => setShelterId(e.target.value)} fullWidth>
            <MenuItem value="">Nincs</MenuItem>
            {shelters.map((s) => (
              <MenuItem key={s.shelter.id} value={s.shelter.id}>{s.shelter.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Leírás"
            multiline
            minRows={3}
            fullWidth
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">Mégse</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={isSubmitting || !description.trim()}>
          {isSubmitting ? 'Mentés…' : 'Rögzítés'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
