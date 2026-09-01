import { useState, type FormEvent } from 'react';
import type { PlatformRole } from '../../types/platform-role';

export interface RoleFormValues {
  key?: string;
  name: string;
  description: string;
}

export function RoleForm({
  role,
  submitting,
  submitLabel,
  onSubmit,
}: {
  role?: PlatformRole;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (values: RoleFormValues) => Promise<void>;
}) {
  const [key, setKey] = useState('');
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      ...(role ? {} : { key: key.trim() }),
      name: name.trim(),
      description: description.trim(),
    });
  }

  return (
    <form className="login-form admin-form" onSubmit={(event) => void submit(event)}>
      <div className="form-grid">
        {!role && (
          <label>
            Role key
            <input
              required
              maxLength={100}
              placeholder="PLATFORM_OPERATIONS"
              value={key}
              onChange={(event) => setKey(event.target.value)}
            />
            <small>Use the exact stable key expected by backend validation.</small>
          </label>
        )}
        <label className={role ? 'field-wide' : undefined}>
          Role name
          <input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="field-wide">
          Description <span className="optional-label">Optional</span>
          <textarea maxLength={500} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
      </div>
      <div className="form-actions">
        <button className="button" disabled={submitting} type="submit">
          {submitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
