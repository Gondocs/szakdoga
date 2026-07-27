import { useEffect, useRef, useState } from 'react';
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
  IconButton,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StarIcon from '@mui/icons-material/Star';
import TabletMacIcon from '@mui/icons-material/TabletMac';
import CloseIcon from '@mui/icons-material/Close';
import { toast } from 'react-toastify';
import type { Person, ShelterWithRisk } from '../../types';
import { checkInPerson, fetchShelters, resolveQrToken } from '../../lib/api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { specialNeedCategoryLabels, specialNeedDetailLabel } from '../../constants/specialNeeds';
import { registrationStatusLabels } from '../../constants/registrationStatus';
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
  const [bedLabel, setBedLabel] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  // Kioszk mód: a befogadóhely bejáratánál álló, sok egymás utáni idegen
  // felhasználó (regisztrált személy) által kezelt tablet nézete — lezárt
  // befogadóhely-választó, nagy gombok, automatikusan újranyíló kamera,
  // teljes képernyő. Nem tárolt/perzisztált állapot: minden alkalommal a
  // személyzet indítja el, amikor felállítja a tabletet.
  const [kioskMode, setKioskMode] = useState(false);
  const [kioskSuccessName, setKioskSuccessName] = useState<string | null>(null);
  const kioskResumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const { familySplitWarning } = await checkInPerson(shelterId, {
        event_id: eventId,
        public_id: publicId.trim(),
        bed_label: bedLabel.trim() || undefined,
      });
      const name = previewPerson?.full_name ?? 'A személy';
      toast.success(`${name} sikeresen érkeztetve.`);
      if (familySplitWarning) {
        toast.warning(familySplitWarning, { autoClose: 10000 });
      }
      setPreviewPerson(null);
      setPublicId('');
      setBedLabel('');

      if (kioskMode) {
        setKioskSuccessName(name);
      }
    } catch (err: unknown) {
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(apiMessage ?? 'Az érkeztetés nem sikerült.');
    } finally {
      setIsBusy(false);
    }
  }

  function enterKioskMode() {
    if (!shelterId) {
      toast.error('Kioszk mód indításához előbb válasszon befogadóhelyet.');
      return;
    }
    setKioskMode(true);
    setScannerOpen(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  function exitKioskMode() {
    setKioskMode(false);
    setScannerOpen(false);
    setKioskSuccessName(null);
    if (kioskResumeTimer.current) clearTimeout(kioskResumeTimer.current);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  // Kioszk módban a kamera automatikusan újranyílik, amint a rendszer újra
  // "üresjáratban" van (nincs előnézet, nincs folyamatban lévő hívás, nincs
  // épp sikeres-érkeztetés-visszajelzés) — a személyzetnek nem kell minden
  // egyes látogató után külön a "Kamera" gombra koppintania.
  useEffect(() => {
    if (!kioskMode || previewPerson || isBusy || scannerOpen || kioskSuccessName) return;
    const timer = setTimeout(() => setScannerOpen(true), 1200);
    return () => clearTimeout(timer);
  }, [kioskMode, previewPerson, isBusy, scannerOpen, kioskSuccessName]);

  // A sikeres érkeztetés visszaigazolása pár másodpercig látszik, utána
  // magától visszavált szkennelésre — nincs szükség kézi "OK" koppintásra.
  useEffect(() => {
    if (!kioskSuccessName) return;
    kioskResumeTimer.current = setTimeout(() => setKioskSuccessName(null), 3000);
    return () => {
      if (kioskResumeTimer.current) clearTimeout(kioskResumeTimer.current);
    };
  }, [kioskSuccessName]);

  useEffect(() => {
    function handleFullscreenChange() {
      if (!document.fullscreenElement) setKioskMode(false);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (kioskMode) {
    const selectedShelter = shelters.find((s) => s.shelter.id === shelterId);

    return (
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 1300,
          bgcolor: 'primary.main',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <Tooltip title="Kilépés a kioszk módból">
          <IconButton onClick={exitKioskMode} sx={{ position: 'absolute', top: 16, right: 16, color: 'rgba(255,255,255,0.5)' }}>
            <CloseIcon />
          </IconButton>
        </Tooltip>

        <Typography variant="h3" fontWeight={700} textAlign="center" sx={{ mb: 0.5 }}>
          {selectedShelter?.shelter.name ?? 'Érkeztetés'}
        </Typography>
        <Typography variant="h6" sx={{ mb: 5, opacity: 0.85 }}>QR-kódos érkeztetés</Typography>

        {kioskSuccessName ? (
          <Paper sx={{ p: 5, borderRadius: 4, textAlign: 'center', maxWidth: 480, width: '100%' }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 96, mb: 2 }} />
            <Typography variant="h4" fontWeight={700}>{kioskSuccessName}</Typography>
            <Typography variant="h6" color="text.secondary">Sikeresen érkeztetve</Typography>
          </Paper>
        ) : previewPerson ? (
          <Paper sx={{ p: 4, borderRadius: 4, maxWidth: 480, width: '100%' }}>
            <Stack spacing={2}>
              <Typography variant="h5" fontWeight={700} textAlign="center">{previewPerson.full_name}</Typography>
              {previewPerson.special_needs && previewPerson.special_needs.length > 0 && (
                <Alert severity="warning">
                  Egyedi igény: {[...new Set(previewPerson.special_needs.map((n) => specialNeedCategoryLabels[n.category] ?? n.category))].join(', ')}
                </Alert>
              )}
              <Button
                variant="contained"
                color="success"
                size="large"
                startIcon={<CheckCircleIcon />}
                onClick={handleConfirmCheckIn}
                disabled={isBusy}
                sx={{ py: 2, fontSize: '1.25rem' }}
              >
                Érkeztetés megerősítése
              </Button>
              <Button
                variant="text"
                color="inherit"
                onClick={() => {
                  setPreviewPerson(null);
                  setPublicId('');
                }}
              >
                Mégse
              </Button>
            </Stack>
          </Paper>
        ) : (
          <Typography variant="h6" sx={{ opacity: 0.85 }}>Tartsa a QR-kódot a kamera elé…</Typography>
        )}

        <QrScannerDialog
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onDetected={(value) => {
            setScannerOpen(false);
            handleLookup(value);
          }}
        />
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>QR érkeztetés</Typography>
        <Button variant="outlined" startIcon={<TabletMacIcon />} onClick={enterKioskMode}>
          Kioszk mód
        </Button>
      </Stack>

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
                <Typography variant="body2">Telefon: {previewPerson.phone ?? '–'}</Typography>
                <Typography variant="body2">Okmányszám: {previewPerson.id_document_number ?? '–'}</Typography>
                <Typography variant="body2">
                  Státusz: {previewPerson.registration ? registrationStatusLabels[previewPerson.registration.status] : '–'}
                </Typography>
                {previewPerson.special_needs && previewPerson.special_needs.length > 0 && (
                  <Box>
                    <Typography variant="body2" fontWeight={700}>Egyedi igények:</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.5 }}>
                      {previewPerson.special_needs.map((n) => (
                        <Chip
                          key={n.id}
                          icon={<SpecialNeedIcon category={n.category} needType={n.type} needDescription={n.description} fontSize="small" />}
                          label={specialNeedDetailLabel(n)}
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
                <TextField
                  label="Ágy/szoba/szektor azonosító (opcionális)"
                  value={bedLabel}
                  onChange={(e) => setBedLabel(e.target.value)}
                  placeholder="pl. A terem, 12. ágy"
                  size="small"
                  fullWidth
                />
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
