import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  TextField,
  InputAdornment,
  Chip,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Tooltip,
  TableSortLabel,
  Alert,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import GroupsIcon from '@mui/icons-material/Groups';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { FamilySummary } from '../../types';
import { fetchFamilies } from '../../lib/api/endpoints';
import { EmptyState } from '../../components/ui/EmptyState';

const SPLIT_TOOLTIP = 'A család tagjai jelenleg különböző befogadóhelyeken tartózkodnak.';

export function FamilyListPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [families, setFamilies] = useState<FamilySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'code' | 'members'>('code');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (!eventId) return;
    fetchFamilies(eventId).then(setFamilies).finally(() => setIsLoading(false));
  }, [eventId]);

  function handleSort(column: typeof sortBy) {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  }

  // A keresőszó alapján szűrjük a családkódra, majd a kiválasztott oszlop
  // (családkód vagy létszám) szerint, a megadott iránnyal rendezzük a listát
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = term ? families.filter((f) => f.family_code.toLowerCase().includes(term)) : families;

    return [...base].sort((a, b) => {
      const result = sortBy === 'members'
        ? a.members_count - b.members_count
        : a.family_code.localeCompare(b.family_code, 'hu');
      return sortDir === 'asc' ? result : -result;
    });
  }, [families, search, sortBy, sortDir]);

  // A szétszakadt (több befogadóhelyen tartózkodó tagú) családok száma, a
  // figyelmeztető sáv megjelenítéséhez
  const splitCount = useMemo(() => families.filter((f) => f.is_split).length, [families]);

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Családok / csoportok</Typography>
      </Stack>

      {splitCount > 0 && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate(`/esemenyek/${eventId}/csaladok/egyesites`)}>
              Munkalista megnyitása
            </Button>
          }
        >
          {splitCount} család tagjai jelenleg különböző befogadóhelyeken tartózkodnak — érdemes ellenőrizni és
          segíteni az újraegyesítésüket.
        </Alert>
      )}

      <TextField
        placeholder="Keresés családkód alapján…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2, maxWidth: 360 }}
        size="small"
        fullWidth
        InputProps={{
          startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
        }}
      />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : isMobile ? (
        <Stack spacing={1.5}>
          {filtered.map((f) => (
            <Paper key={f.id} variant="outlined" sx={{ p: 2, cursor: 'pointer' }} onClick={() => navigate(`/csaladok/${f.id}`)}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1} alignItems="center">
                  <GroupsIcon color="secondary" />
                  <Box>
                    <Typography fontWeight={700}>{f.family_code}</Typography>
                    <Typography variant="body2" color="text.secondary">{f.members_count} fő</Typography>
                  </Box>
                </Stack>
                <ChevronRightIcon color="action" />
              </Stack>
              {f.is_split && (
                <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" alignItems="center">
                  <Chip size="small" variant="outlined" color="warning" icon={<WarningAmberIcon />} label="Szétszakadt" />
                </Stack>
              )}
            </Paper>
          ))}
          {filtered.length === 0 && <EmptyState title="Nincs találat" description="A keresésnek megfelelő család nem található." />}
        </Stack>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sortDirection={sortBy === 'code' ? sortDir : false}>
                  <TableSortLabel active={sortBy === 'code'} direction={sortBy === 'code' ? sortDir : 'asc'} onClick={() => handleSort('code')}>
                    Családkód
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sortBy === 'members' ? sortDir : false}>
                  <TableSortLabel active={sortBy === 'members'} direction={sortBy === 'members' ? sortDir : 'asc'} onClick={() => handleSort('members')}>
                    Létszám
                  </TableSortLabel>
                </TableCell>
                <TableCell>Állapot</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((f) => (
                <TableRow key={f.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/csaladok/${f.id}`)}>
                  <TableCell>{f.family_code}</TableCell>
                  <TableCell>{f.members_count} fő</TableCell>
                  <TableCell>
                    {f.is_split && (
                      <Tooltip title={SPLIT_TOOLTIP}>
                        <Chip size="small" variant="outlined" color="warning" icon={<WarningAmberIcon />} label="Szétszakadt" />
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3}>
                    <EmptyState title="Nincs találat" description="A keresésnek megfelelő család nem található." />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
