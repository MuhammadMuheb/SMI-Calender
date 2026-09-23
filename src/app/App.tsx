import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { LeaveProvider } from '@/features/leave/LeaveContext';
import { AppDataProvider } from '@/app/AppDataContext';
import { SwapProvider } from '@/features/swaps/SwapContext';
import { TaskProvider } from '@/features/tasks/TaskContext';
import { NotificationProvider } from '@/features/notifications/NotificationContext';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import LoginPage from '@/features/auth/LoginPage';
import AppShell from '@/components/layout/AppShell';
import InstallPrompt from '@/components/shared/InstallPrompt';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';

function AppInner() {
  const { user } = useAuth();
  return user ? (
    <LanguageProvider userId={user.id} username={user.username}>
      <AppDataProvider>
        <NotificationProvider>
          <LeaveProvider>
            <SwapProvider>
              <TaskProvider>
                <AppShell />
                <InstallPrompt />
              </TaskProvider>
            </SwapProvider>
          </LeaveProvider>
        </NotificationProvider>
      </AppDataProvider>
    </LanguageProvider>
  ) : (
    <>
      <LoginPage />
      <InstallPrompt />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <TooltipProvider delayDuration={300}>
          <AuthProvider>
            <AppInner />
          </AuthProvider>
          <Toaster position="top-center" richColors closeButton />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
