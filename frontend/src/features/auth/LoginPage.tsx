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
} from '@mui/material';
import ShieldMoonIcon from '@mui/icons-material/ShieldMoon';
import { toast } from 'react-toastify';
import { useAuth } from './AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await login(email, password);
      toast.success('Sikeres bejelentkezés.');
      navigate('/');
    } catch {
      toast.error('A megadott hitelesítő adatok nem egyeznek a nyilvántartással.');
    } finally {
      setIsSubmitting(false);
    }
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
            Bejelentkezés
          </Typography>
        </Stack>

        <Box component="form" onSubmit={handleSubmit}>
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
      </Paper>
    </Box>
  );
}
