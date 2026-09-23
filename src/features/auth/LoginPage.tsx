import { useState, type FormEvent } from 'react';
import { AlertCircle, LogIn } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim()) { setError('Enter your username.'); return; }
    if (pin.length < 4) { setError('Your PIN has at least 4 digits.'); return; }
    setLoading(true);
    const err = await login(username.trim(), pin);
    if (err) setError('That username and PIN don’t match. Check both and try again.');
    setLoading(false);
  };

  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      <div className="absolute top-3 right-3 pt-safe">
        <ThemeToggle />
      </div>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3">
            <img src="/icons/logo.png" alt="" aria-hidden="true" className="size-12 rounded-xl border object-cover" />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Show Me Italy</h1>
              <p className="text-sm text-muted-foreground">Staff calendar</p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">Use your username and staff PIN.</p>

          <form onSubmit={handleLogin} noValidate>
            <FieldGroup>
              <Field data-invalid={!!error && !username.trim() ? true : undefined}>
                <FieldLabel htmlFor="username">Username</FieldLabel>
                <Input
                  id="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="Your username"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(''); }}
                  className="h-10"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="pin">PIN</FieldLabel>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  placeholder="4–6 digits"
                  value={pin}
                  onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                  className="h-10 tracking-[0.3em] placeholder:tracking-normal"
                />
              </Field>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" size="lg" className="h-10 w-full" disabled={loading}>
                {loading ? <Spinner /> : <LogIn />}
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </FieldGroup>
          </form>

          <p className="mt-8 text-xs text-muted-foreground">
            Forgot your PIN? Ask your manager to reset it.
          </p>
        </div>
      </main>
    </div>
  );
}
