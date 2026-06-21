import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/layout/Layout';
import OnboardingWizard from './components/OnboardingWizard';
import EmployeeOnboarding from './components/EmployeeOnboarding';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import SetPasswordPage from './pages/SetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import ShiftsPage from './pages/ShiftsPage';
import ChecklistsPage from './pages/ChecklistsPage';
import ChecklistExecutionPage from './pages/ChecklistExecutionPage';
import ChatPage from './pages/ChatPage';
import TeamPage from './pages/TeamPage';
import SettingsPage from './pages/SettingsPage';
import EquipmentPage from './pages/EquipmentPage';
import InventoryPage from './pages/InventoryPage';
import CustomersPage from './pages/CustomersPage';
import ClaimsPage from './pages/ClaimsPage';
import TrainingPage from './pages/TrainingPage';
import TasksPage from './pages/TasksPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SuppliersPage from './pages/SuppliersPage';
import AuditLogPage from './pages/AuditLogPage';
import NotificationsPage from './pages/NotificationsPage';
import ReportsPage from './pages/ReportsPage';
import MultiLocationAnalyticsPage from './pages/MultiLocationAnalyticsPage';
import IntegrationsPage from './pages/IntegrationsPage';
import AIInsightsPage from './pages/AIInsightsPage';
import ConsolePlaceholder from './pages/ConsolePlaceholder';
import HistoryReportsPage from './pages/HistoryReportsPage';
import ChemicalsPage from './pages/ChemicalsPage';
import SDSLibraryPage from './pages/SDSLibraryPage';
import GaugesPage from './pages/GaugesPage';
import SOPsPage from './pages/SOPsPage';
import LearningPage from './pages/LearningPage';
import ReviewsPage from './pages/ReviewsPage';
import OrdersPage from './pages/OrdersPage';
import SchedulePage from './pages/SchedulePage';
import KioskPage from './pages/KioskPage';
import WorkOrdersPage from './pages/WorkOrdersPage';
import DocumentsPage from './pages/DocumentsPage';
import OverviewPage from './pages/OverviewPage';
import { Wrench, Star, Gauge, FileText, Droplets, ShoppingCart, CalendarDays, Monitor } from 'lucide-react';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading ARSHI...</p>
        </div>
      </div>
    );
  }
  return user ? children : <Navigate to="/login" />;
}

function AppRoutes() {
  const { user, loading, locations } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState(
    () => localStorage.getItem('washops-onboarding-done') === 'true'
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Show onboarding wizard for new users with no locations
  if (user && (!locations || locations.length === 0) && !onboardingDone) {
    return <OnboardingWizard onComplete={() => setOnboardingDone(true)} />;
  }

  // Block new hires from the app until they finish their onboarding paperwork & training.
  if (user && user.role === 'EMPLOYEE' && !user.onboardingCompletedAt) {
    return <EmployeeOnboarding />;
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/" /> : <RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <SocketProvider>
              <Layout>
                <Routes>
                  <Route path="/" element={<OverviewPage />} />
                  <Route path="/shifts" element={<ShiftsPage />} />
                  <Route path="/checklists" element={<ChecklistsPage />} />
                  <Route path="/checklists/:checklistId" element={<ChecklistExecutionPage />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/team" element={<TeamPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/equipment" element={<EquipmentPage />} />
                  <Route path="/inventory" element={<InventoryPage />} />
                  <Route path="/customers" element={<CustomersPage />} />
                  <Route path="/claims" element={<ClaimsPage />} />
                  <Route path="/training" element={<TrainingPage />} />
                  <Route path="/learning" element={<LearningPage />} />
                  <Route path="/tasks" element={<TasksPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/suppliers" element={<SuppliersPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/reports" element={<HistoryReportsPage />} />
                  <Route path="/multi-location-analytics" element={<MultiLocationAnalyticsPage />} />
                  <Route path="/integrations" element={<IntegrationsPage />} />
                  <Route path="/ai-insights" element={<AIInsightsPage />} />
                  <Route path="/audit" element={<AuditLogPage />} />

                  {/* OpsConsole */}
                  <Route path="/work-orders" element={<WorkOrdersPage />} />
                  <Route path="/reviews" element={<ReviewsPage />} />
                  <Route path="/gauges" element={<GaugesPage />} />
                  <Route path="/sops" element={<SOPsPage />} />

                  {/* StockConsole */}
                  <Route path="/orders" element={<OrdersPage />} />

                  {/* ChemConsole */}
                  <Route path="/chemicals" element={<ChemicalsPage />} />
                  <Route path="/sds" element={<SDSLibraryPage />} />
                  <Route path="/documents" element={<DocumentsPage />} />

                  {/* TeamConsole */}
                  <Route path="/schedule" element={<SchedulePage />} />
                  <Route path="/kiosk" element={<KioskPage />} />
                </Routes>
              </Layout>
            </SocketProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
