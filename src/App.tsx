import { AuthProvider, useAuth } from './context/AuthContext';
import { LeaveProvider } from './context/LeaveContext';
import { AppDataProvider } from './context/AppDataContext';
import { SwapProvider } from './context/SwapContext';
import { TaskProvider } from './context/TaskContext';
import { NotificationProvider } from './context/NotificationContext';
import { LanguageProvider } from './context/LanguageContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import AppShell from './components/layout/AppShell';
import InstallPrompt from './components/InstallPrompt';

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
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </ErrorBoundary>
  );
}
