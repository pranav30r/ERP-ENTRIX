import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { loginAsUser } from '../services/api';

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
    return null;
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize session or default to SUPER_ADMIN
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem('entrix_token');
        const storedUser = localStorage.getItem('entrix_user');

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        } else {
          // Default to demo admin persona
          const loginData = await loginAsUser('admin@entrix.local', 'Admin@123');
          setToken(loginData.access_token);
          setUser(loginData.user);
        }
      } catch (err) {
        console.warn('Authentication bootstrap fallback:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const switchRole = async (email: string) => {
    setLoading(true);
    try {
      const data = await loginAsUser(email, 'Admin@123');
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
  };

  const currentRole = user?.role || 'STAFF_USER';

  const hasRole = (allowedRoles: string[]): boolean => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    return allowedRoles.includes(user.role);
  };

  const canAccessWorkspace = (path: string): boolean => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;

    switch (path) {
      case '/':
      case '/procurement':
        return true; // All roles can see dashboard and submit or view PRs
      case '/inventory':
        return true; // All can view inventory; adjustments restricted inside page
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
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: currentRole,
        token,
        isAuthenticated: !!token,
        loading,
        switchRole,
        hasRole,
        canAccessWorkspace
      }}
    >
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
