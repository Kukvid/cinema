import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#e50914', // Netflix red
      light: '#ff4a4a',
      dark: '#b00710',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#ffd700', // Gold
      light: '#ffe54c',
      dark: '#c7a600',
      contrastText: '#000000',
    },
    background: {
      default: '#141414',
      paper: '#1f1f1f',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b3b3b3',
    },
    success: {
      main: '#46d369',
    },
    error: {
      main: '#e50914',
    },
    warning: {
      main: '#ff9800',
    },
    info: {
      main: '#2196f3',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '3rem',
      fontWeight: 700,
      letterSpacing: '-0.01562em',
    },
    h2: {
      fontSize: '2.5rem',
      fontWeight: 600,
      letterSpacing: '-0.00833em',
    },
    h3: {
      fontSize: '2rem',
      fontWeight: 600,
      letterSpacing: '0em',
    },
    h4: {
      fontSize: '1.75rem',
      fontWeight: 600,
      letterSpacing: '0.00735em',
    },
    h5: {
      fontSize: '1.5rem',
      fontWeight: 500,
      letterSpacing: '0em',
    },
    h6: {
      fontSize: '1.25rem',
      fontWeight: 500,
      letterSpacing: '0.0075em',
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  shadows: [
    'none',
    '0px 2px 4px rgba(0,0,0,0.3)',
    '0px 4px 8px rgba(0,0,0,0.3)',
    '0px 6px 12px rgba(0,0,0,0.3)',
    '0px 8px 16px rgba(0,0,0,0.3)',
    '0px 10px 20px rgba(0,0,0,0.3)',
    '0px 12px 24px rgba(0,0,0,0.3)',
    '0px 14px 28px rgba(0,0,0,0.3)',
    '0px 16px 32px rgba(0,0,0,0.3)',
    '0px 18px 36px rgba(0,0,0,0.3)',
    '0px 20px 40px rgba(0,0,0,0.3)',
    '0px 22px 44px rgba(0,0,0,0.3)',
    '0px 24px 48px rgba(0,0,0,0.3)',
    '0px 26px 52px rgba(0,0,0,0.3)',
    '0px 28px 56px rgba(0,0,0,0.3)',
    '0px 30px 60px rgba(0,0,0,0.3)',
    '0px 32px 64px rgba(0,0,0,0.3)',
    '0px 34px 68px rgba(0,0,0,0.3)',
    '0px 36px 72px rgba(0,0,0,0.3)',
    '0px 38px 76px rgba(0,0,0,0.3)',
    '0px 40px 80px rgba(0,0,0,0.3)',
    '0px 42px 84px rgba(0,0,0,0.3)',
    '0px 44px 88px rgba(0,0,0,0.3)',
    '0px 46px 92px rgba(0,0,0,0.3)',
    '0px 48px 96px rgba(0,0,0,0.3)',
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '10px 24px',
          fontSize: '1rem',
          fontWeight: 600,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0px 4px 12px rgba(229, 9, 20, 0.4)',
            transform: 'translateY(-2px)',
            transition: 'all 0.3s ease',
          },
        },
        contained: {
          background: 'linear-gradient(135deg, #e50914 0%, #b00710 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #ff1a1a 0%, #cc0812 100%)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundImage: 'none',
          backgroundColor: '#1f1f1f',
          boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.5)',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.7)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            '&:hover fieldset': {
              borderColor: '#e50914',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#e50914',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: 'rgba(20, 20, 20, 0.95)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.5)',
        },
      },
    },
  },
});

export default theme;
