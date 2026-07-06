import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  Grid,
  CircularProgress,
  Avatar,
  Divider,
  Chip,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import ShieldMoonIcon from '@mui/icons-material/ShieldMoon';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import HomeIcon from '@mui/icons-material/Home';
import { toast } from 'react-toastify';
import type { Person } from '../../types';
import { confirmReturn, confirmSelfArrival, fetchSelfProfile, updateSelfProfile } from '../../lib/api/endpoints';
import { SpecialNeedsEditor, type SpecialNeedRow } from '../persons/SpecialNeedsEditor';

const statusLabels: Record<string, string> = {
  registered: 'Regisztrált',
  checked_in_assembly: 'Megjelent a gyülekezőponton',
  in_transport: 'Szállítás alatt',
  arrived_shelter: 'Megérkezett a befogadóhelyre',
  missing: 'Hiányzik',
  left_shelter: 'Befogadóhelyet elhagyta',
  returned_home: 'Visszatelepült',
  cancelled: 'Törölt',
};

export function SelfProfilePage() {
  const { publicId } = useParams<{ publicId: string }>();

  const [person, setPerson] = useState<Person | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [postalCode, setPostalCode] = useState('');
  const [settlement, setSettlement] = useState('');
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [centralTransportRequired, setCentralTransportRequired] = useState(false);
  const [centralAccommodationRequired, setCentralAccommodationRequired] = useState(false);
  const [specialNeeds, setSpecialNeeds] = useState<SpecialNeedRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmingArrival, setIsConfirmingArrival] = useState(false);
  const [isConfirmingReturn, setIsConfirmingReturn] = useState(false);

  function applyPerson(p: Person) {
    setPerson(p);
    setPostalCode(p.address.postal_code ?? '');
    setSettlement(p.address.settlement ?? '');
    setStreet(p.address.street ?? '');
    setHouseNumber(p.address.house_number ?? '');
    setPhone(p.phone ?? '');
    setEmail(p.email ?? '');
    setCentralTransportRequired(p.registration?.central_transport_required ?? false);
    setCentralAccommodationRequired(p.registration?.central_accommodation_required ?? false);
    setSpecialNeeds((p.special_needs ?? []).map((n) => ({ category: n.category, type: n.type ?? '', description: n.description ?? '' })));
  }

  useEffect(() => {
    if (!publicId) return;
    fetchSelfProfile(publicId)
      .then(applyPerson)
      .catch((err: unknown) => {
        const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
        if (code === 'SELF_PROFILE_LOCKED') {
          setLoadError('A regisztráció már lezárult (pl. visszatelepült), így az adatok módosítása nem lehetséges.');
        } else {
          setLoadError('Nincs ilyen azonosítójú regisztráció, vagy a kód már nem érvényes. Ellenőrizze a linket.');
        }
      })
      .finally(() => setIsLoading(false));
  }, [publicId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!publicId) return;
    setIsSubmitting(true);
    try {
      const updated = await updateSelfProfile(publicId, {
        address_postal_code: postalCode || undefined,
        address_settlement: settlement || undefined,
        address_street: street || undefined,
        address_house_number: houseNumber || undefined,
        phone: phone || undefined,
        email: email || undefined,
        central_transport_required: centralTransportRequired,
        central_accommodation_required: centralAccommodationRequired,
        special_needs: specialNeeds.map((row) => ({ category: row.category, type: row.type || undefined, description: row.description || undefined })),
      });
      applyPerson(updated);
      toast.success('Adatai sikeresen frissítve.');
    } catch {
      toast.error('A frissítés nem sikerült. Próbálja meg később újra.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmArrival() {
    if (!publicId) return;
    setIsConfirmingArrival(true);
    try {
      const updated = await confirmSelfArrival(publicId);
      applyPerson(updated);
      toast.success('Megérkezés megerősítve, köszönjük!');
    } catch {
      toast.error('A megerősítés nem sikerült. Próbálja meg később újra.');
    } finally {
      setIsConfirmingArrival(false);
    }
  }

  async function handleConfirmReturn() {
    if (!publicId) return;
    setIsConfirmingReturn(true);
    try {
      const updated = await confirmReturn(publicId);
      applyPerson(updated);
      toast.success('Visszatelepülés megerősítve, köszönjük!');
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === 'REPATRIATION_NOT_AUTHORIZED') {
        toast.error('A lakóhelye települése számára a visszatelepítés még nincs engedélyezve. Kérjük, várjon a hatósági tájékoztatásra.');
      } else {
        toast.error('A megerősítés nem sikerült. Próbálja meg később újra.');
      }
    } finally {
      setIsConfirmingReturn(false);
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loadError || !person) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Alert severity="error" sx={{ maxWidth: 480 }}>{loadError}</Alert>
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
            <Typography variant="h5" fontWeight={700}>{person.full_name}</Typography>
            {person.registration && (
              <Chip size="small" sx={{ mt: 0.5 }} label={statusLabels[person.registration.status] ?? person.registration.status} />
            )}
          </Box>
        </Stack>

        {person.registration?.own_vehicle && (
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
              <DirectionsCarIcon color="primary" />
              <Typography variant="h6" fontWeight={700}>Saját járművel utazik</Typography>
            </Stack>
            {person.registration.self_arrival_confirmed_at ? (
              <Alert severity="success" icon={<CheckCircleIcon fontSize="inherit" />}>
                Megérkezés megerősítve: {new Date(person.registration.self_arrival_confirmed_at).toLocaleString('hu-HU')}
              </Alert>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Amikor megérkezett a választott ideiglenes tartózkodási helyére, kérjük, erősítse meg itt —
                  ez segíti a hatóságokat abban, hogy nyomon kövessék a saját járművel távozók biztonságos
                  megérkezését.
                </Typography>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={handleConfirmArrival}
                  disabled={isConfirmingArrival}
                >
                  {isConfirmingArrival ? 'Megerősítés…' : 'Megérkeztem'}
                </Button>
              </>
            )}
          </Paper>
        )}

        {(person.registration?.status === 'arrived_shelter' || person.registration?.status === 'left_shelter') && (
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
              <HomeIcon color="primary" />
              <Typography variant="h6" fontWeight={700}>Visszatelepülés</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Amikor visszatér lakóhelyére, kérjük, erősítse meg itt. Ez csak akkor lehetséges, ha a hatóság már
              engedélyezte az Ön településére a visszatelepítést.
            </Typography>
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircleIcon />}
              onClick={handleConfirmReturn}
              disabled={isConfirmingReturn}
            >
              {isConfirmingReturn ? 'Megerősítés…' : 'Visszatelepülés megerősítése'}
            </Button>
          </Paper>
        )}

        <Paper component="form" onSubmit={handleSubmit} variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            Itt bármikor frissítheti elérhetőségét és ideiglenes tartózkodási helyét a visszatelepítésig.
            A személyes adatait (név, születési adatok) csak a helyszíni ügyintéző tudja módosítani.
          </Alert>

          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Elérhetőség és ideiglenes cím</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Irányítószám" fullWidth value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField label="Település" fullWidth value={settlement} onChange={(e) => setSettlement(e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField label="Utca" fullWidth value={street} onChange={(e) => setStreet(e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Házszám" fullWidth value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Telefon" fullWidth value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="E-mail" type="email" fullWidth value={email} onChange={(e) => setEmail(e.target.value)} />
            </Grid>
          </Grid>

          <FormControlLabel
            control={<Checkbox checked={centralTransportRequired} onChange={(e) => setCentralTransportRequired(e.target.checked)} />}
            label="Központi szállítást igénylek"
          />
          <FormControlLabel
            control={<Checkbox checked={centralAccommodationRequired} onChange={(e) => setCentralAccommodationRequired(e.target.checked)} />}
            label="Központi elszállásolást igénylek"
          />

          <Divider sx={{ my: 3 }} />

          <Box sx={{ mb: 3 }}>
            <SpecialNeedsEditor rows={specialNeeds} onChange={setSpecialNeeds} />
          </Box>

          <Button type="submit" variant="contained" size="large" fullWidth disabled={isSubmitting}>
            {isSubmitting ? 'Mentés…' : 'Adatok mentése'}
          </Button>
        </Paper>
      </Box>
    </Box>
  );
}
