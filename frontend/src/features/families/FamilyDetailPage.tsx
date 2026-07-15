import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Chip,
  CircularProgress,
  Stack,
  Alert,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import PersonIcon from '@mui/icons-material/Person';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { FamilyDetail } from '../../types';
import { fetchFamily } from '../../lib/api/endpoints';
import { SpecialNeedIcon } from '../../components/ui/SpecialNeedIcon';

const statusLabels: Record<string, string> = {
  registered: 'Regisztrált',
  checked_in_assembly: 'Megjelent a gyülekezőponton',
  missing: 'Hiányzik',
  in_transport: 'Szállítás alatt',
  arrived_shelter: 'Megérkezett',
  left_shelter: 'Befogadóhelyet elhagyta',
  returned_home: 'Visszatelepült',
  cancelled: 'Törölt',
};

export function FamilyDetailPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [family, setFamily] = useState<FamilyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!familyId) return;
    fetchFamily(familyId).then(setFamily).finally(() => setIsLoading(false));
  }, [familyId]);

  // A család akkor számít "szétszakadtnak", ha a tagok egynél több eltérő
  // befogadóhelyen tartózkodnak jelenleg
  const shelterSplit = useMemo(() => {
    if (!family) return false;
    const shelterIds = new Set(
      family.members.map((m) => m.current_shelter?.id).filter((id): id is string => Boolean(id))
    );
    return shelterIds.size > 1;
  }, [family]);

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  if (!family) return <Typography>Nincs ilyen család.</Typography>;

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Család: {family.family_code}</Typography>
        <Chip label={`${family.members.length} fő`} />
      </Stack>

      {shelterSplit && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Figyelem: a család tagjai jelenleg különböző befogadóhelyeken tartózkodnak. Érdemes ellenőrizni és
          segíteni az újraegyesítésüket.
        </Alert>
      )}

      {isMobile ? (
        <Stack spacing={1.5}>
          {family.members.map((member) => (
            <Paper key={member.id} variant="outlined" sx={{ p: 2, cursor: 'pointer' }} onClick={() => navigate(`/szemelyek/${member.id}`)}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <PersonIcon color="secondary" />
                  <Box>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Typography fontWeight={700}>{member.full_name}</Typography>
                      {family.primary_contact_person_id === member.id && (
                        <StarIcon fontSize="small" color="secondary" titleAccess="Kapcsolattartó" />
                      )}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">{member.municipality?.name ?? '–'}</Typography>
                  </Box>
                </Stack>
                <ChevronRightIcon color="action" />
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" alignItems="center">
                {member.registration && <Chip size="small" label={statusLabels[member.registration.status]} />}
                {member.current_shelter && (
                  <Chip size="small" color={shelterSplit ? 'warning' : 'default'} variant="outlined" label={member.current_shelter.name} />
                )}
                {(member.special_needs ?? []).map((n) => (
                  <SpecialNeedIcon key={n.id} category={n.category} needType={n.type} needDescription={n.description} fontSize="small" color="secondary" />
                ))}
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <Paper variant="outlined">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell></TableCell>
                  <TableCell>Név</TableCell>
                  <TableCell>Település</TableCell>
                  <TableCell>Státusz</TableCell>
                  <TableCell>Befogadóhely</TableCell>
                  <TableCell>Speciális igény</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {family.members.map((member) => (
                  <TableRow key={member.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/szemelyek/${member.id}`)}>
                    <TableCell width={40}>
                      {family.primary_contact_person_id === member.id && (
                        <StarIcon fontSize="small" color="secondary" titleAccess="Kapcsolattartó" />
                      )}
                    </TableCell>
                    <TableCell>{member.full_name}</TableCell>
                    <TableCell>{member.municipality?.name ?? '–'}</TableCell>
                    <TableCell>{member.registration ? statusLabels[member.registration.status] : '–'}</TableCell>
                    <TableCell>
                      {member.current_shelter ? (
                        <Chip size="small" color={shelterSplit ? 'warning' : 'default'} variant="outlined" label={member.current_shelter.name} />
                      ) : '–'}
                    </TableCell>
                    <TableCell>
                      {member.special_needs?.length ? (
                        <Stack direction="row" spacing={0.5}>
                          {member.special_needs.map((n) => (
                            <SpecialNeedIcon key={n.id} category={n.category} needType={n.type} needDescription={n.description} fontSize="small" color="secondary" />
                          ))}
                        </Stack>
                      ) : '–'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}
