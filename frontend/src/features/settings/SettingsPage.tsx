import { useState, type FormEvent } from 'react';
import { Box, Typography, Paper, Stack, TextField, Button, ToggleButtonGroup, ToggleButton, Divider } from '@mui/material';
import { toast } from 'react-toastify';
import { useAuth } from '../auth/AuthContext';
import { updateProfile } from '../../lib/api/endpoints';
import { useFontScale, type FontScale } from './FontScaleContext';

const fontScaleOptions: { value: FontScale; label: string }[] = [
  { value: 'small', label: 'Kicsi' },
  { value: 'normal', label: 'Normál' },
  { value: 'large', label: 'Nagy' },
  { value: 'extra-large', label: 'Extra nagy' },
];

export function SettingsPage() {
  const { user, setUser } = useAuth();
  const { fontScale, setFontScale } = useFontScale();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>Beállítások</Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 3, maxWidth: 640 }}>
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

      <Paper variant="outlined" sx={{ p: 3, maxWidth: 640 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Fiókom</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Név és e-mail cím módosítása. E-mail cím vagy jelszó módosításához adja meg jelenlegi jelszavát.
        </Typography>
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
    </Box>
  );
}
