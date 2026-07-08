import { Box, Alert } from '@mui/material';

/**
 * Egységes hiba-megjelenítés oldal-szintű hibákhoz (pl. betöltési hiba,
 * jogosultsághiány), a korábban oldalanként eltérő, egyszerű piros
 * szövegek ("Typography color=error") helyett.
 */
export function ErrorState({ message }: { message: string }) {
  return (
    <Box sx={{ py: 4 }}>
      <Alert severity="error">{message}</Alert>
    </Box>
  );
}
