import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';

export const App: React.FC = () => {
  return (
    <Router>
      <div className="flex h-screen bg-stripe-canvas overflow-hidden">
        {/* Linear-style Charcoal Sidebar */}
        <Sidebar />

        {/* Main Work Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Stripe-style Header */}
          <Header />

          {/* Page Body */}
          <main className="p-8 max-w-7xl w-full mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="*" element={<Dashboard />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
};

export default App;
