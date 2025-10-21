import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load heavy dashboard components with error logging
const lazyWithLog = (loader: () => Promise<any>, name: string) =>
  lazy(() =>
    loader().catch((e) => {
      console.error(`Lazy import failed: ${name}`, e);
      throw e;
    })
  );

const Index = lazyWithLog(() => import("./pages/Index"), 'Index');
const AuthPage = lazyWithLog(() => import("./pages/AuthPage"), 'AuthPage');
const AdminDashboard = lazyWithLog(() => import("./pages/AdminDashboard"), 'AdminDashboard');
const CompanyDashboard = lazyWithLog(() => import("./pages/CompanyDashboard"), 'CompanyDashboard');
const CompanyShifts = lazyWithLog(() => import("./pages/CompanyShifts"), 'CompanyShifts');
const CompanyGuards = lazyWithLog(() => import("./pages/CompanyGuards"), 'CompanyGuards');
const CompanyProperties = lazyWithLog(() => import("./pages/CompanyProperties"), 'CompanyProperties');
const GuardDashboard = lazyWithLog(() => import("./pages/GuardDashboard"), 'GuardDashboard');
const ChangePasswordPage = lazyWithLog(() => import("./pages/ChangePasswordPage"), 'ChangePasswordPage');
const NotFound = lazyWithLog(() => import("./pages/NotFound"), 'NotFound');

// Loading component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="space-y-4 w-full max-w-md p-6">
      <Skeleton className="h-8 w-3/4 mx-auto" />
      <Skeleton className="h-4 w-1/2 mx-auto" />
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  </div>
);

// Optimized QueryClient with better defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/company" element={<CompanyDashboard />} />
              <Route path="/company/shifts" element={<CompanyShifts />} />
              <Route path="/company/guards" element={<CompanyGuards />} />
              <Route path="/company/properties" element={<CompanyProperties />} />
              <Route path="/guard" element={<GuardDashboard />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
