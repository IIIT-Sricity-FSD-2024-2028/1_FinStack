import { type FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from || '/', { replace: true });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Sign-in could not be completed.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand login-brand" aria-label="FinStack Admin">
          <span className="brand-mark">F</span>
          <span>
            <strong>FinStack</strong>
            <small>Control plane</small>
          </span>
        </div>
        <p className="eyebrow">Internal access</p>
        <h1 id="login-title">Welcome back</h1>
        <p className="page-description">
          Sign in with your platform staff account.
        </p>

        <form className="login-form" onSubmit={(event) => void submit(event)}>
          <label>
            Work email
            <input
              autoComplete="username"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
