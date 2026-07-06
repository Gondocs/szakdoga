import type { ReactNode } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { hu } from 'date-fns/locale';
import { ToastContainer } from 'react-toastify';
import { AuthProvider } from '../features/auth/AuthContext';
import { FontScaleProvider } from '../features/settings/FontScaleContext';
import { muiTheme } from '../theme/muiTheme';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <FontScaleProvider>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={hu}>
          <AuthProvider>{children}</AuthProvider>
          <ToastContainer position="bottom-right" theme="light" autoClose={4000} newestOnTop />
        </LocalizationProvider>
      </FontScaleProvider>
    </ThemeProvider>
  );
}
