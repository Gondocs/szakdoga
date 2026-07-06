import { Fragment, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Grid,
  Stack,
  TextField,
  MenuItem,
  Button,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { AuditLogEntry } from '../../types';
import { fetchAuditLogs } from '../../lib/api/endpoints';

const SIGNIFICANT_DIFF_THRESHOLD = 4;

const actionLabels: Record<string, string> = {
  create: 'Létrehozás',
  update: 'Módosítás',
  delete: 'Törlés',
  checkin: 'Érkeztetés',
  status_update: 'Státuszváltás',
  qr_issue: 'QR-kód kiadás',
};

function isSignificantChange(log: AuditLogEntry): boolean {
  if (log.action === 'delete') return true;
  if (log.before && log.after) {
    const keys = new Set([...Object.keys(log.before), ...Object.keys(log.after)]);
    let diffCount = 0;
    keys.forEach((key) => {
      if (JSON.stringify(log.before?.[key]) !== JSON.stringify(log.after?.[key])) diffCount++;
    });
    return diffCount >= SIGNIFICANT_DIFF_THRESHOLD;
  }
  return false;
}

export function AuditLogPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [action, setAction] = useState('');

  function load() {
    setIsLoading(true);
    fetchAuditLogs({
      date_from: dateFrom ? dateFrom.toISOString() : undefined,
      date_to: dateTo ? dateTo.toISOString() : undefined,
      action: action || undefined,
    })
      .then((res) => setLogs(res.data))
      .catch(() => setError('Nincs jogosultsága a napló megtekintéséhez.'))
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 3 }}>Műveleti napló</Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }} alignItems={{ xs: 'stretch', sm: 'flex-end' }} flexWrap="wrap">
        <DateTimePicker
          label="Kezdő időpont"
          value={dateFrom}
          onChange={setDateFrom}
          ampm={false}
          format="yyyy.MM.dd HH:mm"
          slotProps={{ textField: { size: 'small' } }}
        />
        <DateTimePicker
          label="Záró időpont"
          value={dateTo}
          onChange={setDateTo}
          ampm={false}
          format="yyyy.MM.dd HH:mm"
          slotProps={{ textField: { size: 'small' } }}
        />
        <TextField select label="Művelet" size="small" value={action} onChange={(e) => setAction(e.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="">Összes</MenuItem>
          {Object.entries(actionLabels).map(([value, label]) => (
            <MenuItem key={value} value={value}>{label}</MenuItem>
          ))}
        </TextField>
        <Button variant="contained" onClick={load}>Szűrés</Button>
        {(dateFrom || dateTo || action) && (
          <Button
            color="inherit"
            onClick={() => {
              setDateFrom(null);
              setDateTo(null);
              setAction('');
              setTimeout(load, 0);
            }}
          >
            Törlés
          </Button>
        )}
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        <WarningAmberIcon color="error" fontSize="small" />
        <Typography variant="body2" color="text.secondary">
          Pirossal jelölve a törlések és a több mezőt egyszerre érintő, nagyobb horderejű módosítások.
        </Typography>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : isMobile ? (
        <Stack spacing={1.5}>
          {logs.map((log) => {
            const isExpanded = expandedId === log.id;
            const hasDiff = log.before || log.after;
            const significant = isSignificantChange(log);
            return (
              <Paper
                key={log.id}
                variant="outlined"
                sx={{ p: 2, cursor: hasDiff ? 'pointer' : 'default', ...(significant && { borderColor: 'error.main', bgcolor: 'error.50' }) }}
                onClick={() => hasDiff && setExpandedId(isExpanded ? null : log.id)}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="body2" color="text.secondary">{new Date(log.created_at).toLocaleString('hu-HU')}</Typography>
                    <Typography fontWeight={700}>{log.entity_type} #{log.entity_id.slice(0, 8)}</Typography>
                    <Typography variant="body2" color="text.secondary">{log.user ?? '–'}</Typography>
                  </Box>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {significant && <WarningAmberIcon color="error" fontSize="small" />}
                    <Chip size="small" label={actionLabels[log.action] ?? log.action} color={significant ? 'error' : 'default'} variant={significant ? 'filled' : 'outlined'} />
                  </Stack>
                </Stack>
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">Előtte</Typography>
                    <Box component="pre" sx={{ fontSize: '0.7rem', overflowX: 'auto', m: 0 }}>
                      {log.before ? JSON.stringify(log.before, null, 2) : '–'}
                    </Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mt: 1 }}>Utána</Typography>
                    <Box component="pre" sx={{ fontSize: '0.7rem', overflowX: 'auto', m: 0 }}>
                      {log.after ? JSON.stringify(log.after, null, 2) : '–'}
                    </Box>
                  </Box>
                </Collapse>
              </Paper>
            );
          })}
          {logs.length === 0 && <Typography color="text.secondary">Nincs naplóbejegyzés.</Typography>}
        </Stack>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width={40}></TableCell>
                <TableCell>Időpont</TableCell>
                <TableCell>Felhasználó</TableCell>
                <TableCell>Művelet</TableCell>
                <TableCell>Entitás</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => {
                const isExpanded = expandedId === log.id;
                const hasDiff = log.before || log.after;
                const significant = isSignificantChange(log);
                return (
                  <Fragment key={log.id}>
                    <TableRow
                      hover
                      sx={{ cursor: hasDiff ? 'pointer' : 'default', ...(significant && { bgcolor: 'error.50' }) }}
                      onClick={() => hasDiff && setExpandedId(isExpanded ? null : log.id)}
                    >
                      <TableCell>
                        {hasDiff && (
                          <IconButton size="small">
                            {isExpanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                          </IconButton>
                        )}
                      </TableCell>
                      <TableCell>{new Date(log.created_at).toLocaleString('hu-HU')}</TableCell>
                      <TableCell>{log.user ?? '–'}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {significant && <WarningAmberIcon color="error" fontSize="small" />}
                          <Chip size="small" label={actionLabels[log.action] ?? log.action} color={significant ? 'error' : 'default'} variant={significant ? 'filled' : 'outlined'} />
                        </Stack>
                      </TableCell>
                      <TableCell>{log.entity_type} #{log.entity_id.slice(0, 8)}</TableCell>
                    </TableRow>
                    {hasDiff && (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ p: 0, borderBottom: isExpanded ? undefined : 'none' }}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                  <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">Előtte</Typography>
                                  <Box component="pre" sx={{ fontSize: '0.75rem', overflowX: 'auto', m: 0 }}>
                                    {log.before ? JSON.stringify(log.before, null, 2) : '–'}
                                  </Box>
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                  <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">Utána</Typography>
                                  <Box component="pre" sx={{ fontSize: '0.75rem', overflowX: 'auto', m: 0 }}>
                                    {log.after ? JSON.stringify(log.after, null, 2) : '–'}
                                  </Box>
                                </Grid>
                              </Grid>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {logs.length === 0 && (
                <TableRow><TableCell colSpan={5} align="center">Nincs naplóbejegyzés.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
