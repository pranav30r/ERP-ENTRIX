import { useState } from 'react';

const STORAGE_KEY = 'entrix_show_test_data';

export function useTestDataToggle() {
  const [showTestData, setShowTestData] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) === true : false;
    } catch {
      return false;
    }
  });

  const toggle = (val?: boolean) => {
    setShowTestData((prev) => {
      const next = typeof val === 'boolean' ? val : !prev;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return { showTestData, toggle };
}
