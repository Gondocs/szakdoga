import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Stack,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  TextField,
  MenuItem,
  Alert,
} from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import EditIcon from '@mui/icons-material/Edit';
import PetsIcon from '@mui/icons-material/Pets';
import HistoryIcon from '@mui/icons-material/History';
import GroupsIcon from '@mui/icons-material/Groups';
import WorkHistoryIcon from '@mui/icons-material/WorkHistory';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'react-toastify';
import type { CareEvent, CareEventCategory, CheckInRecord, Person, QrDeliveryMethod, QrTokenData, RegistrationStatus } from '../../types';
import {
  createCareEvent,
  deletePersonDocumentPhoto,
  deliverQrToken,
  fetchCareEvents,
  fetchPerson,
  issueQrToken,
  temporaryLeave,
  temporaryReturn,
  updateRegistrationStatus,
  uploadPersonDocumentPhoto,
  type DocumentPhotoSide,
} from '../../lib/api/endpoints';
import { registrationStatusLabels } from '../../constants/registrationStatus';
import { specialNeedDetailLabel } from '../../constants/specialNeeds';
import { SpecialNeedIcon } from '../../components/ui/SpecialNeedIcon';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { IdCardDialog } from '../../components/IdCardDialog';
import PrintIcon from '@mui/icons-material/Print';
import { EditPersonDialog } from './EditPersonDialog';
import { TransferShelterDialog } from './TransferShelterDialog';
import { BedLabelDialog } from './BedLabelDialog';
import { StatusHistoryDialog } from './StatusHistoryDialog';
import { CitizenHistoryDialog } from './CitizenHistoryDialog';

const genderLabels: Record<string, string> = { male: 'Férfi', female: 'Nő', other: 'Egyéb' };

const careEventCategoryLabels: Record<CareEventCategory, string> = {
  meal: 'Étkezés',
  aid_package: 'Segélycsomag',
  medical: 'Orvosi ellátás',
  hygiene: 'Tisztálkodás',
  other: 'Egyéb',
};

const qrDeliveryLabels: Record<QrDeliveryMethod, string> = {
  digital: 'Digitális (mobil)',
  card: 'Nyomtatott kártya',
  wristband: 'Karszalag',
  paper: 'Nyomtatott igazolás',
};

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
      <Typography variant="body1">{value || '–'}</Typography>
    </Box>
  );
}

export function PersonDetailPage() {
  const { personId } = useParams<{ personId: string }>();
  const navigate = useNavigate();
  const [person, setPerson] = useState<Person | null>(null);
  const [qr, setQr] = useState<QrTokenData | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [pendingLostQr, setPendingLostQr] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [pendingCancelStatus, setPendingCancelStatus] = useState(false);
  const [citizenHistoryOpen, setCitizenHistoryOpen] = useState(false);
  const [idCardOpen, setIdCardOpen] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isDelivering, setIsDelivering] = useState(false);
  const [careEvents, setCareEvents] = useState<CareEvent[]>([]);
  const [careCategory, setCareCategory] = useState<CareEventCategory>('meal');
  const [careNote, setCareNote] = useState('');
  const [isAddingCareEvent, setIsAddingCareEvent] = useState(false);
  const [lastCheckIn, setLastCheckIn] = useState<CheckInRecord | null>(null);
  const [isTogglingLeave, setIsTogglingLeave] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [bedLabelOpen, setBedLabelOpen] = useState(false);

  function reload() {
    if (!personId) return;
    fetchPerson(personId).then(setPerson);
    fetchCareEvents(personId).then(setCareEvents);
  }

  useEffect(reload, [personId]);

  async function handleAddCareEvent() {
    if (!personId) return;
    setIsAddingCareEvent(true);
    try {
      const created = await createCareEvent(personId, { category: careCategory, note: careNote.trim() || undefined });
      setCareEvents((prev) => [created, ...prev]);
      setCareNote('');
      toast.success('Ellátási esemény rögzítve.');
    } catch {
      toast.error('Az ellátási esemény rögzítése nem sikerült.');
    } finally {
      setIsAddingCareEvent(false);
    }
  }

  async function handleDeliverQr(method: QrDeliveryMethod) {
    if (!qr) return;
    setIsDelivering(true);
    try {
      const updated = await deliverQrToken(qr.id, method);
      setQr(updated);
      toast.success('QR-kód kiosztása rögzítve.');
    } catch {
      toast.error('A kiosztás rögzítése nem sikerült.');
    } finally {
      setIsDelivering(false);
    }
  }

  async function handleIssueQr(reason?: 'lost') {
    if (!personId) return;
    setIsIssuing(true);
    try {
      const token = await issueQrToken(personId, reason);
      setQr(token);
      toast.success(reason === 'lost' ? 'Elveszett kód bejelentve, új kód generálva.' : 'QR-kód sikeresen generálva.');
    } catch {
      toast.error('A QR-kód generálása nem sikerült (lehet, hogy az esemény nem aktív).');
    } finally {
      setIsIssuing(false);
      setPendingLostQr(false);
    }
  }

  async function applyStatusChange(newStatus: RegistrationStatus) {
    if (!person?.registration) return;
    setIsChangingStatus(true);
    try {
      await updateRegistrationStatus(person.registration.id, newStatus);
      toast.success('Státusz frissítve.');
      reload();
    } catch {
      toast.error('A státuszváltás nem sikerült.');
    } finally {
      setIsChangingStatus(false);
    }
  }

  function handleStatusChange(newStatus: RegistrationStatus) {
    if (newStatus === 'cancelled') {
      setPendingCancelStatus(true);
      return;
    }
    applyStatusChange(newStatus);
  }

  async function handleUploadDocumentPhoto(file: File, side: DocumentPhotoSide) {
    if (!personId) return;
    setIsUploadingPhoto(true);
    try {
      const updated = await uploadPersonDocumentPhoto(personId, file, side);
      setPerson(updated);
      toast.success(side === 'front' ? 'Okmány elülső oldala rögzítve.' : 'Okmány hátulja rögzítve.');
    } catch {
      toast.error('A fénykép feltöltése nem sikerült.');
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleDeleteDocumentPhoto(side: DocumentPhotoSide) {
    if (!personId) return;
    setIsUploadingPhoto(true);
    try {
      const updated = await deletePersonDocumentPhoto(personId, side);
      setPerson(updated);
      toast.success('Okmányfénykép törölve.');
    } catch {
      toast.error('A fénykép törlése nem sikerült.');
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleTemporaryLeave() {
    if (!personId) return;
    setIsTogglingLeave(true);
    try {
      const checkIn = await temporaryLeave(personId);
      setLastCheckIn(checkIn);
      toast.success('Ideiglenes eltávozás rögzítve.');
    } catch {
      toast.error('A rögzítés nem sikerült.');
    } finally {
      setIsTogglingLeave(false);
    }
  }

  async function handleTemporaryReturn() {
    if (!personId) return;
    setIsTogglingLeave(true);
    try {
      const checkIn = await temporaryReturn(personId);
      setLastCheckIn(checkIn);
      toast.success('Visszaérkezés rögzítve.');
    } catch {
      toast.error('A rögzítés nem sikerült.');
    } finally {
      setIsTogglingLeave(false);
    }
  }

  if (!person) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>{person.full_name}</Typography>
        {person.registration?.channel && (
          <Chip
            size="small"
            label={person.registration.channel === 'self_service' ? 'Önkiszolgáló regisztráció' : 'Hatósági regisztráció'}
            color={person.registration.channel === 'self_service' ? 'secondary' : 'default'}
            variant="outlined"
          />
        )}
        <Tooltip title="Adatok szerkesztése">
          <IconButton onClick={() => setEditOpen(true)} size="small"><EditIcon fontSize="small" /></IconButton>
        </Tooltip>
        <Tooltip title="Státusztörténet">
          <IconButton onClick={() => setHistoryOpen(true)} size="small"><HistoryIcon fontSize="small" /></IconButton>
        </Tooltip>
        {person.citizen_id && (
          <Tooltip title="Korábbi kitelepítések">
            <IconButton onClick={() => setCitizenHistoryOpen(true)} size="small"><WorkHistoryIcon fontSize="small" /></IconButton>
          </Tooltip>
        )}
        {person.family_id && (
          <Tooltip title="Család megtekintése">
            <Chip
              size="small"
              variant="outlined"
              color="secondary"
              icon={<GroupsIcon fontSize="small" />}
              label={person.family?.family_code ?? 'Család'}
              onClick={() => navigate(`/csaladok/${person.family_id}`)}
            />
          </Tooltip>
        )}
      </Stack>

      {person.data_masked && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Az Ön szerepköre miatt egyes érzékeny adatok (okmányadatok és/vagy elérhetőségi adatok) el vannak rejtve.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <InfoField label="Születési hely/idő" value={`${person.birth_place ?? '–'} / ${person.birth_date ?? '–'}`} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <InfoField label="Nem" value={person.gender ? genderLabels[person.gender] : '–'} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <InfoField label="Okmányszám" value={person.id_document_number ?? '–'} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <InfoField label="Település" value={person.municipality?.name ?? '–'} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 6 }}>
            <InfoField
              label="Cím"
              value={[person.address.postal_code, person.address.settlement, person.address.street, person.address.house_number]
                .filter(Boolean).join(', ')}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <InfoField label="Telefon" value={person.phone ?? '–'} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <InfoField label="E-mail" value={person.email ?? '–'} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <InfoField
              label="Kér központi szállítást"
              value={person.registration?.central_transport_required ? 'Igen' : 'Nem'}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <InfoField
              label="Kér elszállásolást"
              value={person.registration?.central_accommodation_required ? 'Igen' : 'Nem'}
            />
          </Grid>
          {person.registration?.own_vehicle && (
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <InfoField
                label="Saját jármű - megérkezés"
                value={
                  person.registration.self_arrival_confirmed_at
                    ? new Date(person.registration.self_arrival_confirmed_at).toLocaleString('hu-HU')
                    : 'Még nincs megerősítve'
                }
              />
            </Grid>
          )}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="caption" color="text.secondary" display="block">Regisztráció státusza</Typography>
            {person.registration ? (
              <TextField
                select
                size="small"
                variant="standard"
                value={person.registration.status}
                disabled={isChangingStatus}
                onChange={(e) => handleStatusChange(e.target.value as RegistrationStatus)}
                sx={{ minWidth: 180 }}
              >
                {Object.entries(registrationStatusLabels).map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </TextField>
            ) : '–'}
          </Grid>
        </Grid>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Okmányfénykép</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Helyszíni regisztrációkor kamerával vagy fájlfeltöltéssel rögzíthető az igazolvány eleje és hátulja külön-külön (tárolás céljából, nem OCR-felismeréshez).
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Elülső oldal</Typography>
            {person.document_photo_front_url && (
              <Box
                component="img"
                src={person.document_photo_front_url}
                alt="Okmány elülső oldala"
                sx={{ maxWidth: '100%', maxHeight: 220, borderRadius: 1, display: 'block', mb: 1.5, border: '1px solid', borderColor: 'divider' }}
              />
            )}
            <Stack direction="row" spacing={1}>
              <Button component="label" size="small" variant="outlined" startIcon={<PhotoCameraIcon />} disabled={isUploadingPhoto}>
                {person.document_photo_front_url ? 'Csere' : 'Rögzítés'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) handleUploadDocumentPhoto(file, 'front');
                  }}
                />
              </Button>
              {person.document_photo_front_url && (
                <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDeleteDocumentPhoto('front')} disabled={isUploadingPhoto}>
                  Törlés
                </Button>
              )}
            </Stack>
          </Box>

          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Hátsó oldal</Typography>
            {person.document_photo_back_url && (
              <Box
                component="img"
                src={person.document_photo_back_url}
                alt="Okmány hátsó oldala"
                sx={{ maxWidth: '100%', maxHeight: 220, borderRadius: 1, display: 'block', mb: 1.5, border: '1px solid', borderColor: 'divider' }}
              />
            )}
            <Stack direction="row" spacing={1}>
              <Button component="label" size="small" variant="outlined" startIcon={<PhotoCameraIcon />} disabled={isUploadingPhoto}>
                {person.document_photo_back_url ? 'Csere' : 'Rögzítés'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) handleUploadDocumentPhoto(file, 'back');
                  }}
                />
              </Button>
              {person.document_photo_back_url && (
                <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDeleteDocumentPhoto('back')} disabled={isUploadingPhoto}>
                  Törlés
                </Button>
              )}
            </Stack>
          </Box>
        </Stack>
      </Paper>

      {person.special_needs && person.special_needs.length > 0 && (
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Speciális igények</Typography>
          <List dense>
            {person.special_needs.map((need) => (
              <ListItem key={need.id} disableGutters>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <SpecialNeedIcon category={need.category} needType={need.type} needDescription={need.description} color="secondary" />
                </ListItemIcon>
                <ListItemText
                  primary={specialNeedDetailLabel(need)}
                  secondary={need.description ?? `Prioritás: ${need.priority}`}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {person.animals && person.animals.length > 0 && (
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <PetsIcon fontSize="small" color="secondary" />
            <Typography variant="h6" fontWeight={700}>Állatok</Typography>
          </Stack>
          <List dense>
            {person.animals.map((animal) => (
              <ListItem key={animal.id} disableGutters>
                <ListItemText
                  primary={`${animal.animal_type} (${animal.count} db)`}
                  secondary={animal.stays_at_address ? 'A lakóhelyen marad' : 'A tulajdonossal együtt utazik'}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {person.registration?.status === 'arrived_shelter' && (
        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Befogadóhelyi mozgás</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Ideiglenes eltávozás/visszaérkezés rögzítése, vagy áthelyezés másik befogadóhelyre.
          </Typography>
          {lastCheckIn?.temporary_leave_at && !lastCheckIn?.temporary_return_at && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Ideiglenesen eltávozott: {new Date(lastCheckIn.temporary_leave_at).toLocaleString('hu-HU')}
            </Alert>
          )}
          <Typography variant="body2" sx={{ mb: 2 }}>
            Ágy/szoba/szektor: <strong>{lastCheckIn?.bed_label || '– nincs megadva –'}</strong>
            <Button size="small" onClick={() => setBedLabelOpen(true)} sx={{ ml: 1 }}>
              Szerkesztés
            </Button>
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              variant="outlined"
              disabled={isTogglingLeave}
              onClick={handleTemporaryLeave}
            >
              Ideiglenes eltávozás
            </Button>
            <Button
              variant="outlined"
              disabled={isTogglingLeave}
              onClick={handleTemporaryReturn}
            >
              Visszaérkezés
            </Button>
            <Button variant="outlined" color="secondary" onClick={() => setTransferOpen(true)}>
              Áthelyezés másik befogadóhelyre
            </Button>
          </Stack>
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Ellátási események</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Befogadóhelyen nyújtott ellátás rögzítése: étkezés, segélycsomag, orvosi ellátás, tisztálkodás.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
          <TextField
            select
            size="small"
            label="Kategória"
            value={careCategory}
            onChange={(e) => setCareCategory(e.target.value as CareEventCategory)}
            sx={{ minWidth: 180 }}
          >
            {Object.entries(careEventCategoryLabels).map(([value, label]) => (
              <MenuItem key={value} value={value}>{label}</MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Megjegyzés (opcionális)"
            value={careNote}
            onChange={(e) => setCareNote(e.target.value)}
            fullWidth
          />
          <Button variant="contained" onClick={handleAddCareEvent} disabled={isAddingCareEvent} sx={{ flexShrink: 0 }}>
            {isAddingCareEvent ? 'Rögzítés…' : 'Rögzítés'}
          </Button>
        </Stack>
        {careEvents.length > 0 ? (
          <List dense>
            {careEvents.map((ce) => (
              <ListItem key={ce.id} disableGutters>
                <ListItemText
                  primary={`${careEventCategoryLabels[ce.category]}${ce.note ? ` – ${ce.note}` : ''}`}
                  secondary={`${new Date(ce.recorded_at).toLocaleString('hu-HU')}${ce.shelter ? ` · ${ce.shelter.name}` : ''}${ce.recorded_by ? ` · ${ce.recorded_by}` : ''}`}
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography variant="body2" color="text.secondary">Még nincs rögzített ellátási esemény.</Typography>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>QR-kód</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          A QR-kód csak egy nem kitalálható azonosítót tartalmaz, személyes adatot nem.
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            variant="contained"
            startIcon={<QrCode2Icon />}
            onClick={() => handleIssueQr()}
            disabled={isIssuing}
          >
            {isIssuing ? 'Generálás…' : 'QR-kód generálása / újragenerálása'}
          </Button>
          {qr && (
            <Button
              variant="outlined"
              color="warning"
              startIcon={<WarningAmberIcon />}
              onClick={() => setPendingLostQr(true)}
              disabled={isIssuing}
            >
              Elveszett kód bejelentése
            </Button>
          )}
        </Stack>
        <ConfirmDialog
          open={pendingLostQr}
          title="Elveszett kód bejelentése"
          description="A jelenlegi kód azonnal érvénytelenné válik, és a rendszer újat generál. Ezt az eseményt a műveleti napló elveszettként, kiemelten rögzíti."
          confirmLabel="Bejelentés és új kód generálása"
          severity="warning"
          isSubmitting={isIssuing}
          onCancel={() => setPendingLostQr(false)}
          onConfirm={() => handleIssueQr('lost')}
        />
        {qr && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'inline-block', p: 1.5, bgcolor: '#fff', borderRadius: 2, mb: 1 }}>
              <QRCodeCanvas value={qr.public_id} size={160} />
            </Box>
            <Typography variant="body2" color="text.secondary">Azonosító (public_id):</Typography>
            <Typography component="code" sx={{ wordBreak: 'break-all', fontFamily: 'monospace', bgcolor: 'action.hover', p: 1, borderRadius: 1, display: 'inline-block', mt: 0.5 }}>
              {qr.public_id}
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => setIdCardOpen(true)}>
                Nyomtatható kártya
              </Button>
            </Box>

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Kiosztási nyilvántartás</Typography>
            {qr.delivered_at ? (
              <Typography variant="body2" color="text.secondary">
                Kiosztva: {qrDeliveryLabels[qr.delivery_method as QrDeliveryMethod]} formában, {new Date(qr.delivered_at).toLocaleString('hu-HU')}
              </Typography>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Még nincs rögzítve, hogy a kódot átadták volna. Jelölje meg az átadás módját:
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {(Object.entries(qrDeliveryLabels) as [QrDeliveryMethod, string][]).map(([value, label]) => (
                    <Button key={value} size="small" variant="outlined" disabled={isDelivering} onClick={() => handleDeliverQr(value)}>
                      {label}
                    </Button>
                  ))}
                </Stack>
              </>
            )}

            {person && (
              <IdCardDialog
                open={idCardOpen}
                onClose={() => setIdCardOpen(false)}
                fullName={person.full_name}
                publicId={qr.public_id}
              />
            )}
          </>
        )}
      </Paper>

      {transferOpen && (
        <TransferShelterDialog
          personId={person.id}
          eventId={person.event_id}
          currentShelterId={person.current_shelter?.id}
          onClose={() => setTransferOpen(false)}
          onTransferred={(checkIn) => {
            setLastCheckIn(checkIn);
            setTransferOpen(false);
            reload();
          }}
        />
      )}

      {bedLabelOpen && (
        <BedLabelDialog
          personId={person.id}
          initialBedLabel={lastCheckIn?.bed_label ?? ''}
          onClose={() => setBedLabelOpen(false)}
          onSaved={(checkIn) => {
            setLastCheckIn(checkIn);
            setBedLabelOpen(false);
          }}
        />
      )}

      {editOpen && (
        <EditPersonDialog
          person={person}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            reload();
          }}
        />
      )}

      {historyOpen && (
        <StatusHistoryDialog personId={person.id} onClose={() => setHistoryOpen(false)} />
      )}

      {citizenHistoryOpen && person.citizen_id && (
        <CitizenHistoryDialog
          citizenId={person.citizen_id}
          currentPersonId={person.id}
          onClose={() => setCitizenHistoryOpen(false)}
          onNavigateToPerson={(id) => {
            setCitizenHistoryOpen(false);
            navigate(`/szemelyek/${id}`);
          }}
        />
      )}

      <ConfirmDialog
        open={pendingCancelStatus}
        title="Regisztráció törlése"
        description={`Biztosan törölt státuszúra állítja ${person.full_name} regisztrációját? Ez a művelet a naplóban visszakövethető marad, de a személy kikerül az aktív listákból.`}
        confirmLabel="Törlés megerősítése"
        severity="error"
        isSubmitting={isChangingStatus}
        onCancel={() => setPendingCancelStatus(false)}
        onConfirm={async () => {
          await applyStatusChange('cancelled');
          setPendingCancelStatus(false);
        }}
      />
    </Box>
  );
}
