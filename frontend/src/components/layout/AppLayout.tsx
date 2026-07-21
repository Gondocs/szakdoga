import { useState } from 'react';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Container,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Chip,
  IconButton,
  Drawer,
  List,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
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

const SIDEBAR_WIDTH_EXPANDED = 240;
const SIDEBAR_WIDTH_COLLAPSED = 68;
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'sidebar_collapsed';

export function AppLayout() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  // A becsukott állapot böngészőben tárolva marad újratöltés után is — asztali
  // nézetben ez egy állandó (nem overlay) sáv, aminek a méretét a felhasználó
  // tudatosan állítja be, nem érdemes minden oldalbetöltéskor visszaugrania.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1');

  const items = user?.role?.code === 'admin'
    ? [...navItems, { to: '/felhasznalok', label: 'Felhasználók', icon: <GroupIcon fontSize="small" /> }]
    : navItems;

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }

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

  const showLabels = !collapsed || isMobile;
  const sidebarWidth = collapsed && !isMobile ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  const sidebarContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'primary.main', color: '#fff' }}>
      <Box
        component={RouterLink}
        to="/"
        onClick={() => setMobileDrawerOpen(false)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 2.5,
          color: 'inherit',
          textDecoration: 'none',
          minHeight: 64,
        }}
      >
        <ShieldMoonIcon />
        {showLabels && (
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.15 }}>
            Kitelepítés Támogató Rendszer
          </Typography>
        )}
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.18)' }} />
      <List sx={{ py: 1 }}>
        {items.map((item) => {
          const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
          const button = (
            <ListItemButton
              key={item.to}
              component={RouterLink}
              to={item.to}
              onClick={() => setMobileDrawerOpen(false)}
              selected={isActive}
              sx={{
                mr: 1,
                borderRadius: '0 20px 20px 0',
                justifyContent: showLabels ? 'flex-start' : 'center',
                px: showLabels ? 2 : 1.5,
                color: '#fff',
                borderLeft: '3px solid transparent',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
                '&.Mui-selected': { bgcolor: 'rgba(255,255,255,0.12)', borderLeftColor: '#fff' },
                '&.Mui-selected:hover': { bgcolor: 'rgba(255,255,255,0.16)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: showLabels ? 36 : 'auto', justifyContent: 'center', color: 'inherit' }}>
                {item.icon}
              </ListItemIcon>
              {showLabels && <ListItemText primary={item.label} />}
            </ListItemButton>
          );

          return showLabels ? (
            button
          ) : (
            <Tooltip key={item.to} title={item.label} placement="right">
              {button}
            </Tooltip>
          );
        })}
      </List>
      {!isMobile && (
        <>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.18)' }} />
          <IconButton
            onClick={toggleCollapsed}
            sx={{ m: 1, alignSelf: collapsed ? 'center' : 'flex-end', color: '#fff' }}
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {isMobile ? (
        <Drawer anchor="left" open={mobileDrawerOpen} onClose={() => setMobileDrawerOpen(false)}>
          <Box sx={{ width: SIDEBAR_WIDTH_EXPANDED, height: '100%' }}>{sidebarContent}</Box>
        </Drawer>
      ) : (
        <Box
          component="nav"
          sx={{
            width: sidebarWidth,
            flexShrink: 0,
            transition: theme.transitions.create('width', { duration: theme.transitions.duration.shorter }),
            overflowX: 'hidden',
            // Sticky + saját scroll, hogy lefelé görgetve az oldal tartalmán
            // a sáv a helyén maradjon, ne tűnjön el a viewportból.
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflowY: 'auto',
          }}
        >
          {sidebarContent}
        </Box>
      )}

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AppBar position="sticky" elevation={0} color="inherit" sx={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          <Toolbar sx={{ gap: 1.5 }}>
            {isMobile && (
              <IconButton edge="start" onClick={() => setMobileDrawerOpen(true)}>
                <MenuIcon />
              </IconButton>
            )}

            <Box sx={{ flex: 1 }} />

            {user && (
              <Chip
                label={roleLabels[user.role?.code ?? ''] ?? 'ismeretlen szerepkör'}
                size="small"
                variant="outlined"
                sx={{ display: { xs: 'none', sm: 'flex' }, borderColor: 'rgba(0,0,0,0.2)', color: 'text.secondary' }}
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

        <Container maxWidth="lg" sx={{ flex: 1, py: { xs: 2, sm: 4 }, px: { xs: 1.5, sm: 3 } }}>
          <AppBreadcrumbs />
          <Box key={getPageTransitionKey(location.pathname)} className="page-transition">
            <Outlet />
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
