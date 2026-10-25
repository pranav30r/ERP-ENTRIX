import React, { createContext, useContext, useState } from 'react';

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleMobile = () => setMobileOpen((prev) => !prev);

  return (
    <NavContext.Provider value={{ mobileOpen, setMobileOpen, toggleMobile }}>
      {children}
    </NavContext.Provider>
  );
};

export const useNav = () => useContext(NavContext);
