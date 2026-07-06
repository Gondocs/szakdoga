import { Box, Grid, IconButton, MenuItem, Paper, Stack, TextField, Typography, Button, Chip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { specialNeedCategoryLabels, specialNeedOptions } from '../../constants/specialNeeds';
import { SpecialNeedIcon } from '../../components/ui/SpecialNeedIcon';
import type { SpecialNeedCategory } from '../../types';

export interface SpecialNeedRow {
  category: SpecialNeedCategory;
  type: string;
  description: string;
}

interface Props {
  rows: SpecialNeedRow[];
  onChange: (rows: SpecialNeedRow[]) => void;
}

/**
 * Előre definiált katalógusból választható speciális igény szerkesztő.
 * Szabad szöveg csak a "Megjegyzés" mezőben rögzíthető, hogy az adatok
 * egységesek és kimutatható (statisztikailag összesíthető) formában
 * kerüljenek be a rendszerbe.
 */
export function SpecialNeedsEditor({ rows, onChange }: Props) {
  function addRow() {
    onChange([...rows, { category: 'medical', type: specialNeedOptions.medical[0].value, description: '' }]);
  }

  function updateRow(index: number, patch: Partial<SpecialNeedRow>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  function handleCategoryChange(index: number, category: SpecialNeedCategory) {
    updateRow(index, { category, type: specialNeedOptions[category][0].value });
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>Speciális igények</Typography>
        <Button startIcon={<AddIcon />} onClick={addRow}>Igény hozzáadása</Button>
      </Stack>
      <Stack spacing={2}>
        {rows.map((row, index) => (
          <Paper key={index} variant="outlined" sx={{ p: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  select
                  label="Kategória"
                  fullWidth
                  value={row.category}
                  onChange={(e) => handleCategoryChange(index, e.target.value as SpecialNeedCategory)}
                  slotProps={{ input: { startAdornment: <SpecialNeedIcon category={row.category} fontSize="small" sx={{ mr: 1, color: 'secondary.main' }} /> } }}
                >
                  {(Object.keys(specialNeedOptions) as SpecialNeedCategory[]).map((cat) => (
                    <MenuItem key={cat} value={cat}>{specialNeedCategoryLabels[cat]}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField select label="Konkrét igény" fullWidth value={row.type} onChange={(e) => updateRow(index, { type: e.target.value })}>
                  {specialNeedOptions[row.category].map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  label="Megjegyzés (opcionális)"
                  fullWidth
                  value={row.description}
                  onChange={(e) => updateRow(index, { description: e.target.value })}
                  placeholder="Bármilyen kiegészítő részlet ide írható"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 1 }}>
                <IconButton color="error" onClick={() => removeRow(index)}><DeleteIcon /></IconButton>
              </Grid>
            </Grid>
          </Paper>
        ))}
        {rows.length === 0 && (
          <Chip variant="outlined" label="Nincs jelzett speciális igény" sx={{ alignSelf: 'flex-start' }} />
        )}
      </Stack>
    </Box>
  );
}
