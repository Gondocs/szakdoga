import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paper, Stack, Typography, Button, IconButton, Tooltip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CloseIcon from '@mui/icons-material/Close';

const DISMISS_STORAGE_KEY_PREFIX = 'onboarding_dismissed:';

interface GettingStartedCardProps {
  eventId: string;
  sheltersAssigned: boolean;
  hasRegistrations: boolean;
}

/**
 * Rögtönzött/önkéntes kezelőknek szánt rövid útmutató egy vadonatúj
 * eseményhez — csak addig látszik, amíg a két érdemi lépés (befogadóhely
 * hozzárendelése, első regisztráció) még nem történt meg, vagy amíg valaki
 * explicit be nem zárja. A megosztható link és a gyülekezési pontok már
 * eleve látszanak a dashboardon/térképen, ezért azokhoz csak hivatkozunk,
 * nem duplikáljuk a tartalmukat.
 */
export function GettingStartedCard({ eventId, sheltersAssigned, hasRegistrations }: GettingStartedCardProps) {
  const navigate = useNavigate();
  const storageKey = `${DISMISS_STORAGE_KEY_PREFIX}${eventId}`;
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(storageKey) === '1');

  if (dismissed || (sheltersAssigned && hasRegistrations)) return null;

  function handleDismiss() {
    localStorage.setItem(storageKey, '1');
    setDismissed(true);
  }

  const steps = [
    {
      done: sheltersAssigned,
      label: 'Rendeljen legalább egy befogadóhelyet az eseményhez',
      action: 'Befogadóhelyek',
      onClick: () => navigate(`/esemenyek/${eventId}/befogadohelyek`),
    },
    {
      done: hasRegistrations,
      label: 'Rögzítse az első regisztrációt (helyszíni vagy önkiszolgáló előregisztráció)',
      action: 'Új regisztráció',
      onClick: () => navigate(`/esemenyek/${eventId}/uj-regisztracio`),
    },
    {
      done: null,
      label: 'Ossza meg a lakossági önkiszolgáló előregisztrációs linket (lásd lentebb)',
      action: null,
      onClick: undefined,
    },
    {
      done: null,
      label: 'Opcionálisan adjon meg gyülekezési pontokat a térképen',
      action: 'Gyülekezőpontok',
      onClick: () => navigate(`/esemenyek/${eventId}/gyulekezopontok`),
    },
  ];

  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderColor: 'primary.main', borderWidth: 2 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>Kezdő lépések</Typography>
        <Tooltip title="Elrejtés">
          <IconButton size="small" onClick={handleDismiss}><CloseIcon fontSize="small" /></IconButton>
        </Tooltip>
      </Stack>
      <Stack spacing={1.25}>
        {steps.map((step, index) => (
          <Stack key={index} direction="row" alignItems="center" spacing={1.5}>
            {step.done === null ? (
              <RadioButtonUncheckedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
            ) : step.done ? (
              <CheckCircleIcon fontSize="small" color="success" />
            ) : (
              <RadioButtonUncheckedIcon fontSize="small" color="action" />
            )}
            <Typography
              variant="body2"
              sx={{ flex: 1, textDecoration: step.done ? 'line-through' : 'none', color: step.done ? 'text.secondary' : 'text.primary' }}
            >
              {step.label}
            </Typography>
            {step.action && (
              <Button size="small" onClick={step.onClick}>{step.action}</Button>
            )}
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
