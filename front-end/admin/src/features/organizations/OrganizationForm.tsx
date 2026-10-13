import { useMemo, useRef, useState, type FormEvent } from 'react';
import type {
  Organization,
  OrganizationPayload,
} from '../../types/organization';

interface OrganizationFormProps {
  organization?: Organization;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (payload: OrganizationPayload) => Promise<void>;
}

interface OrganizationFormValues {
  name: string;
  slug: string;
  primaryEmail: string;
  primaryContactName: string;
  primaryContactEmail: string;
  billingEmail: string;
  country: string;
  defaultCurrency: string;
  timezone: string;
  externalCustomerRef: string;
  metadata: string;
}

export function OrganizationForm({
  organization,
  submitting,
  submitLabel,
  onSubmit,
}: OrganizationFormProps) {
  const initialValues = useMemo<OrganizationFormValues>(
    () => ({
      name: organization?.name ?? '',
      slug: organization?.slug ?? '',
      primaryEmail: organization?.primaryEmail ?? '',
      primaryContactName: organization?.primaryContactName ?? '',
      primaryContactEmail: organization?.primaryContactEmail ?? '',
      billingEmail: organization?.billingEmail ?? '',
      country: organization?.country ?? '',
      defaultCurrency: organization?.defaultCurrency ?? 'INR',
      timezone: organization?.timezone ?? '',
      externalCustomerRef: organization?.externalCustomerRef ?? '',
      metadata: organization?.metadata
        ? JSON.stringify(organization.metadata, null, 2)
        : '',
    }),
    [organization],
  );
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);

  const submitLock = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || submitLock.current) return;
    setError(null);

    let metadata: Record<string, unknown> | undefined;
    if (values.metadata.trim()) {
      try {
        const parsed = JSON.parse(values.metadata) as unknown;
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          throw new Error('Metadata must be a JSON object.');
        }
        metadata = parsed as Record<string, unknown>;
      } catch (error) {
        setError(
          error instanceof Error ? error.message : 'Metadata JSON is invalid.',
        );
        return;
      }
    }

    submitLock.current = true;
    try { await onSubmit({
      name: values.name.trim(),
      slug: optional(values.slug),
      primaryEmail: values.primaryEmail.trim(),
      primaryContactName: optional(values.primaryContactName),
      primaryContactEmail: optional(values.primaryContactEmail),
      billingEmail: optional(values.billingEmail),
      country: optional(values.country),
      defaultCurrency: optional(values.defaultCurrency),
      timezone: optional(values.timezone),
      externalCustomerRef: optional(values.externalCustomerRef),
      metadata,
    }); } finally { submitLock.current = false; }
  }

  function update(field: keyof OrganizationFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <form aria-busy={submitting} className="login-form organization-form" onSubmit={(event) => void submit(event)}>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="form-grid">
        <label>
          Organization name
          <input
            required
            maxLength={180}
            minLength={2}
            pattern={String.raw`[^\p{Cc}\p{Cf}<>]*\S[^\p{Cc}\p{Cf}<>]*`}
            disabled={submitting || Boolean(organization?.registrationSubmittedAt)}
            value={values.name}
            onChange={(event) => update('name', event.target.value)}
          />
        </label>
        <label>
          Slug
          <input
            maxLength={120}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            disabled={submitting}
            value={values.slug}
            placeholder="acme-finance"
            onChange={(event) => update('slug', event.target.value)}
          />
        </label>
        <label>
          Primary email
          <input
            required
            type="email"
            maxLength={320}
            disabled={submitting || Boolean(organization?.registrationSubmittedAt)}
            value={values.primaryEmail}
            onChange={(event) => update('primaryEmail', event.target.value)}
          />
        </label>
        <label>
          Primary contact
          <input
            maxLength={201}
            disabled={submitting || Boolean(organization?.registrationSubmittedAt)}
            value={values.primaryContactName}
            onChange={(event) =>
              update('primaryContactName', event.target.value)
            }
          />
        </label>
        <label>
          Contact email
          <input
            type="email"
            maxLength={320}
            disabled={submitting || Boolean(organization?.registrationSubmittedAt)}
            value={values.primaryContactEmail}
            onChange={(event) =>
              update('primaryContactEmail', event.target.value)
            }
          />
        </label>
        <label>
          Billing email
          <input
            type="email"
            maxLength={320}
            disabled={submitting}
            value={values.billingEmail}
            onChange={(event) => update('billingEmail', event.target.value)}
          />
        </label>
        <label>
          Country
          <input
            maxLength={100}
            disabled={submitting || Boolean(organization?.registrationSubmittedAt)}
            value={values.country}
            onChange={(event) => update('country', event.target.value)}
          />
        </label>
        <label>
          Currency
          <input
            maxLength={3}
            value={values.defaultCurrency}
            onChange={(event) =>
              update('defaultCurrency', event.target.value.toUpperCase())
            }
          />
        </label>
        <label>
          Timezone
          <input
            maxLength={80}
            disabled={submitting}
            value={values.timezone}
            placeholder="Asia/Kolkata"
            onChange={(event) => update('timezone', event.target.value)}
          />
        </label>
        <label>
          External customer ref
          <input
            maxLength={160}
            disabled={submitting}
            value={values.externalCustomerRef}
            onChange={(event) =>
              update('externalCustomerRef', event.target.value)
            }
          />
        </label>
      </div>
      <label className="field-wide">
        Metadata JSON
        <textarea
          rows={7}
          value={values.metadata}
          placeholder={'{"segment":"mid-market"}'}
          onChange={(event) => update('metadata', event.target.value)}
        />
      </label>
      <div className="form-actions">
        <button className="button" type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function optional(value: string): string | undefined {
  return value.trim() || undefined;
}
