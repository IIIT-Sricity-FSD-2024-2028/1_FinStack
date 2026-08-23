import { useMemo, useState, type FormEvent } from 'react';
import type {
  Organization,
  OrganizationPayload,
  OrganizationStatus,
} from '../../types/organization';
import { organizationStatuses, statusLabel } from './organization-ui';

interface OrganizationFormProps {
  organization?: Organization;
  includeStatus?: boolean;
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
  status: OrganizationStatus;
  externalCustomerRef: string;
  metadata: string;
}

export function OrganizationForm({
  organization,
  includeStatus = false,
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
      status: organization?.status ?? 'PROVISIONING',
      externalCustomerRef: organization?.externalCustomerRef ?? '',
      metadata: organization?.metadata
        ? JSON.stringify(organization.metadata, null, 2)
        : '',
    }),
    [organization],
  );
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

    await onSubmit({
      name: values.name.trim(),
      slug: optional(values.slug),
      primaryEmail: values.primaryEmail.trim(),
      primaryContactName: optional(values.primaryContactName),
      primaryContactEmail: optional(values.primaryContactEmail),
      billingEmail: optional(values.billingEmail),
      country: optional(values.country),
      defaultCurrency: optional(values.defaultCurrency),
      timezone: optional(values.timezone),
      status: includeStatus ? values.status : undefined,
      externalCustomerRef: optional(values.externalCustomerRef),
      metadata,
    });
  }

  function update(field: keyof OrganizationFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  return (
    <form className="login-form organization-form" onSubmit={(event) => void submit(event)}>
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
            value={values.name}
            onChange={(event) => update('name', event.target.value)}
          />
        </label>
        <label>
          Slug
          <input
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
            value={values.primaryEmail}
            onChange={(event) => update('primaryEmail', event.target.value)}
          />
        </label>
        <label>
          Primary contact
          <input
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
            value={values.billingEmail}
            onChange={(event) => update('billingEmail', event.target.value)}
          />
        </label>
        <label>
          Country
          <input
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
            value={values.timezone}
            placeholder="Asia/Kolkata"
            onChange={(event) => update('timezone', event.target.value)}
          />
        </label>
        {includeStatus && (
          <label>
            Initial status
            <select
              value={values.status}
              onChange={(event) =>
                update('status', event.target.value as OrganizationStatus)
              }
            >
              {organizationStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          External customer ref
          <input
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
