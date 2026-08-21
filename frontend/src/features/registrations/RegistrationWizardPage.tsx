import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Button,
  Stack,
  Alert,
  Divider,
} from '@mui/material';
import { toast } from 'react-toastify';
import type { FamilySummary, Municipality } from '../../types';
import { createPerson, fetchFamilies, fetchMunicipalities } from '../../lib/api/endpoints';
import { SpecialNeedsEditor, type SpecialNeedRow } from '../persons/SpecialNeedsEditor';
import { PersonalDetailsFields, usePersonalDetailsForm } from '../persons/PersonalDetailsFields';
import { TransportAccommodationFields } from '../persons/TransportAccommodationFields';

export function RegistrationWizardPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [families, setFamilies] = useState<FamilySummary[]>([]);

  const { values, setField, reset, toPayloadBase } = usePersonalDetailsForm();

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
    if (!eventId || values.municipalityId === '') return;
    setIsSubmitting(true);

    try {
      const person = await createPerson(eventId, {
        ...toPayloadBase(),
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
      });

      toast.success(`${person.full_name} sikeresen regisztrálva.`);
      setLastCreated({ id: person.id, name: person.full_name });
      reset();
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
        <Box sx={{ mb: 3 }}>
          <PersonalDetailsFields values={values} setField={setField} municipalities={municipalities} />
        </Box>

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
        <Stack direction="row" flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
          <TransportAccommodationFields
            centralTransportRequired={centralTransport}
            onCentralTransportRequiredChange={setCentralTransport}
            centralAccommodationRequired={centralAccommodation}
            onCentralAccommodationRequiredChange={setCentralAccommodation}
          />
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
