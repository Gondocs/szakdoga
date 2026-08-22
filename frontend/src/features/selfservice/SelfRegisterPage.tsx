import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Alert,
  CircularProgress,
  Avatar,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import ShieldMoonIcon from '@mui/icons-material/ShieldMoon';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import PrintIcon from '@mui/icons-material/Print';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'react-toastify';
import type { Municipality } from '../../types';
import {
  fetchPublicEvent,
  fetchPublicMunicipalities,
  selfRegister,
  selfRegisterFamily,
  type PublicEventInfo,
  type SelfRegisterResult,
} from '../../lib/api/endpoints';
import { FamilyMemberForm, makeEmptyMember, memberToPayloadBase, type MemberFormState } from '../persons/FamilyMemberForm';
import { FamilyMemberCard } from '../persons/FamilyMemberCard';
import { IdCardDialog } from '../../components/IdCardDialog';

export function SelfRegisterPage() {
  const { eventCode } = useParams<{ eventCode: string }>();

  const [event, setEvent] = useState<PublicEventInfo | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);

  const [members, setMembers] = useState<MemberFormState[]>([makeEmptyMember()]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<SelfRegisterResult[] | null>(null);
  const [idCardOpenFor, setIdCardOpenFor] = useState<SelfRegisterResult | null>(null);

  useEffect(() => {
    if (!eventCode) return;
    fetchPublicEvent(eventCode)
      .then(setEvent)
      .catch(() => setEventError('Nincs ilyen kódú, jelenleg aktív kitelepítési esemény. Kérjük, ellenőrizze a kapott linket.'));
    fetchPublicMunicipalities().then(setMunicipalities).catch(() => setMunicipalities([]));
  }, [eventCode]);

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
    if (!eventCode || members.some((m) => m.values.municipalityId === '')) return;
    setIsSubmitting(true);
    try {
      if (members.length === 1) {
        const res = await selfRegister(eventCode, {
          ...memberToPayloadBase(members[0]),
          municipality_id: members[0].values.municipalityId as number,
        });
        setResults([res]);
      } else {
        const res = await selfRegisterFamily(eventCode, {
          members: members.map((m) => ({ ...memberToPayloadBase(m), municipality_id: m.values.municipalityId as number })),
        });
        setResults(res.members);
      }
      toast.success(members.length === 1 ? 'Sikeres előregisztráció!' : 'A család sikeresen előregisztrált!');
    } catch {
      toast.error('A regisztráció nem sikerült. Ellenőrizze a kötelező mezőket.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDownloadQr(result: SelfRegisterResult) {
    const canvas = document.getElementById(`self-register-qr-${result.person_id}`) as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `kitelepitesi-azonosito-${result.person_id.slice(0, 8)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  if (eventError) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Alert severity="error" sx={{ maxWidth: 480, borderRadius: 2 }}>{eventError}</Alert>
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
    <Box sx={{ minHeight: '100vh', background: 'radial-gradient(circle at top, #fbeceb 0%, #f7f6f5 55%)', py: { xs: 3, sm: 6 }, px: 2 }}>
      <Box sx={{ maxWidth: 760, mx: 'auto' }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 52, height: 52, boxShadow: '0 4px 14px rgba(163,23,43,0.28)' }}>
            <ShieldMoonIcon />
          </Avatar>
          <Box>
            <Typography variant="h5" fontWeight={700}>Előzetes kitelepítési regisztráció</Typography>
            <Typography variant="body2" color="text.secondary">{event.name} ({event.code})</Typography>
          </Box>
        </Stack>

        {results ? (
          <Stack spacing={2.5}>
            <Alert severity="success" sx={{ borderRadius: 2 }}>
              {results.length === 1 ? (
                <><strong>{results[0].full_name}</strong> sikeresen előregisztrált.</>
              ) : (
                <>A család mind a(z) <strong>{results.length}</strong> tagja sikeresen előregisztrált.</>
              )}
              {' '}Mentse el vagy nyomtassa ki az alábbi QR-kódo{results.length === 1 ? 't' : 'kat'} — ezt fogják
              beolvasni a gyülekezőhelyen vagy a befogadóhelyen (mindenkinek a saját kódját).
            </Alert>

            {results.map((result) => (
              <Paper key={result.person_id} variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>{result.full_name}</Typography>
                <Box sx={{ display: 'inline-block', p: 2, bgcolor: '#fff', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <QRCodeCanvas id={`self-register-qr-${result.person_id}`} value={result.public_id} size={220} />
                </Box>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2, wordBreak: 'break-all' }}>
                  Azonosító: {result.public_id}
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center" sx={{ mt: 2 }}>
                  <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => handleDownloadQr(result)}>
                    QR-kód letöltése
                  </Button>
                  <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => setIdCardOpenFor(result)}>
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
              </Paper>
            ))}

            <Typography variant="caption" color="text.secondary" display="block" sx={{ textAlign: 'center' }}>
              Ezeket a linkeket bármikor felkereshetik a visszatelepítésig, hogy frissítsék elérhetőségüket vagy
              ideiglenes tartózkodási helyüket.
            </Typography>

            {idCardOpenFor && (
              <IdCardDialog
                open
                onClose={() => setIdCardOpenFor(null)}
                fullName={idCardOpenFor.full_name}
                publicId={idCardOpenFor.public_id}
                eventName={event.name}
                eventCode={event.code}
              />
            )}
          </Stack>
        ) : (
          <Box component="form" onSubmit={handleSubmit}>
            <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
              Ezt az űrlapot még a kitelepítés helyszíni megkezdése előtt töltheti ki. Ha a családjával együtt
              regisztrál, adja hozzá a többi családtagot is — mindenki a saját adataival fog szerepelni, és
              mindenki saját QR-kódot kap, amit a gyülekező- vagy befogadóhelyen beolvasnak. Csak azokat a
              jelölőket kapcsolja be, amelyek Önre (vagy az adott családtagra) igazak — mindegyik alatt egy rövid
              magyarázat is olvasható, hogy melyiket mikor érdemes választani. Ha elakad, egy hozzátartozó vagy
              ismerős is segíthet a kitöltésben.
            </Alert>

            <Stack spacing={2.5} sx={{ mb: 2.5 }}>
              {members.map((member, index) => (
                <FamilyMemberCard
                  key={index}
                  index={index}
                  total={members.length}
                  primaryContact={members.length > 1 && index === 0}
                  onRemove={members.length > 1 ? () => removeMember(index) : undefined}
                >
                  <FamilyMemberForm
                    member={member}
                    setField={(key, value) => setMemberField(index, key, value)}
                    onChange={(patch) => updateMember(index, patch)}
                    municipalities={municipalities}
                    idDocumentNumberLabel="Személyazonosító okmány száma"
                    ownVehicleLabel="Saját járművel, magam választotta helyre utazom (nem központi szállítással/befogadóhelyre)"
                    transportLabel="Központi szállítást igénylek"
                    accommodationLabel="Központi elszállásolást igénylek"
                  />
                </FamilyMemberCard>
              ))}
            </Stack>

            <Button
              variant="outlined"
              startIcon={<PersonAddAlt1Icon />}
              onClick={addMember}
              sx={{ mb: 3, borderStyle: 'dashed' }}
              fullWidth
            >
              Családtag hozzáadása
            </Button>

            <Button type="submit" variant="contained" size="large" fullWidth disabled={isSubmitting} sx={{ py: 1.5, fontSize: '1rem' }}>
              {isSubmitting
                ? 'Mentés…'
                : members.length === 1
                  ? 'Előregisztráció és QR-kód igénylése'
                  : `Család előregisztrációja (${members.length} fő) és QR-kódok igénylése`}
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
}
