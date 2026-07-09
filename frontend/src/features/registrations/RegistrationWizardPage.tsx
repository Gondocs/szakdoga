import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Button,
  Stack,
  Alert,
  Divider,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import type { FamilySummary, Municipality } from '../../types';
import { createPerson, fetchFamilies, fetchMunicipalities } from '../../lib/api/endpoints';
import { SpecialNeedsEditor, type SpecialNeedRow } from '../persons/SpecialNeedsEditor';
import { MunicipalityAutocomplete } from '../../components/ui/MunicipalityAutocomplete';

export function RegistrationWizardPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [families, setFamilies] = useState<FamilySummary[]>([]);

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
  const [email, setEmail] = useState('');

  const [familyChoice, setFamilyChoice] = useState<'none' | 'new' | string>('none');

  const [centralTransport, setCentralTransport] = useState(false);
  const [centralAccommodation, setCentralAccommodation] = useState(false);
  const [medicalCare, setMedicalCare] = useState(false);
  const [ownVehicle, setOwnVehicle] = useState(false);

  const [specialNeeds, setSpecialNeeds] = useState<SpecialNeedRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchMunicipalities().then(setMunicipalities).catch(() => setMunicipalities([]));
  }, []);

  useEffect(() => {
    if (!eventId) return;
    fetchFamilies(eventId).then(setFamilies).catch(() => setFamilies([]));
  }, [eventId, lastCreated]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!eventId || municipalityId === '') return;
    setIsSubmitting(true);

    try {
      const person = await createPerson(eventId, {
        last_name: lastName,
        first_name: firstName,
        birth_place: birthPlace || undefined,
        birth_date: birthDate ? format(birthDate, 'yyyy-MM-dd') : undefined,
        municipality_id: municipalityId,
        address_street: street || undefined,
        address_house_number: houseNumber || undefined,
        phone: phone || undefined,
        email: email || undefined,
        family_id: familyChoice !== 'none' && familyChoice !== 'new' ? familyChoice : null,
        create_new_family: familyChoice === 'new',
        is_primary_contact: familyChoice === 'new',
        central_transport_required: centralTransport,
        central_accommodation_required: centralAccommodation,
        under_regular_medical_care: medicalCare,
        own_vehicle: ownVehicle,
        special_needs: specialNeeds.length
          ? specialNeeds.map((row) => ({ category: row.category, type: row.type || undefined, description: row.description || undefined }))
          : undefined,
        ...(gender ? { gender } : {}),
        ...(idDocumentNumber ? { id_document_number: idDocumentNumber } : {}),
      });

      toast.success(`${person.full_name} sikeresen regisztrálva.`);
      setLastCreated({ id: person.id, name: person.full_name });
      setLastName('');
      setFirstName('');
      setBirthPlace('');
      setBirthDate(null);
      setGender('');
      setIdDocumentNumber('');
      setStreet('');
      setHouseNumber('');
      setPhone('');
      setSpecialNeeds([]);
    } catch {
      toast.error('A regisztráció rögzítése nem sikerült. Ellenőrizze a kötelező mezőket, és hogy az esemény aktív-e.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>Személy/család regisztráció</Typography>

      {lastCreated && (
        <Alert
          severity="success"
          sx={{ mb: 3 }}
          action={
            <Stack direction="row" spacing={1}>
              <Button size="small" color="inherit" onClick={() => navigate(`/szemelyek/${lastCreated.id}`)}>QR-kód</Button>
              <Button size="small" color="inherit" onClick={() => navigate(`/esemenyek/${eventId}/szemelyek`)}>Lista</Button>
            </Stack>
          }
        >
          <strong>{lastCreated.name}</strong> sikeresen regisztrálva.
        </Alert>
      )}

      <Paper component="form" onSubmit={handleSubmit} variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Személyes adatok</Typography>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField label="Vezetéknév" required fullWidth value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField label="Keresztnév" required fullWidth value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField select label="Nem" fullWidth value={gender} onChange={(e) => setGender(e.target.value)}>
              <MenuItem value="">Nincs megadva</MenuItem>
              <MenuItem value="male">Férfi</MenuItem>
              <MenuItem value="female">Nő</MenuItem>
              <MenuItem value="other">Egyéb</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField label="Születési hely" fullWidth value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <DatePicker
              label="Születési idő"
              value={birthDate}
              onChange={setBirthDate}
              format="yyyy.MM.dd"
              disableFuture
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField label="Okmányszám" fullWidth value={idDocumentNumber} onChange={(e) => setIdDocumentNumber(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <MunicipalityAutocomplete municipalities={municipalities} value={municipalityId} onChange={setMunicipalityId} required sx={{ width: '100%' }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField label="Utca" fullWidth value={street} onChange={(e) => setStreet(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField label="Házszám" fullWidth value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField label="Telefon" fullWidth value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField label="E-mail" type="email" fullWidth value={email} onChange={(e) => setEmail(e.target.value)} />
          </Grid>
        </Grid>

        <Divider sx={{ mb: 3 }} />

        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Családi kapcsolat</Typography>
        <TextField select fullWidth value={familyChoice} onChange={(e) => setFamilyChoice(e.target.value)} sx={{ mb: 3 }}>
          <MenuItem value="none">Egyedül utazik</MenuItem>
          <MenuItem value="new">Új család létrehozása (ő lesz a kapcsolattartó)</MenuItem>
          {families.map((f) => (
            <MenuItem key={f.id} value={f.id}>Csatlakozás: {f.family_code} ({f.members_count} fő)</MenuItem>
          ))}
        </TextField>

        <Divider sx={{ mb: 3 }} />

        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Szállítási és ellátási igények</Typography>
        <Stack direction="row" flexWrap="wrap" sx={{ mb: 3 }}>
          <FormControlLabel control={<Checkbox checked={centralTransport} onChange={(e) => setCentralTransport(e.target.checked)} />} label="Központi szállítást igényel" />
          <FormControlLabel control={<Checkbox checked={centralAccommodation} onChange={(e) => setCentralAccommodation(e.target.checked)} />} label="Központi elszállásolást igényel" />
          <FormControlLabel control={<Checkbox checked={medicalCare} onChange={(e) => setMedicalCare(e.target.checked)} />} label="Állandó egészségügyi ellátás alatt áll" />
          <FormControlLabel control={<Checkbox checked={ownVehicle} onChange={(e) => setOwnVehicle(e.target.checked)} />} label="Saját járművel távozik" />
        </Stack>

        <Divider sx={{ mb: 3 }} />

        <Box sx={{ mb: 3 }}>
          <SpecialNeedsEditor rows={specialNeeds} onChange={setSpecialNeeds} />
        </Box>

        <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
          {isSubmitting ? 'Mentés…' : 'Regisztráció rögzítése'}
        </Button>
      </Paper>
    </Box>
  );
}
