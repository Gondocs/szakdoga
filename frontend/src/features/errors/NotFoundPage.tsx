import { Link as RouterLink } from 'react-router-dom';
import { Box, Paper, Typography, Button, Stack } from '@mui/material';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import HomeIcon from '@mui/icons-material/Home';

export function NotFoundPage() {
  return (
    <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center', maxWidth: 440 }}>
        <SearchOffIcon sx={{ fontSize: 56, color: 'primary.main', mb: 2 }} />
        <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
          A keresett oldal nem található
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          A megadott link vagy cím nem létezik, esetleg elavult vagy időközben törölt tartalomra mutat.
        </Typography>
        <Stack direction="row" justifyContent="center">
          <Button variant="contained" startIcon={<HomeIcon />} component={RouterLink} to="/">
            Vissza a kezdőlapra
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
