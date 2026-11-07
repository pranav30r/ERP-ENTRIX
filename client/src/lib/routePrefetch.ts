// Route prefetch registry for high-performance intent preloading
const routeLoaders: Record<string, () => Promise<any>> = {
  '/': () => import('../pages/Dashboard'),
  '/procurement': () => import('../pages/Procurement'),
  '/inventory': () => import('../pages/Inventory'),
  '/ai-insights': () => import('../pages/AIInsights'),
  '/finance': () => import('../pages/Finance'),
  '/hr': () => import('../pages/HR'),
  '/projects': () => import('../pages/Projects'),
  '/audit': () => import('../pages/AuditLogs'),
  '/settings/company': () => import('../pages/CompanySettings'),
  '/settings/billing': () => import('../pages/SubscriptionBilling')
};

export function prefetchRoute(path: string): void {
  const loader = routeLoaders[path];
  if (loader) {
    loader().catch(() => {
      // Non-blocking prefetch failure ignore
    });
  }
}
