import { createTheme, responsiveFontSizes } from '@mui/material/styles';
import { huHU } from '@mui/material/locale';

/**
 * Katasztrófavédelmi arculat világos alapon: fehér háttér, a vörös csak
 * kiemelésre (fejléc, elsődleges gombok, aktív állapotok) használt, hogy
 * ne legyen fárasztó hosszabb, terepi/stresszes használat esetén sem
 * (NF3 - áttekinthetőség: idősebb felhasználók is olvassák).
 */
export const muiTheme = responsiveFontSizes(
  createTheme(
  {
    palette: {
      mode: 'light',
      primary: {
        main: '#a3172b',
        dark: '#7a1020',
        light: '#c94f5f',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#8a5a00',
      },
      error: {
        main: '#c62828',
      },
      warning: {
        main: '#b45309',
      },
      success: {
        main: '#166534',
      },
      background: {
        default: '#f7f6f5',
        paper: '#ffffff',
      },
      text: {
        primary: '#211a1b',
        secondary: '#5b4d4e',
      },
      divider: 'rgba(0,0,0,0.10)',
    },
    shape: {
      borderRadius: 10,
    },
    typography: {
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      h1: { fontSize: '2.25rem', fontWeight: 700 },
      h2: { fontSize: '1.5rem', fontWeight: 700 },
      h3: { fontSize: '1.25rem', fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            minHeight: 44,
            borderRadius: 8,
          },
          containedPrimary: {
            boxShadow: '0 2px 8px rgba(163, 23, 43, 0.25)',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            border: '1px solid rgba(0,0,0,0.08)',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 700,
            color: 'rgba(0,0,0,0.6)',
            backgroundColor: '#faf5f5',
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            overflowX: 'auto',
          },
        },
      },
    },
  },
  huHU,
  ),
  { factor: 3 },
);
