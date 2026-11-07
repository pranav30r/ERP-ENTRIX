import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { loginAsUser } from '../services/api';
import { clearAllCache } from '../hooks/useCachedFetch';

export interface UserProfile {
  id?: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'SUPER_ADMIN' | 'HR_MANAGER' | 'FINANCE_OFFICER' | 'PROCUREMENT_OFFICER' | 'STAFF_USER' | string;
  department?: string | null;
}

export interface DemoPersona {
  name: string;
  email: string;
  role: string;
  desc: string;
  department: string;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  { name: 'Aditya Admin', email: 'admin@entrix.local', role: 'SUPER_ADMIN', desc: 'Full System Control & Audit', department: 'Executive Management' },
  { name: 'Sarah Jenkins', email: 'hr@entrix.local', role: 'HR_MANAGER', desc: 'Personnel, Attendance & PR Lead Approval', department: 'Human Resources' },
  { name: 'Rajesh Menon', email: 'finance@entrix.local', role: 'FINANCE_OFFICER', desc: 'Double-Entry Ledger & PR Sign-off', department: 'Finance' },
  { name: 'Kavita Rao', email: 'procurement@entrix.local', role: 'PROCUREMENT_OFFICER', desc: 'Stock Adjustments, POs & GRN', department: 'Supply Chain' },
  { name: 'Vikram Mehta', email: 'staff@entrix.local', role: 'STAFF_USER', desc: 'Submit Requisitions & View Items', department: 'Operations' }
];

interface AuthContextType {
  user: UserProfile | null;
  role: string;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  switchRole: (email: string) => Promise<void>;
  hasRole: (allowedRoles: string[]) => boolean;
  canAccessWorkspace: (path: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('entrix_token'));
  const [user, setUser] = useState<UserProfile | null>(() => {
    const raw = localStorage.getItem('entrix_user');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // ignore
      }
    }
    return {
      email: 'admin@entrix.local',
      first_name: 'Aditya',
      last_name: 'Admin',
      role: 'SUPER_ADMIN'
    };
  });
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!token) {
      loginAsUser('admin@entrix.local', 'Admin@123')
        .then((data) => {
          setToken(data.access_token);
          setUser(data.user);
        })
        .catch((err) => {
          console.error('Initialization auth error:', err);
        });
    }
  }, [token]);

  const switchRole = useCallback(async (email: string) => {
    setLoading(true);
    try {
      const data = await loginAsUser(email, 'Admin@123');
      // Clear all in-memory query cache on persona / user / tenant switch
      clearAllCache();
      setToken(data.access_token);
      setUser(data.user);
      localStorage.setItem('entrix_token', data.access_token);
      localStorage.setItem('entrix_user', JSON.stringify(data.user));
    } catch (err) {
      console.error('Failed to switch persona:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const currentRole = user?.role || 'STAFF_USER';

  const hasRole = useCallback((allowedRoles: string[]): boolean => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    return allowedRoles.includes(user.role);
  }, [user]);

  const canAccessWorkspace = useCallback((path: string): boolean => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;

    switch (path) {
      case '/':
      case '/procurement':
        return true;
      case '/inventory':
        return true;
      case '/ai-insights':
        return ['SUPER_ADMIN', 'PROCUREMENT_OFFICER', 'FINANCE_OFFICER'].includes(user.role);
      case '/finance':
        return ['SUPER_ADMIN', 'FINANCE_OFFICER'].includes(user.role);
      case '/hr':
        return ['SUPER_ADMIN', 'HR_MANAGER'].includes(user.role);
      case '/projects':
        return ['SUPER_ADMIN', 'HR_MANAGER', 'FINANCE_OFFICER', 'PROCUREMENT_OFFICER'].includes(user.role);
      case '/audit':
        return ['SUPER_ADMIN', 'FINANCE_OFFICER', 'HR_MANAGER'].includes(user.role);
      default:
        return true;
    }
  }, [user]);

  const value = useMemo<AuthContextType>(() => ({
    user,
    role: currentRole,
    token,
    isAuthenticated: !!token,
    loading,
    switchRole,
    hasRole,
    canAccessWorkspace
  }), [user, currentRole, token, loading, switchRole, hasRole, canAccessWorkspace]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
