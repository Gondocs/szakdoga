import { useState } from 'react';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  Container,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
  Chip,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ShieldMoonIcon from '@mui/icons-material/ShieldMoon';
import LogoutIcon from '@mui/icons-material/Logout';
import HomeIcon from '@mui/icons-material/Home';
import EventIcon from '@mui/icons-material/Event';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import DirectionsBusIcon from '@mui/icons-material/DirectionsBus';
import GroupIcon from '@mui/icons-material/Group';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import SettingsIcon from '@mui/icons-material/Settings';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { toast } from 'react-toastify';
import { useAuth } from '../../features/auth/AuthContext';
import { uploadUserAvatar } from '../../lib/api/endpoints';
import { AppBreadcrumbs } from './AppBreadcrumbs';

/**
 * Az esemény aloldalai (attekintes, szemelyek, befogadohelyek, stb.) egy közös
 * EventLayout alatt, állandó EventSubNav-val élnek. Ha itt a teljes pathname
 * lenne a kulcs, minden aloldalváltás újra létrehozná az EventLayout-ot is —
 * ami lenullázná az EventSubNav állandóságát, és emiatt megint ugrásszerű
 * lenne az aktív gomb kiemelésének váltása lágy átmenet helyett. Ezért egy
 * eseményen belüli navigáció csak az esemény-szekció szintjén kap új kulcsot,
 * a tényleges aloldal-tartalom átváltását maga az EventLayout animálja.
 */
function getPageTransitionKey(pathname: string): string {
  const eventSection = pathname.match(/^\/esemenyek\/[^/]+/);
  return eventSection ? eventSection[0] : pathname;
}

const roleLabels: Record<string, string> = {
  admin: 'Rendszergazda',
  manager: 'Vezető',
  registrar: 'Regisztrátor',
  shelter_operator: 'Befogadóhelyi kezelő',
  auditor: 'Auditor',
};

const navItems = [
  { to: '/', label: 'Kezdőlap', icon: <HomeIcon fontSize="small" /> },
  { to: '/esemenyek', label: 'Események', icon: <EventIcon fontSize="small" /> },
  { to: '/befogadohelyek', label: 'Befogadóhelyek', icon: <HomeWorkIcon fontSize="small" /> },
  { to: '/telepulesek', label: 'Települések', icon: <LocationCityIcon fontSize="small" /> },
  { to: '/jarmuvek', label: 'Járművek', icon: <DirectionsBusIcon fontSize="small" /> },
  { to: '/naplo', label: 'Napló', icon: <HistoryEduIcon fontSize="small" /> },
];

export function AppLayout() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const items = user?.role?.code === 'admin'
    ? [...navItems, { to: '/felhasznalok', label: 'Felhasználók', icon: <GroupIcon fontSize="small" /> }]
    : navItems;

  async function handleLogout() {
    setAnchorEl(null);
    await logout();
    toast.info('Sikeresen kijelentkezett.');
    navigate('/bejelentkezes');
  }

  async function handleAvatarUpload(file: File) {
    if (!user) return;
    setIsUploadingAvatar(true);
    try {
      const updated = await uploadUserAvatar(user.id, file);
      setUser(updated);
      toast.success('Profilkép frissítve.');
    } catch {
      toast.error('A profilkép feltöltése nem sikerült.');
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <Toolbar sx={{ gap: { xs: 1, md: 3 } }}>
          <Box
            component={RouterLink}
            to="/"
            sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1, color: 'inherit', textDecoration: 'none' }}
          >
            <ShieldMoonIcon />
            <Typography
              variant="h6"
              component="span"
              sx={{ fontWeight: 700, whiteSpace: 'nowrap', display: { xs: 'none', sm: 'block' }, fontSize: { sm: '1rem', md: '1.25rem' } }}
            >
              Kitelepítés Támogató Rendszer
            </Typography>
          </Box>

          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              {items.map((item) => (
                <Button key={item.to} component={RouterLink} to={item.to} color="inherit" startIcon={item.icon}>
                  {item.label}
                </Button>
              ))}
            </Box>
          )}

          {user && !isMobile && (
            <Chip
              label={roleLabels[user.role?.code ?? ''] ?? 'ismeretlen szerepkör'}
              size="small"
              color="secondary"
              variant="outlined"
              sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.6)' }}
            />
          )}

          {user && (
            <Avatar
              src={user.avatar_url ?? undefined}
              sx={{ cursor: 'pointer', bgcolor: 'secondary.main', width: 36, height: 36, fontSize: '0.9rem' }}
              onClick={(e) => setAnchorEl(e.currentTarget)}
            >
              {user.name.slice(0, 1).toUpperCase()}
            </Avatar>
          )}

          {isMobile && (
            <IconButton color="inherit" edge="end" onClick={() => setDrawerOpen(true)}>
              <MenuIcon />
            </IconButton>
          )}

          {user && (
            <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
              <MenuItem disabled sx={{ opacity: '1 !important' }}>
                <Avatar src={user.avatar_url ?? undefined} sx={{ width: 32, height: 32, mr: 1.5, bgcolor: 'secondary.main', fontSize: '0.85rem' }}>
                  {user.name.slice(0, 1).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{user.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{user.email}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {roleLabels[user.role?.code ?? ''] ?? ''}
                  </Typography>
                </Box>
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={() => {
                  setAnchorEl(null);
                  navigate('/beallitasok');
                }}
              >
                <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
                Beállítások
              </MenuItem>
              <MenuItem component="label" disabled={isUploadingAvatar}>
                <ListItemIcon><PhotoCameraIcon fontSize="small" /></ListItemIcon>
                {isUploadingAvatar ? 'Feltöltés…' : 'Profilkép módosítása'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setAnchorEl(null);
                    if (file) handleAvatarUpload(file);
                  }}
                />
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                Kijelentkezés
              </MenuItem>
            </Menu>
          )}
        </Toolbar>
      </AppBar>

      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 260 }} role="presentation" onClick={() => setDrawerOpen(false)}>
          <List>
            {items.map((item) => (
              <ListItemButton key={item.to} component={RouterLink} to={item.to}>
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      <Container maxWidth="lg" sx={{ flex: 1, py: { xs: 2, sm: 4 }, px: { xs: 1.5, sm: 3 } }}>
        <AppBreadcrumbs />
        <Box key={getPageTransitionKey(location.pathname)} className="page-transition">
          <Outlet />
        </Box>
      </Container>
    </Box>
  );
}
