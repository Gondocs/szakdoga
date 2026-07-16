import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Stack,
  Avatar,
  CircularProgress,
  Link,
} from '@mui/material';
import ShieldMoonIcon from '@mui/icons-material/ShieldMoon';
import { toast } from 'react-toastify';
import { useAuth } from './AuthContext';

const RESEND_COOLDOWN_SECONDS = 30;

export function LoginPage() {
  const { login, pendingTwoFactor, verifyTwoFactor, resendTwoFactor, cancelTwoFactor } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  async function handleCredentialsSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const twoFactorRequired = await login(email, password);
      if (twoFactorRequired) {
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        toast.success('Sikeres bejelentkezés.');
        navigate('/');
      }
    } catch {
      toast.error('A megadott hitelesítő adatok nem egyeznek a nyilvántartással.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCodeSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await verifyTwoFactor(code);
      toast.success('Sikeres bejelentkezés.');
      navigate('/');
    } catch {
      toast.error('Hibás vagy lejárt kód.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    try {
      await resendTwoFactor();
      toast.success('Új kódot küldtünk az e-mail címedre.');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      const timer = setInterval(() => {
        setResendCooldown((current) => {
          if (current <= 1) {
            clearInterval(timer);
            return 0;
          }
          return current - 1;
        });
      }, 1000);
    } catch {
      toast.error('A kód újraküldése nem sikerült.');
    }
  }

  function handleBack() {
    cancelTwoFactor();
    setCode('');
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at top, #fbeceb 0%, #f7f6f5 60%)',
        p: 2,
      }}
    >
      <Paper elevation={6} sx={{ width: 400, maxWidth: '100%', p: 4, borderRadius: 3 }}>
        <Stack spacing={1} alignItems="center" sx={{ mb: 3 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
            <ShieldMoonIcon fontSize="large" />
          </Avatar>
          <Typography variant="h5" fontWeight={700} textAlign="center">
            Kitelepítés Támogató Rendszer
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {pendingTwoFactor ? 'Kétfaktoros hitelesítés' : 'Bejelentkezés'}
          </Typography>
        </Stack>

        {pendingTwoFactor ? (
          <Box component="form" onSubmit={handleCodeSubmit}>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                E-mailben kiküldtünk egy 6 jegyű kódot. Add meg a bejelentkezés befejezéséhez.
              </Typography>
              <TextField
                label="Kód"
                required
                autoFocus
                fullWidth
                inputMode="numeric"
                slotProps={{ htmlInput: { maxLength: 6 } }}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : undefined}
              >
                {isSubmitting ? 'Ellenőrzés…' : 'Belépés'}
              </Button>
              <Stack direction="row" justifyContent="space-between">
                <Link component="button" type="button" variant="body2" onClick={handleBack}>
                  Vissza
                </Link>
                <Link
                  component="button"
                  type="button"
                  variant="body2"
                  onClick={handleResend}
                  sx={{ color: resendCooldown > 0 ? 'text.disabled' : undefined }}
                  disabled={resendCooldown > 0}
                >
                  {resendCooldown > 0 ? `Kód újraküldése (${resendCooldown}mp)` : 'Kód újraküldése'}
                </Link>
              </Stack>
            </Stack>
          </Box>
        ) : (
          <Box component="form" onSubmit={handleCredentialsSubmit}>
            <Stack spacing={2}>
              <TextField
                label="E-mail cím"
                type="email"
                required
                autoComplete="username"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                label="Jelszó"
                type="password"
                required
                autoComplete="current-password"
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : undefined}
              >
                {isSubmitting ? 'Bejelentkezés…' : 'Bejelentkezés'}
              </Button>
            </Stack>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
