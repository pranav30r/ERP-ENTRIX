import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NavProvider } from './context/NavContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LoadingFallback } from './components/ui/LoadingFallback';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

// Route-level code-splitting for high-performance chunked loading
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Procurement = lazy(() => import('./pages/Procurement').then(m => ({ default: m.Procurement })));
const Inventory = lazy(() => import('./pages/Inventory'));
const AIInsights = lazy(() => import('./pages/AIInsights').then(m => ({ default: m.AIInsights })));
const Finance = lazy(() => import('./pages/Finance'));
const HR = lazy(() => import('./pages/HR'));
const Projects = lazy(() => import('./pages/Projects'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const CompanySettings = lazy(() => import('./pages/CompanySettings'));
const SubscriptionBilling = lazy(() => import('./pages/SubscriptionBilling'));
const NotFound = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));

export const App = () => {
  return (
    <AuthProvider>
      <NavProvider>
        <Router>
        <div className="flex h-screen bg-stripe-canvas overflow-hidden">
          {/* Skip link for keyboard accessibility (WCAG 2.2 AA) */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white text-xs font-semibold"
          >
            Skip to main content
          </a>

          {/* Linear-style Charcoal Sidebar */}
          <Sidebar />

          {/* Main Work Area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
            {/* Stripe-style Header */}
            <Header />

            {/* Page Body */}
            <main id="main-content" tabIndex={-1} className="p-6 md:p-8 xl:p-10 w-full max-w-[1920px] mx-auto focus:outline-none">
              <ErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/procurement" element={<Procurement />} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/ai-insights" element={<AIInsights />} />
                    <Route path="/finance" element={<Finance />} />
                    <Route path="/hr" element={<HR />} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/audit" element={<AuditLogs />} />
                    <Route path="/settings/company" element={<CompanySettings />} />
                    <Route path="/settings/billing" element={<SubscriptionBilling />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </main>
          </div>
        </div>
      </Router>
      </NavProvider>
    </AuthProvider>
  );
};

export default App;
