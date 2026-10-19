import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types.ts';

interface DemoAccount {
  role: 'SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE';
  name: string;
  email: string;
  username: string;
  passwordHint: string;
  designation: string;
  department: string;
  employeeId?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (identifier: string, pass: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  demoAccounts: DemoAccount[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('erp_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);

  // Fetch demo accounts
  useEffect(() => {
    fetch('/api/auth/demo-accounts')
      .then((res) => res.json())
      .then((data) => {
        if (data.accounts) setDemoAccounts(data.accounts);
      })
      .catch((err) => console.error('Failed to load demo accounts', err));
  }, []);

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
        } else {
          // Token expired or invalid
          localStorage.removeItem('erp_token');
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.error('Session verify failed', err);
      } finally {
        setIsLoading(false);
      }
    };

    verifySession();
  }, []);

  const login = async (identifier: string, pass: string): Promise<boolean> => {
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: pass }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Authentication failed.');
        setIsLoading(false);
        return false;
      }

      localStorage.setItem('erp_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setIsLoading(false);
      return true;
    } catch (err: any) {
      setError('Network connection error. Server may be starting.');
      setIsLoading(false);
      return false;
    }
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        // silent catch
      }
    }
    localStorage.removeItem('erp_token');
    setToken(null);
    setUser(null);
    setError(null);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        error,
        login,
        logout,
        clearError,
        demoAccounts,
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
