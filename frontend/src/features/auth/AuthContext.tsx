import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '../../types';
import {
  fetchMe,
  login as loginRequest,
  logout as logoutRequest,
  resendTwoFactorCode,
  verifyTwoFactorCode,
} from '../../lib/api/endpoints';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  pendingTwoFactor: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  verifyTwoFactor: (code: string) => Promise<void>;
  resendTwoFactor: () => Promise<void>;
  cancelTwoFactor: () => void;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingTwoFactor, setPendingTwoFactor] = useState(false);

  useEffect(() => {
    fetchMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginRequest(email, password);
    if (result.twoFactorRequired) {
      setPendingTwoFactor(true);
      return true;
    }
    setUser(result.user);
    return false;
  }, []);

  const verifyTwoFactor = useCallback(async (code: string) => {
    const verifiedUser = await verifyTwoFactorCode(code);
    setPendingTwoFactor(false);
    setUser(verifiedUser);
  }, []);

  const resendTwoFactor = useCallback(async () => {
    await resendTwoFactorCode();
  }, []);

  const cancelTwoFactor = useCallback(() => {
    setPendingTwoFactor(false);
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        pendingTwoFactor,
        login,
        verifyTwoFactor,
        resendTwoFactor,
        cancelTwoFactor,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth csak AuthProvider-en belül használható.');
  }
  return ctx;
}
