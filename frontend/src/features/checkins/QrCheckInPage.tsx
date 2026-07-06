import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  MenuItem,
  Button,
  Stack,
  Alert,
  Chip,
  Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StarIcon from '@mui/icons-material/Star';
import { toast } from 'react-toastify';
import type { Person, ShelterWithRisk } from '../../types';
import { checkInPerson, fetchShelters, resolveQrToken } from '../../lib/api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { specialNeedCategoryLabels } from '../../constants/specialNeeds';
import { SpecialNeedIcon } from '../../components/ui/SpecialNeedIcon';
import { QrScannerDialog } from '../../components/QrScannerDialog';

export function QrCheckInPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [shelters, setShelters] = useState<ShelterWithRisk[]>([]);
  const [shelterId, setShelterId] = useState<string>('');
  const [publicId, setPublicId] = useState('');
  const [previewPerson, setPreviewPerson] = useState<Person | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    const preselected = searchParams.get('shelter_id');
    fetchShelters(eventId).then((list) => {
      setShelters(list);
      if (preselected && list.some((s) => s.shelter.id === preselected)) {
        setShelterId(preselected);
      } else if (user?.shelter_id) {
        setShelterId(user.shelter_id);
      } else if (list.length > 0) {
        setShelterId(list[0].shelter.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, user]);

  async function handleLookup(overridePublicId?: string) {
    const idToLookup = (overridePublicId ?? publicId).trim();
    if (!idToLookup) return;
    setPreviewPerson(null);
    setIsBusy(true);
    try {
      const person = await resolveQrToken(idToLookup);
      setPublicId(idToLookup);
      setPreviewPerson(person);

      if (person.special_needs && person.special_needs.length > 0) {
        const labels = [...new Set(person.special_needs.map((n) => specialNeedCategoryLabels[n.category] ?? n.category))];
        toast.warning(`Figyelem: ${person.full_name} egyedi igénnyel rendelkezik — ${labels.join(', ')}.`, { autoClose: 8000 });
      }

      if (eventId) {
        fetchShelters(eventId, person.id).then((list) => {
          setShelters(list);
          const recommended = list.find((s) => s.recommended);
          if (recommended && !user?.shelter_id) {
            setShelterId(recommended.shelter.id);
          }
        }).catch(() => {});
      }
    } catch {
      toast.error('A kód nem található vagy hibás.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleConfirmCheckIn() {
    if (!eventId || !shelterId) return;
    setIsBusy(true);
    try {
      await checkInPerson(shelterId, { event_id: eventId, public_id: publicId.trim() });
      toast.success(`${previewPerson?.full_name ?? 'A személy'} sikeresen érkeztetve.`);
      setPreviewPerson(null);
      setPublicId('');
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(apiMessage ?? 'Az érkeztetés nem sikerült.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>QR érkeztetés</Typography>

      <Paper variant="outlined" sx={{ p: 3, maxWidth: 640 }}>
        <Stack spacing={3}>
          <TextField
            select
            label="Befogadóhely"
            value={shelterId}
            onChange={(e) => setShelterId(e.target.value)}
            disabled={!!user?.shelter_id}
            fullWidth
          >
            {shelters.map((s) => (
              <MenuItem key={s.shelter.id} value={s.shelter.id}>
                <Stack direction="row" spacing={1} alignItems="center">
                  {s.recommended && <StarIcon fontSize="small" color="warning" />}
                  <span>{s.shelter.name} ({s.checked_in_count}/{s.capacity_limit}){s.recommended ? ' — Javasolt' : ''}</span>
                </Stack>
              </MenuItem>
            ))}
          </TextField>

          <Box>
            <Stack direction="row" spacing={1}>
              <TextField
                label="QR-kód azonosító (kézi bevitel is elfogadott)"
                value={publicId}
                onChange={(e) => setPublicId(e.target.value)}
                placeholder="Illessze be vagy írja be az azonosítót"
                fullWidth
              />
              <Button variant="outlined" onClick={() => handleLookup()} disabled={isBusy || !publicId} startIcon={<SearchIcon />} sx={{ flexShrink: 0 }}>
                Keresés
              </Button>
              <Button variant="outlined" onClick={() => setScannerOpen(true)} disabled={isBusy} startIcon={<QrCodeScannerIcon />} sx={{ flexShrink: 0 }}>
                Kamera
              </Button>
            </Stack>
          </Box>

          <QrScannerDialog
            open={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onDetected={(value) => {
              setScannerOpen(false);
              handleLookup(value);
            }}
          />

          {previewPerson && (
            <Alert severity={previewPerson.special_needs && previewPerson.special_needs.length > 0 ? 'warning' : 'info'} icon={false}>
              <Stack spacing={1}>
                <Typography fontWeight={700}>{previewPerson.full_name}</Typography>
                <Typography variant="body2">Település: {previewPerson.municipality?.name ?? '–'}</Typography>
                <Typography variant="body2">Státusz: {previewPerson.registration?.status ?? '–'}</Typography>
                {previewPerson.special_needs && previewPerson.special_needs.length > 0 && (
                  <Box>
                    <Typography variant="body2" fontWeight={700}>Egyedi igények:</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.5 }}>
                      {previewPerson.special_needs.map((n) => (
                        <Chip
                          key={n.id}
                          icon={<SpecialNeedIcon category={n.category} fontSize="small" />}
                          label={specialNeedCategoryLabels[n.category] ?? n.category}
                          size="small"
                          color="warning"
                        />
                      ))}
                    </Stack>
                  </Box>
                )}
                {shelters.find((s) => s.shelter.id === shelterId)?.recommended && (
                  <Typography variant="body2" color="warning.dark">
                    <StarIcon fontSize="inherit" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
                    A kiválasztott befogadóhely javasolt az egyedi igények alapján.
                  </Typography>
                )}
                <Divider />
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={handleConfirmCheckIn}
                  disabled={isBusy}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Érkeztetés megerősítése
                </Button>
              </Stack>
            </Alert>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
