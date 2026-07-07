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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import GroupsIcon from '@mui/icons-material/Groups';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { FamilySummary } from '../../types';
import { fetchFamilies } from '../../lib/api/endpoints';

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

  const splitCount = useMemo(() => families.filter((f) => f.is_split).length, [families]);

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <GroupsIcon color="primary" />
        <Typography variant="h4" fontWeight={700}>Családok / csoportok</Typography>
      </Stack>

      {splitCount > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderColor: 'warning.main', bgcolor: (t) => alpha(t.palette.warning.main, 0.08) }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap">
            <Stack direction="row" spacing={1} alignItems="center">
              <WarningAmberIcon color="warning" />
              <Typography variant="body2">
                {splitCount} család tagjai jelenleg különböző befogadóhelyeken tartózkodnak — érdemes ellenőrizni és
                segíteni az újraegyesítésüket.
              </Typography>
            </Stack>
            <Button size="small" variant="outlined" color="warning" onClick={() => navigate(`/esemenyek/${eventId}/csaladok/egyesites`)}>
              Munkalista megnyitása
            </Button>
          </Stack>
        </Paper>
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

      {isMobile ? (
        <Stack spacing={1.5}>
          {filtered.map((f) => (
            <Paper key={f.id} variant="outlined" sx={{ p: 2, cursor: 'pointer' }} onClick={() => navigate(`/csaladok/${f.id}`)}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography fontWeight={700}>{f.family_code}</Typography>
                    {f.is_split && (
                      <Tooltip title={SPLIT_TOOLTIP}>
                        <WarningAmberIcon fontSize="small" color="warning" />
                      </Tooltip>
                    )}
                  </Stack>
                  <Chip size="small" label={`${f.members_count} fő`} sx={{ mt: 0.5 }} />
                </Box>
                <ChevronRightIcon color="action" />
              </Stack>
            </Paper>
          ))}
          {filtered.length === 0 && <Typography color="text.secondary" textAlign="center">Nincs találat.</Typography>}
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
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((f) => (
                <TableRow key={f.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/csaladok/${f.id}`)}>
                  <TableCell>{f.family_code}</TableCell>
                  <TableCell><Chip size="small" label={`${f.members_count} fő`} /></TableCell>
                  <TableCell>
                    {f.is_split && (
                      <Tooltip title={SPLIT_TOOLTIP}>
                        <WarningAmberIcon fontSize="small" color="warning" />
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={3} align="center">Nincs találat.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
