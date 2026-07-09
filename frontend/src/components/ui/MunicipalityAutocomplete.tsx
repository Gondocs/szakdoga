import { Autocomplete, TextField } from '@mui/material';
import type { Municipality } from '../../types';

interface MunicipalityAutocompleteProps {
  municipalities: Municipality[];
  value: number | '';
  onChange: (municipalityId: number | '') => void;
  label?: string;
  required?: boolean;
  size?: 'small' | 'medium';
  sx?: object;
}

/**
 * Kereshető település-választó. Sima legördülő listával nagyszámú település
 * esetén (pl. ha a megyén túl is bővül a törzsadat) nehézkes lenne a
 * végigpörgetés — az Autocomplete gépeléssel szűr.
 */
export function MunicipalityAutocomplete({
  municipalities,
  value,
  onChange,
  label = 'Település',
  required,
  size,
  sx,
}: MunicipalityAutocompleteProps) {
  const selected = municipalities.find((m) => m.id === value) ?? null;

  return (
    <Autocomplete
      options={municipalities}
      getOptionLabel={(m) => m.name}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      value={selected}
      onChange={(_, newValue) => onChange(newValue ? newValue.id : '')}
      size={size}
      sx={{ minWidth: 220, ...sx }}
      renderInput={(params) => <TextField {...params} label={label} required={required} />}
    />
  );
}
