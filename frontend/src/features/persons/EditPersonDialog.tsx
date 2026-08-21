import { useEffect, useState, type FormEvent } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Button, Stack, Box } from '@mui/material';
import { toast } from 'react-toastify';
import type { Municipality, Person } from '../../types';
import { fetchMunicipalities, updatePerson, type UpdatePersonPayload } from '../../lib/api/endpoints';
import { MunicipalityAutocomplete } from '../../components/ui/MunicipalityAutocomplete';
import { TransportAccommodationFields } from './TransportAccommodationFields';

export function EditPersonDialog({ person, onClose, onSaved }: { person: Person; onClose: () => void; onSaved: () => void }) {
  const [lastName, setLastName] = useState(person.last_name);
  const [firstName, setFirstName] = useState(person.first_name);
  const [phone, setPhone] = useState(person.phone ?? '');
  const [email, setEmail] = useState(person.email ?? '');
  const [gender, setGender] = useState(person.gender ?? '');
  const [idDocumentNumber, setIdDocumentNumber] = useState(person.id_document_number ?? '');
  const [municipalityId, setMunicipalityId] = useState<number | ''>(person.municipality?.id ?? '');
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [centralTransportRequired, setCentralTransportRequired] = useState(person.registration?.central_transport_required ?? false);
  const [centralAccommodationRequired, setCentralAccommodationRequired] = useState(person.registration?.central_accommodation_required ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchMunicipalities().then(setMunicipalities).catch(() => setMunicipalities([]));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload: UpdatePersonPayload = {
        last_name: lastName,
        first_name: firstName,
        phone: phone || undefined,
        email: email || undefined,
        gender: gender || undefined,
        id_document_number: idDocumentNumber || undefined,
        ...(municipalityId !== '' ? { municipality_id: municipalityId } : {}),
        central_transport_required: centralTransportRequired,
        central_accommodation_required: centralAccommodationRequired,
      };
      await updatePerson(person.id, payload);
      toast.success('Adatok frissítve.');
      onSaved();
    } catch {
      toast.error('A mentés nem sikerült (lehet, hogy az esemény már lezárt).');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>Adatok szerkesztése</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Vezetéknév" required fullWidth value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <TextField label="Keresztnév" required fullWidth value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <TextField select label="Nem" fullWidth value={gender} onChange={(e) => setGender(e.target.value)}>
              <MenuItem value="">Nincs megadva</MenuItem>
              <MenuItem value="male">Férfi</MenuItem>
              <MenuItem value="female">Nő</MenuItem>
              <MenuItem value="other">Egyéb</MenuItem>
            </TextField>
            <TextField label="Okmányszám" fullWidth value={idDocumentNumber} onChange={(e) => setIdDocumentNumber(e.target.value)} />
            <MunicipalityAutocomplete municipalities={municipalities} value={municipalityId} onChange={setMunicipalityId} sx={{ width: '100%' }} />
            <TextField label="Telefon" fullWidth value={phone} onChange={(e) => setPhone(e.target.value)} />
            <TextField label="E-mail" type="email" fullWidth value={email} onChange={(e) => setEmail(e.target.value)} />
            <TransportAccommodationFields
              centralTransportRequired={centralTransportRequired}
              onCentralTransportRequiredChange={setCentralTransportRequired}
              centralAccommodationRequired={centralAccommodationRequired}
              onCentralAccommodationRequiredChange={setCentralAccommodationRequired}
              transportLabel="Kér központi szállítást"
              accommodationLabel="Kér elszállásolást"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} color="inherit">Mégse</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Mentés…' : 'Mentés'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
