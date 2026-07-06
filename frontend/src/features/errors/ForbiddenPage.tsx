import { Link as RouterLink } from 'react-router-dom';
import { Box, Paper, Typography, Button, Stack } from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import HomeIcon from '@mui/icons-material/Home';

export function ForbiddenPage() {
  return (
    <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center', maxWidth: 440 }}>
        <BlockIcon sx={{ fontSize: 56, color: 'error.main', mb: 2 }} />
        <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
          Nincs jogosultsága az oldal megtekintéséhez
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Ehhez a funkcióhoz az Ön szerepköre nem rendelkezik hozzáféréssel. Ha úgy gondolja, hogy ez tévedés,
          forduljon a rendszergazdához.
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
