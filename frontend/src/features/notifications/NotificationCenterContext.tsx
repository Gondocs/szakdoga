import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type NotificationSeverity = 'info' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  message: string;
  severity: NotificationSeverity;
  createdAt: string;
  read: boolean;
  link?: string;
}

const MAX_NOTIFICATIONS = 50;

interface NotificationCenterContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clear: () => void;
}

const NotificationCenterContext = createContext<NotificationCenterContextValue | undefined>(undefined);

/**
 * Csak a munkamenet alatt él (nincs localStorage/backend perzisztencia) —
 * ez az élő figyelmeztetések (incidens, kritikus kapacitás) rövid távú
 * előzménye, nem egy hivatalos napló (az amúgy is ott van a Naplóban).
 */
export function NotificationCenterProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const addNotification = useCallback((notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => {
    setNotifications((prev) => [
      { ...notification, id: crypto.randomUUID(), createdAt: new Date().toISOString(), read: false },
      ...prev,
    ].slice(0, MAX_NOTIFICATIONS));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const clear = useCallback(() => setNotifications([]), []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationCenterContext.Provider value={{ notifications, unreadCount, addNotification, markAllRead, markRead, clear }}>
      {children}
    </NotificationCenterContext.Provider>
  );
}

export function useNotificationCenter(): NotificationCenterContextValue {
  const ctx = useContext(NotificationCenterContext);
  if (!ctx) {
    throw new Error('useNotificationCenter csak NotificationCenterProvider-en belül használható.');
  }
  return ctx;
}
