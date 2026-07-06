import { useEffect, useState, type FormEvent } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
  Avatar,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import PersonIcon from '@mui/icons-material/Person';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { toast } from 'react-toastify';
import type { Role, Shelter, User } from '../../types';
import { createUser, deleteUserAvatar, fetchAllShelters, fetchRoles, fetchUsers, updateUser, uploadUserAvatar } from '../../lib/api/endpoints';

const roleLabels: Record<string, string> = {
  admin: 'Rendszergazda',
  manager: 'Vezető',
  registrar: 'Regisztrátor',
  shelter_operator: 'Befogadóhelyi kezelő',
  auditor: 'Auditor',
};

export function UserManagementPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogUser, setDialogUser] = useState<User | 'new' | null>(null);

  function load() {
    setIsLoading(true);
    Promise.all([fetchUsers(), fetchRoles(), fetchAllShelters()])
      .then(([u, r, s]) => {
        setUsers(u);
        setRoles(r);
        setShelters(s);
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(load, []);

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5} sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Felhasználók</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogUser('new')}>
          Új felhasználó
        </Button>
      </Stack>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : isMobile ? (
        <Stack spacing={1.5}>
          {users.map((u) => (
            <Paper key={u.id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar src={u.avatar_url ?? undefined} sx={{ bgcolor: 'secondary.main' }}>
                    {!u.avatar_url && <PersonIcon fontSize="small" />}
                  </Avatar>
                  <Box>
                    <Typography fontWeight={700}>{u.name}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>{u.email}</Typography>
                  </Box>
                </Stack>
                <IconButton size="small" onClick={() => setDialogUser(u)}><EditIcon fontSize="small" /></IconButton>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap">
                {u.role && <Chip size="small" label={roleLabels[u.role.code] ?? u.role.name} />}
                {u.shelter?.name && <Chip size="small" variant="outlined" label={u.shelter.name} />}
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width={48}></TableCell>
                <TableCell>Név</TableCell>
                <TableCell>E-mail</TableCell>
                <TableCell>Szerepkör</TableCell>
                <TableCell>Befogadóhely</TableCell>
                <TableCell align="right"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>
                    <Avatar src={u.avatar_url ?? undefined} sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                      {!u.avatar_url && <PersonIcon fontSize="small" />}
                    </Avatar>
                  </TableCell>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.role ? <Chip size="small" label={roleLabels[u.role.code] ?? u.role.name} /> : '–'}</TableCell>
                  <TableCell>{u.shelter?.name ?? '–'}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Szerkesztés">
                      <IconButton onClick={() => setDialogUser(u)}><EditIcon fontSize="small" /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {dialogUser && (
        <UserDialog
          user={dialogUser === 'new' ? null : dialogUser}
          roles={roles}
          shelters={shelters}
          onClose={() => setDialogUser(null)}
          onSaved={() => {
            setDialogUser(null);
            load();
          }}
        />
      )}
    </Box>
  );
}

function UserDialog({
  user,
  roles,
  shelters,
  onClose,
  onSaved,
}: {
  user: User | null;
  roles: Role[];
  shelters: Shelter[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<number | ''>(user?.role?.id ?? '');
  const [shelterId, setShelterId] = useState<string>(user?.shelter_id ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(user?.avatar_url);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAvatarBusy, setIsAvatarBusy] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const selectedRoleCode = roles.find((r) => r.id === roleId)?.code;
  const isShelterOperator = selectedRoleCode === 'shelter_operator';

  async function handleAvatarChange(file: File) {
    if (!user) return;
    setIsAvatarBusy(true);
    try {
      const updated = await uploadUserAvatar(user.id, file);
      setAvatarUrl(updated.avatar_url);
      toast.success('Profilkép frissítve.');
    } catch {
      toast.error('A profilkép feltöltése nem sikerült.');
    } finally {
      setIsAvatarBusy(false);
    }
  }

  async function handleAvatarRemove() {
    if (!user) return;
    setIsAvatarBusy(true);
    try {
      const updated = await deleteUserAvatar(user.id);
      setAvatarUrl(updated.avatar_url);
    } catch {
      toast.error('A profilkép eltávolítása nem sikerült.');
    } finally {
      setIsAvatarBusy(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (roleId === '') return;
    setIsSubmitting(true);
    try {
      const payload = {
        name,
        email,
        role_id: roleId,
        shelter_id: isShelterOperator && shelterId ? shelterId : null,
        ...(password ? { password } : {}),
      };
      if (user) {
        await updateUser(user.id, payload);
        toast.success('Felhasználó frissítve.');
      } else {
        await createUser({ ...payload, password: password || 'password' });
        toast.success('Felhasználó létrehozva.');
      }
      onSaved();
    } catch {
      toast.error('A mentés nem sikerült. Ellenőrizze az adatokat (pl. egyedi e-mail cím).');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile}>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>{user ? 'Felhasználó szerkesztése' : 'Új felhasználó'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {user && (
              <Stack direction="row" spacing={2} alignItems="center">
                <Avatar src={avatarUrl ?? undefined} sx={{ width: 56, height: 56, bgcolor: 'secondary.main' }}>
                  {!avatarUrl && <PersonIcon />}
                </Avatar>
                <Stack direction="row" spacing={1}>
                  <Button
                    component="label"
                    size="small"
                    variant="outlined"
                    startIcon={<PhotoCameraIcon fontSize="small" />}
                    disabled={isAvatarBusy}
                  >
                    Csere
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAvatarChange(file);
                      }}
                    />
                  </Button>
                  {avatarUrl && (
                    <Button size="small" color="inherit" disabled={isAvatarBusy} onClick={handleAvatarRemove}>
                      Eltávolítás
                    </Button>
                  )}
                </Stack>
              </Stack>
            )}
            <TextField label="Név" required fullWidth value={name} onChange={(e) => setName(e.target.value)} />
            <TextField label="E-mail" type="email" required fullWidth value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField
              label={user ? 'Új jelszó (üresen hagyva változatlan)' : 'Jelszó'}
              type="password"
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText={!user ? 'Üresen hagyva alapértelmezett: "password"' : undefined}
            />
            <TextField select label="Szerepkör" required fullWidth value={roleId} onChange={(e) => setRoleId(Number(e.target.value))}>
              {roles.map((r) => (
                <MenuItem key={r.id} value={r.id}>{roleLabels[r.code] ?? r.name}</MenuItem>
              ))}
            </TextField>
            {isShelterOperator && (
              <TextField select label="Befogadóhely" fullWidth value={shelterId} onChange={(e) => setShelterId(e.target.value)}>
                <MenuItem value="">Nincs kiválasztva</MenuItem>
                {shelters.map((s) => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} color="inherit">Mégse</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Mentés…' : 'Mentés'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
