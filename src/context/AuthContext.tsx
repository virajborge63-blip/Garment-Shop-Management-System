import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types.ts';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  warning: string | null;
  login: (identifier: string, pass: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('erp_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Validate session on mount
  useEffect(() => {
    const verifySession = async () => {
      const storedToken = localStorage.getItem('erp_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setToken(storedToken);
        } else if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('erp_token');
          setToken(null);
          setUser(null);
        } else {
          setError('The saved session could not be verified. Check your connection and try again.');
        }
      } catch {
        setError('Could not verify the saved session. Check your connection and try again.');
      } finally {
        setIsLoading(false);
      }
    };

    verifySession();
  }, []);

  const login = async (identifier: string, pass: string): Promise<boolean> => {
    setError(null);
    setWarning(null);
    setIsLoading(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: pass }),
        signal: controller.signal,
      });

      const data: {
        token?: string;
        user?: User;
        error?: string;
      } = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message = res.status === 503
          ? 'The login service or database is temporarily unavailable. Please try again shortly.'
          : res.status >= 500
            ? 'The login service encountered an error. Please try again later.'
            : res.status === 429
              ? data.error || 'Too many login attempts. Please wait before trying again.'
              : res.status === 401
                ? data.error || 'Invalid username/email or password.'
                : res.status === 404
                  ? 'The login endpoint is unavailable. Please contact support.'
                  : data.error || 'The login request could not be completed.';
        setError(message);
        return false;
      }

      if (!data.token || !data.user) {
        setError('The login service returned an invalid response. Please try again later.');
        return false;
      }

      localStorage.setItem('erp_token', data.token);
      setToken(data.token);
      setUser(data.user);
      return true;
    } catch (err) {
      setError(
        err instanceof Error && err.name === 'AbortError'
          ? 'The login request timed out. Check your connection and try again.'
          : 'Cannot reach the login service. Check your network connection and try again.'
      );
      return false;
    } finally {
      window.clearTimeout(timeout);
      setIsLoading(false);
    }
  };

  const logout = async () => {
    let logoutWarning: string | null = null;
    if (token) {
      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          logoutWarning = 'Warning: The server could not confirm logout. This browser session was cleared, but the server session may remain active until it expires.';
        }
      } catch {
        logoutWarning = 'Warning: Could not reach the server to confirm logout. This browser session was cleared, but the server session may remain active until it expires.';
      }
    }
    localStorage.removeItem('erp_token');
    setToken(null);
    setUser(null);
    setError(null);
    setWarning(logoutWarning);
  };

  const clearError = () => {
    setError(null);
    setWarning(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        error,
        warning,
        login,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
