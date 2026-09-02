import { useState, type FormEvent } from 'react';
import type { PlatformStaff } from '../../types/platform-staff';

export interface StaffFormValues {
  firstName: string;
  lastName: string;
  email: string;
  initialPassword?: string;
}

interface StaffFormProps {
  staff?: PlatformStaff;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (values: StaffFormValues) => Promise<void>;
}

export function StaffForm({
  staff,
  submitting,
  submitLabel,
  onSubmit,
}: StaffFormProps) {
  const [firstName, setFirstName] = useState(staff?.firstName ?? '');
  const [lastName, setLastName] = useState(staff?.lastName ?? '');
  const [email, setEmail] = useState(staff?.email ?? '');
  const [initialPassword, setInitialPassword] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      ...(staff ? {} : { initialPassword }),
    });
  }

  return (
    <form className="login-form admin-form" onSubmit={(event) => void submit(event)}>
      <div className="form-grid">
        <label>
          First name
          <input
            required
            maxLength={100}
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </label>
        <label>
          Last name
          <input
            required
            maxLength={100}
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </label>
        <label className="field-wide">
          Work email
          <input
            required
            type="email"
            maxLength={320}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {!staff && (
          <label className="field-wide">
            Initial password
            <input
              required
              type="password"
              minLength={12}
              autoComplete="new-password"
              value={initialPassword}
              onChange={(event) => setInitialPassword(event.target.value)}
            />
            <small>Minimum 12 characters. Share it through an approved secure channel.</small>
          </label>
        )}
      </div>
      <div className="form-actions">
        <button className="button" type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
