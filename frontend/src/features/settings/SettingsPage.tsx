import { useEffect, useState, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Stack,
  TextField,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
  Avatar,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Link,
  Switch,
  FormControlLabel,
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DeleteIcon from '@mui/icons-material/Delete';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import GroupIcon from '@mui/icons-material/Group';
import DescriptionIcon from '@mui/icons-material/Description';
import ShieldMoonIcon from '@mui/icons-material/ShieldMoon';
import { toast } from 'react-toastify';
import { useAuth } from '../auth/AuthContext';
import {
  apiBaseUrl,
  deleteUserAvatar,
  fetchLoginHistory,
  updateProfile,
  updateTwoFactorPreference,
  uploadUserAvatar,
  type LoginHistoryEntry,
} from '../../lib/api/endpoints';
import { useFontScale, type FontScale } from './FontScaleContext';

const fontScaleOptions: { value: FontScale; label: string }[] = [
  { value: 'small', label: 'Kicsi' },
  { value: 'normal', label: 'Normál' },
  { value: 'large', label: 'Nagy' },
  { value: 'extra-large', label: 'Extra nagy' },
];

// A Record kulcsai a LoginHistoryEntry['action'] union minden tagját le
// kell, hogy fedjék — ha a backend új action típust vezet be, itt TS-hiba
// jelzi, hogy ide is meg kell adni a hozzá tartozó ikont/címkét.
const loginHistoryMeta: Record<LoginHistoryEntry['action'], { label: string; icon: React.ReactNode; color: string }> = {
  login: { label: 'Sikeres bejelentkezés', icon: <LoginIcon fontSize="small" />, color: 'success.main' },
  logout: { label: 'Kijelentkezés', icon: <LogoutIcon fontSize="small" />, color: 'text.secondary' },
  login_failed: { label: 'Sikertelen bejelentkezési kísérlet', icon: <WarningAmberIcon fontSize="small" />, color: 'error.main' },
  two_factor_sent: { label: 'Kétfaktoros kód kiküldve', icon: <ShieldMoonIcon fontSize="small" />, color: 'text.secondary' },
  login_2fa_failed: { label: 'Sikertelen kétfaktoros kód', icon: <WarningAmberIcon fontSize="small" />, color: 'error.main' },
  two_factor_enabled: { label: 'Kétfaktoros hitelesítés bekapcsolva', icon: <ShieldMoonIcon fontSize="small" />, color: 'success.main' },
  two_factor_disabled: { label: 'Kétfaktoros hitelesítés kikapcsolva', icon: <ShieldMoonIcon fontSize="small" />, color: 'warning.main' },
};

export function SettingsPage() {
  const { user, setUser } = useAuth();
  const { fontScale, setFontScale } = useFontScale();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isTogglingTwoFactor, setIsTogglingTwoFactor] = useState(false);

  useEffect(() => {
    fetchLoginHistory().then(setLoginHistory).catch(() => setLoginHistory([])).finally(() => setIsLoadingHistory(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await updateProfile({
        name,
        email,
        password: password || undefined,
        current_password: currentPassword || undefined,
      });
      setUser(updated);
      setPassword('');
      setCurrentPassword('');
      toast.success('Profil frissítve.');
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const currentPasswordError = apiError?.response?.data?.errors?.current_password?.[0];
      toast.error(currentPasswordError ?? apiError?.response?.data?.message ?? 'A mentés nem sikerült.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAvatarUpload(file: File) {
    if (!user) return;
    setIsUploadingAvatar(true);
    try {
      const updated = await uploadUserAvatar(user.id, file);
      setUser(updated);
      toast.success('Profilkép frissítve.');
    } catch {
      toast.error('A profilkép feltöltése nem sikerült.');
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  // A 2FA-kapcsoló azonnal, a profilűrlaptól függetlenül alkalmazódik —
  // ez egy önálló biztonsági beállítás, nem kell hozzá a "Mentés" gomb.
  async function handleTwoFactorToggle(enabled: boolean) {
    setIsTogglingTwoFactor(true);
    try {
      const updated = await updateTwoFactorPreference(enabled);
      setUser(updated);
      toast.success(enabled ? 'Kétfaktoros hitelesítés bekapcsolva.' : 'Kétfaktoros hitelesítés kikapcsolva.');
    } catch {
      toast.error('A beállítás mentése nem sikerült.');
    } finally {
      setIsTogglingTwoFactor(false);
    }
  }

  async function handleAvatarDelete() {
    if (!user) return;
    setIsUploadingAvatar(true);
    try {
      const updated = await deleteUserAvatar(user.id);
      setUser(updated);
      toast.success('Profilkép eltávolítva.');
    } catch {
      toast.error('A profilkép eltávolítása nem sikerült.');
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  const canViewAuditLog = user?.role?.code === 'admin' || user?.role?.code === 'manager' || user?.role?.code === 'auditor';
  const isAdmin = user?.role?.code === 'admin';

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>Beállítások</Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="flex-start">
        <Stack spacing={3} sx={{ flex: 2, width: '100%', maxWidth: 640 }}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Megjelenés</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              A betűméret módosítása az egész alkalmazásra vonatkozik, és a böngészőben tárolódik.
            </Typography>
            <ToggleButtonGroup
              value={fontScale}
              exclusive
              onChange={(_, value) => value && setFontScale(value)}
              size="small"
            >
              {fontScaleOptions.map((opt) => (
                <ToggleButton key={opt.value} value={opt.value}>
                  {opt.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Fiókom</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Név és e-mail cím módosítása. E-mail cím vagy jelszó módosításához adja meg jelenlegi jelszavát.
            </Typography>

            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
              <Avatar src={user?.avatar_url ?? undefined} sx={{ width: 64, height: 64, bgcolor: 'secondary.main', fontSize: '1.5rem' }}>
                {user?.name?.[0]?.toUpperCase()}
              </Avatar>
              <Stack direction="row" spacing={1}>
                <Tooltip title="Profilkép módosítása">
                  <IconButton component="label" disabled={isUploadingAvatar}>
                    <PhotoCameraIcon />
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAvatarUpload(file);
                        e.target.value = '';
                      }}
                    />
                  </IconButton>
                </Tooltip>
                {user?.avatar_url && (
                  <Tooltip title="Profilkép eltávolítása">
                    <IconButton onClick={handleAvatarDelete} disabled={isUploadingAvatar} color="error">
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </Stack>

            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField label="Név" fullWidth value={name} onChange={(e) => setName(e.target.value)} required />
                <TextField label="E-mail" type="email" fullWidth value={email} onChange={(e) => setEmail(e.target.value)} required />
                <Divider />
                <TextField
                  label="Új jelszó (opcionális)"
                  type="password"
                  fullWidth
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  helperText="Hagyja üresen, ha nem szeretné módosítani."
                />
                <TextField
                  label="Jelenlegi jelszó"
                  type="password"
                  fullWidth
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  helperText="Csak e-mail cím vagy jelszó módosításakor szükséges."
                />
                <Button type="submit" variant="contained" disabled={isSaving} sx={{ alignSelf: 'flex-start' }}>
                  {isSaving ? 'Mentés…' : 'Mentés'}
                </Button>
              </Stack>
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Kétfaktoros hitelesítés</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Bejelentkezéskor e-mailben kiküldött kód megadását kéri. Kikapcsolva a jelszó megadása után
              azonnal bejelentkezik — ezt elsősorban fejlesztés/tesztelés közbeni kényelemre ajánlott
              kikapcsolni, egyébként hagyja bekapcsolva.
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={user?.two_factor_enabled ?? true}
                  disabled={isTogglingTwoFactor}
                  onChange={(e) => handleTwoFactorToggle(e.target.checked)}
                />
              }
              label={user?.two_factor_enabled ?? true ? 'Bekapcsolva' : 'Kikapcsolva'}
            />
          </Paper>
        </Stack>

        <Stack spacing={3} sx={{ flex: 1, width: '100%', maxWidth: { xs: '100%', md: 420 } }}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Legutóbbi bejelentkezéseim</Typography>
            {isLoadingHistory ? (
              <Typography variant="body2" color="text.secondary">Betöltés…</Typography>
            ) : loginHistory.length === 0 ? (
              <Typography variant="body2" color="text.secondary">Nincs rögzített bejelentkezési esemény.</Typography>
            ) : (
              <List dense disablePadding>
                {loginHistory.map((entry) => {
                  const meta = loginHistoryMeta[entry.action];
                  return (
                    <ListItem key={entry.id} disableGutters>
                      <ListItemIcon sx={{ minWidth: 32, color: meta.color }}>{meta.icon}</ListItemIcon>
                      <ListItemText
                        primary={meta.label}
                        secondary={new Date(entry.created_at).toLocaleString('hu-HU')}
                      />
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <ShieldMoonIcon color="primary" />
              <Typography variant="h6" fontWeight={700}>Névjegy és súgó</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Kitelepítés Támogató Rendszer — GYMS Vármegyei Katasztrófavédelmi Igazgatóság.
            </Typography>
            <Stack spacing={1}>
              {canViewAuditLog && (
                <Link component={RouterLink} to="/naplo" underline="hover" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HistoryEduIcon fontSize="small" /> Műveleti napló
                </Link>
              )}
              {isAdmin && (
                <Link component={RouterLink} to="/felhasznalok" underline="hover" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <GroupIcon fontSize="small" /> Felhasználók kezelése
                </Link>
              )}
              <Link href={`${apiBaseUrl()}/api/documentation`} target="_blank" rel="noopener" underline="hover" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DescriptionIcon fontSize="small" /> API dokumentáció
              </Link>
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" color="text.secondary">
              Technikai probléma esetén forduljon a szervezetén belüli informatikai kapcsolattartóhoz.
            </Typography>
          </Paper>
        </Stack>
      </Stack>
    </Box>
  );
}
