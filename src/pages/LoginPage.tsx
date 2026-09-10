import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { theme } from '../config/theme';
import { Button, FormInput, Icons } from '../components/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) { setError('Enter your username'); return; }
    if (!pin || pin.length < 4) { setError('Enter a valid 4+ digit PIN'); return; }
    setLoading(true);
    const err = await login(username.trim(), pin);
    if (err) setError(err);
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center px-6 overflow-hidden"
      style={{ backgroundColor: theme.colors.bg }}>
      {/* Decorative ambient glows — pure CSS, no new colors */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full blur-3xl"
        style={{ backgroundColor: theme.colors.primary, opacity: 0.16 }} />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -right-20 w-[380px] h-[380px] rounded-full blur-3xl"
        style={{ backgroundColor: theme.colors.secondary, opacity: 0.12 }} />

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative mb-5">
            <div aria-hidden="true" className="absolute inset-0 rounded-full blur-2xl"
              style={{ backgroundColor: theme.colors.primary, opacity: 0.25 }} />
            <img src="/icons/logo.png" alt="Show Me Italy" className="relative w-24 h-24 rounded-2xl object-cover"
              style={{ border: `1px solid ${theme.colors.border}` }} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: theme.colors.white }}>
            Show Me <span style={{ color: theme.colors.primary }}>Italy</span>
          </h1>
          <p className="text-[11px] mt-1.5 tracking-[0.2em] uppercase font-medium" style={{ color: theme.colors.grayDark }}>
            Staff Calendar
          </p>
        </div>

        <form onSubmit={handleLogin} noValidate>
          <div className="rounded-2xl p-6 relative overflow-hidden"
            style={{ backgroundColor: theme.colors.bgElevated, border: `1px solid ${theme.colors.border}` }}>
            <div aria-hidden="true" className="absolute top-0 left-0 right-0 h-[3px]"
              style={{ background: `linear-gradient(90deg, ${theme.colors.primary}, ${theme.colors.primaryLight}, ${theme.colors.primary})` }} />

            <h2 className="text-base font-bold mb-0.5" style={{ color: theme.colors.white }}>Welcome back</h2>
            <p className="text-xs mb-5" style={{ color: theme.colors.grayDark }}>Sign in to manage your schedule</p>

            <FormInput label="Username" placeholder="Enter your username" value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
              icon={<span style={{ color: theme.colors.grayDark }}>{Icons.user}</span>} />
            <FormInput label="PIN" type="password" placeholder="••••" value={pin}
              onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
              icon={<span style={{ color: theme.colors.grayDark }}>{Icons.lock}</span>} />

            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-lg px-3 py-2 mb-3 -mt-1"
                style={{ backgroundColor: theme.colors.danger + '15', border: `1px solid ${theme.colors.danger}40` }}>
                <span aria-hidden="true" style={{ color: theme.colors.danger }}>!</span>
                <p className="text-xs" style={{ color: theme.colors.danger }}>{error}</p>
              </div>
            )}

            <Button type="submit" variant="primary" fullWidth size="lg" disabled={loading}
              icon={!loading ? <span aria-hidden="true">{Icons.chevronRight}</span> : undefined}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </div>
        </form>

        <p className="text-center text-[10px] mt-6" style={{ color: theme.colors.grayDarker }}>
          Show Me Italy Staff Calendar
        </p>
      </div>
    </div>
  );
}
