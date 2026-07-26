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
import { fetchEvent, fetchPersons } from '../lib/api/endpoints';
import type { EvacuationEvent, Person, ShelterWithRisk } from '../types';
import { specialNeedCategoryLabels } from '../constants/specialNeeds';

interface BulkShelterRosterPrintDialogProps {
  open: boolean;
  onClose: () => void;
  eventId: string;
  shelters: ShelterWithRisk[];
}

/**
 * Több kijelölt befogadóhely névsorát EGY nyomtatási feladatként állítja
 * össze (nem N külön böngészőfület/letöltést nyit, amit a böngésző
 * pop-up-blokkolója amúgy is elutasítana) — soronként oldaltörés választja
 * el a befogadóhelyeket, hogy a nyomtatott/PDF-mentett eredmény papíron is
 * jól használható maradjon.
 */
export function BulkShelterRosterPrintDialog({ open, onClose, eventId, shelters }: BulkShelterRosterPrintDialogProps) {
  const [event, setEvent] = useState<EvacuationEvent | null>(null);
  const [personsByShelter, setPersonsByShelter] = useState<Record<string, Person[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    Promise.all([
      fetchEvent(eventId),
      ...shelters.map((s) => fetchPersons(eventId, { shelter_id: s.shelter.id, per_page: 1000, sort_by: 'name' })),
    ])
      .then(([eventData, ...personLists]) => {
        setEvent(eventData);
        const map: Record<string, Person[]> = {};
        shelters.forEach((s, index) => {
          map[s.shelter.id] = personLists[index].data;
        });
        setPersonsByShelter(map);
      })
      .finally(() => setIsLoading(false));
  }, [open, eventId, shelters]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogContent>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <Box className="printable-roster" sx={{ bgcolor: '#fff', color: '#1a1a1a', p: 1 }}>
            {shelters.map((shelter, index) => {
              const persons = personsByShelter[shelter.shelter.id] ?? [];
              return (
                <Box key={shelter.shelter.id} sx={index < shelters.length - 1 ? { breakAfter: 'page' } : undefined}>
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
                      {persons.map((p, personIndex) => (
                        <TableRow key={p.id}>
                          <TableCell>{personIndex + 1}</TableCell>
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
              );
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Stack direction="row" spacing={1} sx={{ p: 1, width: '100%' }}>
          <Button startIcon={<CloseIcon />} onClick={onClose} fullWidth>
            Bezárás
          </Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()} disabled={isLoading} fullWidth>
            Nyomtatás ({shelters.length} befogadóhely)
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
