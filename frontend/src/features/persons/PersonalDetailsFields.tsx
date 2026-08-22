import { useState } from 'react';
import { Grid, TextField, MenuItem } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import type { Municipality } from '../../types';
import { MunicipalityAutocomplete } from '../../components/ui/MunicipalityAutocomplete';

export interface PersonalDetailsValues {
  lastName: string;
  firstName: string;
  birthPlace: string;
  birthDate: Date | null;
  gender: string;
  idDocumentNumber: string;
  municipalityId: number | '';
  street: string;
  houseNumber: string;
  phone: string;
  email: string;
}

export const initialPersonalDetailsValues: PersonalDetailsValues = {
  lastName: '',
  firstName: '',
  birthPlace: '',
  birthDate: null,
  gender: '',
  idDocumentNumber: '',
  municipalityId: '',
  street: '',
  houseNumber: '',
  phone: '',
  email: '',
};

/**
 * A regisztrációs varázsló (helyszíni) és az önkiszolgáló előregisztráció
 * korábban egymástól függetlenül tartotta karban ugyanazt a ~10 mezős
 * személyes adatlapot — ez egyszer már oda vezetett, hogy egy mezőbővítés
 * (központi szállítás/elszállásolás) csak az egyik formba került be. Ez a
 * hook a közös állapotkezelést fogja össze, hogy egy jövőbeli mezőbővítés
 * mindkét helyen automatikusan megjelenjen.
 */
export function usePersonalDetailsForm(initial: PersonalDetailsValues = initialPersonalDetailsValues) {
  const [values, setValues] = useState<PersonalDetailsValues>(initial);

  function setField<K extends keyof PersonalDetailsValues>(key: K, value: PersonalDetailsValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setValues(initialPersonalDetailsValues);
  }

  return { values, setField, reset, toPayloadBase: () => personalDetailsToPayloadBase(values) };
}

/**
 * Ugyanaz a payload-leképezés, mint a hook `toPayloadBase`-je, de egy sima
 * `PersonalDetailsValues` objektumból — olyan helyeken kell, ahol a
 * mezőket NEM a hook, hanem egy tömbös állapot (pl. családi
 * előregisztrációnál, tagonként) tartja karban, így a hook saját
 * `useState`-jét nem lehet többször, dinamikus számban meghívni.
 */
export function personalDetailsToPayloadBase(values: PersonalDetailsValues) {
  return {
    last_name: values.lastName,
    first_name: values.firstName,
    birth_place: values.birthPlace || undefined,
    birth_date: values.birthDate ? format(values.birthDate, 'yyyy-MM-dd') : undefined,
    municipality_id: values.municipalityId as number,
    address_street: values.street || undefined,
    address_house_number: values.houseNumber || undefined,
    phone: values.phone || undefined,
    email: values.email || undefined,
    ...(values.gender ? { gender: values.gender } : {}),
    ...(values.idDocumentNumber ? { id_document_number: values.idDocumentNumber } : {}),
  };
}

interface PersonalDetailsFieldsProps {
  values: PersonalDetailsValues;
  setField: <K extends keyof PersonalDetailsValues>(key: K, value: PersonalDetailsValues[K]) => void;
  municipalities: Municipality[];
  idDocumentNumberLabel?: string;
}

/**
 * A személyes adatok űrlapszekció (név, nem, születési adatok, okmányszám,
 * település, cím, elérhetőség) — a helyszíni regisztrációs varázsló és az
 * önkiszolgáló előregisztráció is ezt jeleníti meg, hogy a két felület ne
 * tudjon egymástól függetlenül szétdriftelni.
 */
export function PersonalDetailsFields({ values, setField, municipalities, idDocumentNumberLabel = 'Okmányszám' }: PersonalDetailsFieldsProps) {
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <TextField label="Vezetéknév" required fullWidth value={values.lastName} onChange={(e) => setField('lastName', e.target.value)} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <TextField label="Keresztnév" required fullWidth value={values.firstName} onChange={(e) => setField('firstName', e.target.value)} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <TextField select label="Nem" fullWidth value={values.gender} onChange={(e) => setField('gender', e.target.value)}>
          <MenuItem value="">Nincs megadva</MenuItem>
          <MenuItem value="male">Férfi</MenuItem>
          <MenuItem value="female">Nő</MenuItem>
          <MenuItem value="other">Egyéb</MenuItem>
        </TextField>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <TextField label="Születési hely" fullWidth value={values.birthPlace} onChange={(e) => setField('birthPlace', e.target.value)} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <DatePicker
          label="Születési idő"
          value={values.birthDate}
          onChange={(date) => setField('birthDate', date)}
          format="yyyy.MM.dd"
          disableFuture
          slotProps={{ textField: { fullWidth: true } }}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <TextField label={idDocumentNumberLabel} fullWidth value={values.idDocumentNumber} onChange={(e) => setField('idDocumentNumber', e.target.value)} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <MunicipalityAutocomplete
          municipalities={municipalities}
          value={values.municipalityId}
          onChange={(id) => setField('municipalityId', id)}
          required
          sx={{ width: '100%' }}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <TextField label="Utca" fullWidth value={values.street} onChange={(e) => setField('street', e.target.value)} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <TextField label="Házszám" fullWidth value={values.houseNumber} onChange={(e) => setField('houseNumber', e.target.value)} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <TextField label="Telefon" fullWidth value={values.phone} onChange={(e) => setField('phone', e.target.value)} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <TextField label="E-mail" type="email" fullWidth value={values.email} onChange={(e) => setField('email', e.target.value)} />
      </Grid>
    </Grid>
  );
}
