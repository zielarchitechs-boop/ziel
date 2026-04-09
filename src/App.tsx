/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Routes, Route } from 'react-router-dom';
import { DisplayInvoice } from './types';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import LandingPage from './pages/LandingPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { OrderFormModal, InvoiceModal } from './components/Modals';
import { SessionTimeout } from './components/SessionTimeout';
import { isSupabaseConfigured } from './lib/supabase';
import { AlertCircle, ExternalLink } from 'lucide-react';

const ConfigWarning = () => {
  if (isSupabaseConfigured) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-center gap-3 text-amber-800 text-sm font-medium animate-in slide-in-from-top duration-500">
      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
      <span>Supabase is not configured. Add <b>VITE_SUPABASE_URL</b> and <b>VITE_SUPABASE_ANON_KEY</b> to your Secrets.</span>
      <a 
        href="https://supabase.com" 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-amber-900 hover:underline font-bold"
      >
        Get Keys <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
};

export default function App() {
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<DisplayInvoice | null>(null);

  return (
    <SessionTimeout>
      <ConfigWarning />
      <Routes>
        <Route path="/" element={<LandingPage onOrderClick={() => setIsOrderModalOpen(true)} />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute adminOnly>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
      </Routes>

      <AnimatePresence>
        {isOrderModalOpen && (
          <OrderFormModal 
            isOpen={isOrderModalOpen} 
            onClose={() => setIsOrderModalOpen(false)} 
            onOrderComplete={(invoice) => setActiveInvoice(invoice)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeInvoice && (
          <InvoiceModal 
            invoice={activeInvoice} 
            onClose={() => setActiveInvoice(null)} 
          />
        )}
      </AnimatePresence>
    </SessionTimeout>
  );
}
