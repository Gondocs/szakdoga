import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Typography,
  Button,
  Divider,
  ListItemText,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import { useNotificationCenter, type AppNotification } from './NotificationCenterContext';
import { EmptyState } from '../../components/ui/EmptyState';

const severityColors: Record<AppNotification['severity'], string> = {
  info: '#3c6e91',
  warning: '#ed6c02',
  error: '#c62828',
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'most';
  if (diffMin < 60) return `${diffMin} perce`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} órája`;
  return new Date(iso).toLocaleDateString('hu-HU');
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllRead, markRead } = useNotificationCenter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  function handleOpen(event: React.MouseEvent<HTMLElement>) {
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  function handleNotificationClick(notification: AppNotification) {
    markRead(notification.id);
    if (notification.link) {
      navigate(notification.link);
    }
    handleClose();
  }

  return (
    <>
      <IconButton onClick={handleOpen}>
        <Badge badgeContent={unreadCount} color="error" max={99}>
          {unreadCount > 0 ? <NotificationsIcon /> : <NotificationsNoneIcon />}
        </Badge>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 360, maxHeight: 480 } } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1 }}>
          <Typography variant="subtitle2" fontWeight={700}>Értesítések</Typography>
          {unreadCount > 0 && (
            <Button size="small" onClick={markAllRead}>Mind olvasott</Button>
          )}
        </Box>
        <Divider />
        {notifications.length === 0 ? (
          <Box sx={{ px: 2 }}>
            <EmptyState title="Nincs értesítés" description="Az incidens- és kapacitás-riasztások itt fognak megjelenni." />
          </Box>
        ) : (
          notifications.map((n) => (
            <MenuItem
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              sx={{ whiteSpace: 'normal', alignItems: 'flex-start', gap: 1, py: 1.25, bgcolor: n.read ? 'transparent' : 'action.hover' }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: severityColors[n.severity], mt: 0.75, flexShrink: 0 }} />
              <ListItemText
                primary={n.message}
                secondary={formatRelativeTime(n.createdAt)}
                slotProps={{ primary: { variant: 'body2' }, secondary: { variant: 'caption' } }}
              />
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
}
