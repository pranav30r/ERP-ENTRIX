import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

interface NavContextType {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  toggleMobile: () => void;
}

const NavContext = createContext<NavContextType>({
  mobileOpen: false,
  setMobileOpen: () => {},
  toggleMobile: () => {}
});

export const NavProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileOpen, setMobileOpenState] = useState(false);

  const setMobileOpen = useCallback((open: boolean) => {
    setMobileOpenState(open);
  }, []);

  const toggleMobile = useCallback(() => {
    setMobileOpenState((prev) => !prev);
  }, []);

  const value = useMemo<NavContextType>(() => ({
    mobileOpen,
    setMobileOpen,
    toggleMobile
  }), [mobileOpen, setMobileOpen, toggleMobile]);

  return (
    <NavContext.Provider value={value}>
      {children}
    </NavContext.Provider>
  );
};

export const useNav = () => useContext(NavContext);
