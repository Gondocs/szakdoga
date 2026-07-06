import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from './AuthContext';
import type { RoleCode } from '../../types';
import { ForbiddenPage } from '../errors/ForbiddenPage';

interface ProtectedRouteProps {
  children: ReactNode;
  allow?: RoleCode[];
}

export function ProtectedRoute({ children, allow }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/bejelentkezes" replace />;
  }

  if (allow && (!user.role || !allow.includes(user.role.code))) {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
}
