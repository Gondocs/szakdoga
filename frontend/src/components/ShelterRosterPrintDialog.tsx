import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stack,
  Divider,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import { fetchEvent, fetchPersons, shelterRosterExportUrl } from '../lib/api/endpoints';
import type { EvacuationEvent, Person, ShelterWithRisk } from '../types';
import { specialNeedCategoryLabels } from '../constants/specialNeeds';

interface ShelterRosterPrintDialogProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
  shelter: ShelterWithRisk;
}

export function ShelterRosterPrintDialog({ open, onClose, eventId, shelter }: ShelterRosterPrintDialogProps) {
  const [event, setEvent] = useState<EvacuationEvent | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    Promise.all([
      fetchEvent(eventId),
      fetchPersons(eventId, { shelter_id: shelter.shelter.id, per_page: 1000, sort_by: 'name' }),
    ])
      .then(([eventData, personsData]) => {
        setEvent(eventData);
        setPersons(personsData.data);
      })
      .finally(() => setIsLoading(false));
  }, [open, eventId, shelter.shelter.id]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogContent>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <Box className="printable-roster" sx={{ bgcolor: '#fff', color: '#1a1a1a', p: 1 }}>
            <Typography variant="overline" sx={{ letterSpacing: 1 }}>Befogadóhelyi névsor</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5 }}>{shelter.shelter.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {shelter.shelter.municipality ? `${shelter.shelter.municipality}, ` : ''}{shelter.shelter.address}
            </Typography>
            {event && (
              <Typography variant="body2" color="text.secondary">
                {event.name} ({event.code})
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              Generálva: {new Date().toLocaleString('hu-HU')} — Foglaltság: {shelter.checked_in_count} / {shelter.capacity_limit} fő
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Név</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Születési adat</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Település</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Telefon</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Család</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Egyedi igény</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {persons.map((p, index) => (
                  <TableRow key={p.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{p.full_name}</TableCell>
                    <TableCell>{p.birth_place ?? '–'}{p.birth_date ? ` / ${p.birth_date}` : ''}</TableCell>
                    <TableCell>{p.municipality?.name ?? '–'}</TableCell>
                    <TableCell>{p.phone ?? '–'}</TableCell>
                    <TableCell>{p.family?.family_code ?? '–'}</TableCell>
                    <TableCell>
                      {p.special_needs && p.special_needs.length > 0
                        ? [...new Set(p.special_needs.map((n) => specialNeedCategoryLabels[n.category] ?? n.category))].join(', ')
                        : '–'}
                    </TableCell>
                  </TableRow>
                ))}
                {persons.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">Jelenleg senki nincs ezen a befogadóhelyen.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
              Összesen: {persons.length} fő
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Stack direction="row" spacing={1} sx={{ p: 1, width: '100%' }}>
          <Button startIcon={<CloseIcon />} onClick={onClose} fullWidth>
            Bezárás
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            component="a"
            href={shelterRosterExportUrl(eventId, shelter.shelter.id)}
            target="_blank"
            rel="noopener"
            fullWidth
          >
            CSV letöltése
          </Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()} disabled={isLoading} fullWidth>
            Nyomtatás
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
