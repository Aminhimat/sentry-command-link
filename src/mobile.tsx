import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import AuthPage from '@/pages/AuthPage';
import GuardDashboard from '@/pages/GuardDashboard';
import ChangePasswordPage from '@/pages/ChangePasswordPage';
import '@/App.css';

const queryClient = new QueryClient();

function MobileApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/guard" element={<GuardDashboard />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            {/* Redirect any other routes to auth */}
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </Routes>
          <Toaster />
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default MobileApp;