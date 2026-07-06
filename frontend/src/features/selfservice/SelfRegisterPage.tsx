import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  MenuItem,
  Button,
  Stack,
  Alert,
  Grid,
  CircularProgress,
  Avatar,
  Divider,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import { Link as RouterLink } from 'react-router-dom';
import ShieldMoonIcon from '@mui/icons-material/ShieldMoon';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import PrintIcon from '@mui/icons-material/Print';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'react-toastify';
import type { Municipality } from '../../types';
import {
  fetchPublicEvent,
  fetchPublicMunicipalities,
  selfRegister,
  type PublicEventInfo,
  type SelfRegisterResult,
} from '../../lib/api/endpoints';
import { SpecialNeedsEditor, type SpecialNeedRow } from '../persons/SpecialNeedsEditor';
import { IdCardDialog } from '../../components/IdCardDialog';

export function SelfRegisterPage() {
  const { eventCode } = useParams<{ eventCode: string }>();

  const [event, setEvent] = useState<PublicEventInfo | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);

  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [gender, setGender] = useState('');
  const [idDocumentNumber, setIdDocumentNumber] = useState('');
  const [municipalityId, setMunicipalityId] = useState<number | ''>('');
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [ownVehicle, setOwnVehicle] = useState(false);
  const [specialNeeds, setSpecialNeeds] = useState<SpecialNeedRow[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SelfRegisterResult | null>(null);
  const [idCardOpen, setIdCardOpen] = useState(false);

  useEffect(() => {
    if (!eventCode) return;
    fetchPublicEvent(eventCode)
      .then(setEvent)
      .catch(() => setEventError('Nincs ilyen kódú, jelenleg aktív kitelepítési esemény. Kérjük, ellenőrizze a kapott linket.'));
    fetchPublicMunicipalities().then(setMunicipalities).catch(() => setMunicipalities([]));
  }, [eventCode]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!eventCode || municipalityId === '') return;
    setIsSubmitting(true);
    try {
      const res = await selfRegister(eventCode, {
        last_name: lastName,
        first_name: firstName,
        birth_place: birthPlace || undefined,
        birth_date: birthDate ? format(birthDate, 'yyyy-MM-dd') : undefined,
        gender: gender || undefined,
        id_document_number: idDocumentNumber || undefined,
        municipality_id: municipalityId,
        address_street: street || undefined,
        address_house_number: houseNumber || undefined,
        phone: phone || undefined,
        own_vehicle: ownVehicle,
        special_needs: specialNeeds.length
          ? specialNeeds.map((row) => ({ category: row.category, type: row.type || undefined, description: row.description || undefined }))
          : undefined,
      });
      setResult(res);
      toast.success('Sikeres előregisztráció!');
    } catch {
      toast.error('A regisztráció nem sikerült. Ellenőrizze a kötelező mezőket.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDownloadQr() {
    const canvas = document.getElementById('self-register-qr') as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `kitelepitesi-azonosito-${result?.person_id.slice(0, 8)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  if (eventError) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Alert severity="error" sx={{ maxWidth: 480 }}>{eventError}</Alert>
      </Box>
    );
  }

  if (!event) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', background: 'radial-gradient(circle at top, #fbeceb 0%, #f7f6f5 60%)', py: { xs: 3, sm: 6 }, px: 2 }}>
      <Box sx={{ maxWidth: 720, mx: 'auto' }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
            <ShieldMoonIcon />
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight={700}>Előzetes kitelepítési regisztráció</Typography>
            <Typography variant="body2" color="text.secondary">{event.name} ({event.code})</Typography>
          </Box>
        </Stack>

        {result ? (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
            <Alert severity="success" sx={{ mb: 3, textAlign: 'left' }}>
              <strong>{result.full_name}</strong>, sikeresen előregisztrált. Mentse el vagy nyomtassa ki az
              alábbi QR-kódot — ezt fogják beolvasni a gyülekezőhelyen vagy a befogadóhelyen.
            </Alert>
            <Box sx={{ display: 'inline-block', p: 2, bgcolor: '#fff', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <QRCodeCanvas id="self-register-qr" value={result.public_id} size={220} />
            </Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2, wordBreak: 'break-all' }}>
              Azonosító: {result.public_id}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center" sx={{ mt: 2 }}>
              <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleDownloadQr}>
                QR-kód letöltése
              </Button>
              <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => setIdCardOpen(true)}>
                Nyomtatható kártya
              </Button>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                component={RouterLink}
                to={`/onkiszolgalo/profil/${result.public_id}`}
              >
                Adataim frissítése
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
              Ezt a linket bármikor felkeresheti a visszatelepítésig, hogy frissítse elérhetőségét vagy
              ideiglenes tartózkodási helyét.
            </Typography>
            <IdCardDialog
              open={idCardOpen}
              onClose={() => setIdCardOpen(false)}
              fullName={result.full_name}
              publicId={result.public_id}
              eventName={event.name}
              eventCode={event.code}
            />
          </Paper>
        ) : (
          <Paper component="form" onSubmit={handleSubmit} variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              Ezt az űrlapot még a kitelepítés helyszíni megkezdése előtt töltheti ki. A regisztráció
              után kapott QR-kódot mentse el a telefonjára, vagy nyomtassa ki — a gyülekező- vagy
              befogadóhelyen ezt fogják beolvasni, így Önnek ott már nem kell újra megadnia az adatait.
            </Alert>

            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Személyes adatok</Typography>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Vezetéknév" required fullWidth value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Keresztnév" required fullWidth value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField select label="Nem" fullWidth value={gender} onChange={(e) => setGender(e.target.value)}>
                  <MenuItem value="">Nincs megadva</MenuItem>
                  <MenuItem value="male">Férfi</MenuItem>
                  <MenuItem value="female">Nő</MenuItem>
                  <MenuItem value="other">Egyéb</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="Születési hely" fullWidth value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <DatePicker
                  label="Születési idő"
                  value={birthDate}
                  onChange={setBirthDate}
                  format="yyyy.MM.dd"
                  disableFuture
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Személyazonosító okmány száma" fullWidth value={idDocumentNumber} onChange={(e) => setIdDocumentNumber(e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField select label="Település" required fullWidth value={municipalityId} onChange={(e) => setMunicipalityId(e.target.value ? Number(e.target.value) : '')}>
                  <MenuItem value="">Válasszon…</MenuItem>
                  {municipalities.map((m) => (
                    <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="Utca" fullWidth value={street} onChange={(e) => setStreet(e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="Házszám" fullWidth value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="Telefon" fullWidth value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Grid>
              <Grid size={12}>
                <FormControlLabel
                  control={<Checkbox checked={ownVehicle} onChange={(e) => setOwnVehicle(e.target.checked)} />}
                  label="Saját járművel, magam választotta helyre utazom (nem központi szállítással/befogadóhelyre)"
                />
              </Grid>
            </Grid>

            <Divider sx={{ mb: 3 }} />

            <Box sx={{ mb: 3 }}>
              <SpecialNeedsEditor rows={specialNeeds} onChange={setSpecialNeeds} />
            </Box>

            <Button type="submit" variant="contained" size="large" fullWidth disabled={isSubmitting}>
              {isSubmitting ? 'Mentés…' : 'Előregisztráció és QR-kód igénylése'}
            </Button>
          </Paper>
        )}
      </Box>
    </Box>
  );
}
