import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Typography, Paper, TextField, MenuItem, Button, Stack, Alert } from '@mui/material';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import { toast } from 'react-toastify';
import type { AssemblyPoint, FamilySummary, Municipality } from '../../types';
import { createPerson, createPersonFamily, fetchAssemblyPoints, fetchFamilies, fetchMunicipalities } from '../../lib/api/endpoints';
import { FamilyMemberForm, makeEmptyMember, memberToPayloadBase, type MemberFormState } from '../persons/FamilyMemberForm';
import { FamilyMemberCard } from '../persons/FamilyMemberCard';

export function RegistrationWizardPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [assemblyPoints, setAssemblyPoints] = useState<AssemblyPoint[]>([]);
  const [families, setFamilies] = useState<FamilySummary[]>([]);

  const [members, setMembers] = useState<MemberFormState[]>([makeEmptyMember()]);
  const [familyChoice, setFamilyChoice] = useState<'none' | 'new' | string>('none');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ id: string; name: string }[] | null>(null);

  useEffect(() => {
    fetchMunicipalities().then(setMunicipalities).catch(() => setMunicipalities([]));
  }, []);

  useEffect(() => {
    if (!eventId) return;
    fetchFamilies(eventId).then(setFamilies).catch(() => setFamilies([]));
    fetchAssemblyPoints(eventId).then(setAssemblyPoints).catch(() => setAssemblyPoints([]));
  }, [eventId, lastCreated]);

  function setMemberField<K extends keyof MemberFormState['values']>(index: number, key: K, value: MemberFormState['values'][K]) {
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, values: { ...m.values, [key]: value } } : m)));
  }

  function updateMember(index: number, patch: Partial<Omit<MemberFormState, 'values'>>) {
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  function addMember() {
    setMembers((prev) => [...prev, makeEmptyMember()]);
  }

  function removeMember(index: number) {
    setMembers((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!eventId || members.some((m) => m.values.municipalityId === '' || (!m.ownVehicle && m.assemblyPointId === ''))) return;
    setIsSubmitting(true);

    try {
      if (members.length === 1) {
        const person = await createPerson(eventId, {
          ...memberToPayloadBase(members[0]),
          municipality_id: members[0].values.municipalityId as number,
          family_id: familyChoice !== 'none' && familyChoice !== 'new' ? familyChoice : null,
          create_new_family: familyChoice === 'new',
          is_primary_contact: familyChoice === 'new',
        });
        toast.success(`${person.full_name} sikeresen regisztrálva.`);
        setLastCreated([{ id: person.id, name: person.full_name }]);
      } else {
        const persons = await createPersonFamily(eventId, {
          family_id: familyChoice !== 'none' && familyChoice !== 'new' ? familyChoice : undefined,
          create_new_family: familyChoice === 'new',
          members: members.map((m) => ({ ...memberToPayloadBase(m), municipality_id: m.values.municipalityId as number })),
        });
        toast.success(`${persons.length} fő sikeresen regisztrálva.`);
        setLastCreated(persons.map((p) => ({ id: p.id, name: p.full_name })));
      }

      setMembers([makeEmptyMember()]);
      setFamilyChoice('none');
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
        <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
          <Stack spacing={1}>
            {lastCreated.map((p) => (
              <Stack key={p.id} direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                <Typography variant="body2"><strong>{p.name}</strong> sikeresen regisztrálva.</Typography>
                <Button size="small" color="inherit" onClick={() => navigate(`/szemelyek/${p.id}`)}>QR-kód</Button>
              </Stack>
            ))}
            <Box>
              <Button size="small" color="inherit" onClick={() => navigate(`/esemenyek/${eventId}/szemelyek`)}>Lista megnyitása</Button>
            </Box>
          </Stack>
        </Alert>
      )}

      <Paper component="form" onSubmit={handleSubmit} variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
        <TextField select label="Családi kapcsolat" fullWidth value={familyChoice} onChange={(e) => setFamilyChoice(e.target.value)} sx={{ mb: 3 }}>
          <MenuItem value="none">Egyedül utazik / nem tartozik családhoz</MenuItem>
          <MenuItem value="new">Új család létrehozása (az 1. családtag lesz a kapcsolattartó)</MenuItem>
          {families.map((f) => (
            <MenuItem key={f.id} value={f.id}>Csatlakozás: {f.family_code} ({f.members_count} fő)</MenuItem>
          ))}
        </TextField>

        <Stack spacing={2.5} sx={{ mb: 2.5 }}>
          {members.map((member, index) => (
            <FamilyMemberCard
              key={index}
              index={index}
              total={members.length}
              primaryContact={members.length > 1 && index === 0 && familyChoice === 'new'}
              onRemove={members.length > 1 ? () => removeMember(index) : undefined}
            >
              <FamilyMemberForm
                member={member}
                setField={(key, value) => setMemberField(index, key, value)}
                onChange={(patch) => updateMember(index, patch)}
                municipalities={municipalities}
                assemblyPoints={assemblyPoints}
                showMedicalCare
                transportDescription="Akkor jelölje, ha a személynek nincs saját járműve, és a hatóság által szervezett busszal/kisbusszal jut el a gyülekezőpontra vagy a befogadóhelyre."
                accommodationDescription="Akkor jelölje, ha a személynek nincs hova mennie, és a hatóság által kijelölt befogadóhelyen fog megszállni a kitelepítés alatt."
              />
            </FamilyMemberCard>
          ))}
        </Stack>

        <Button variant="outlined" startIcon={<PersonAddAlt1Icon />} onClick={addMember} sx={{ mb: 3, borderStyle: 'dashed' }} fullWidth>
          Családtag hozzáadása
        </Button>

        <Button type="submit" variant="contained" size="large" fullWidth disabled={isSubmitting} sx={{ py: 1.5, fontSize: '1rem' }}>
          {isSubmitting
            ? 'Mentés…'
            : members.length === 1
              ? 'Regisztráció rögzítése'
              : `Család regisztrálása (${members.length} fő)`}
        </Button>
      </Paper>
    </Box>
  );
}
