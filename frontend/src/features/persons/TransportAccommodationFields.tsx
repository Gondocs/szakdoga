import { FormControlLabel, Checkbox, Stack } from '@mui/material';

interface TransportAccommodationFieldsProps {
  centralTransportRequired: boolean;
  onCentralTransportRequiredChange: (value: boolean) => void;
  centralAccommodationRequired: boolean;
  onCentralAccommodationRequiredChange: (value: boolean) => void;
  transportLabel?: string;
  accommodationLabel?: string;
}

/**
 * A "kér-e központi szállítást" / "kér-e elszállásolást" jelölőpár — ez az a
 * mezőpár, ami korábban csak az egyik regisztrációs felületre került be, a
 * másikból (előregisztráció) hiányzott, mire észrevettük. Ide kiemelve egy
 * jövőbeli hasonló mezőbővítés strukturálisan nem tud csak az egyik oldalon
 * megjelenni.
 */
export function TransportAccommodationFields({
  centralTransportRequired,
  onCentralTransportRequiredChange,
  centralAccommodationRequired,
  onCentralAccommodationRequiredChange,
  transportLabel = 'Központi szállítást igényel',
  accommodationLabel = 'Központi elszállásolást igényel',
}: TransportAccommodationFieldsProps) {
  return (
    <Stack direction="row" flexWrap="wrap" useFlexGap>
      <FormControlLabel
        control={<Checkbox checked={centralTransportRequired} onChange={(e) => onCentralTransportRequiredChange(e.target.checked)} />}
        label={transportLabel}
      />
      <FormControlLabel
        control={<Checkbox checked={centralAccommodationRequired} onChange={(e) => onCentralAccommodationRequiredChange(e.target.checked)} />}
        label={accommodationLabel}
      />
    </Stack>
  );
}
