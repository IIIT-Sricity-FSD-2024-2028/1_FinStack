import './organization-registration-review.css';
import { useRef, useState } from 'react';
import { PermissionGate } from '../../auth/PermissionGate';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { reviewOrganization } from '../../services/api/platform-organizations';
import type { Organization } from '../../types/organization';

export function OrganizationRegistrationReview({ organization, onReviewed }: { organization: Organization; onReviewed: () => Promise<void> }) {
  const [note, setNote] = useState('');
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const lock = useRef(false);
  const valid = note.trim().length >= 20 && note.trim().length <= 2000 && !/[\p{Cc}\p{Cf}<>]/u.test(note.replace(/[\n\r\t]/g, ''));
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || busy || !valid) return;
    setConfirmOpen(true);
  }
  async function confirmReview() {
    if (lock.current || busy || !valid || !confirmOpen) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await reviewOrganization(organization.id, decision, note.trim());
      setConfirmOpen(false);
      await onReviewed();
    } catch (err) {
      setConfirmOpen(false);
      setError(err instanceof Error ? err.message : 'Review could not be saved.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return <><article className="status-card form-panel organization-registration-review" aria-labelledby="registration-review-title">
    <h2 id="registration-review-title">Organization registration review</h2>
    <p><strong>{organization.registrationStatus === 'LEGACY_APPROVED' ? 'Trusted Admin provisioning / preserved historical access' : organization.registrationStatus?.replaceAll('_', ' ') ?? 'Historical organization'}</strong></p>
    <dl>
      <dt>Submitted</dt><dd>{organization.registrationSubmittedAt ?? 'Historical organization; no new verification asserted'}</dd>
      <dt>Registration country / identifier</dt><dd>{organization.registrationCountry ?? 'Not recorded'} / {organization.registrationIdentifier ?? organization.registrationExemptionReason ?? 'Not recorded'}</dd>
      <dt>Official domain</dt><dd>{organization.normalizedDomain ?? 'Not recorded'} — {organization.domainVerifiedAt ? 'Verified' : 'Ownership unverified'}</dd>
      <dt>Authorized contact</dt><dd>{organization.primaryContactName} / {organization.primaryContactEmail} / {organization.authorizedContactTitle ?? 'Not recorded'}</dd>
      <dt>Review record</dt><dd>{organization.reviewNote ?? 'No manual review recorded'} {organization.reviewedAt} {organization.reviewedByStaffId && ` (Staff ${organization.reviewedByStaffId})`}</dd>
    </dl>
    <p className="muted-copy">Review supplied identity and independently obtained evidence. Approval permits tenant access; it does not certify legal genuineness or prove domain control. Email verification delivery is unavailable.</p>
    {organization.registrationStatus === 'PENDING_ORGANIZATION_REVIEW' && organization.status === 'PROVISIONING' &&
      <PermissionGate permission="platform.organization.update"><PermissionGate permission="platform.organization.reactivate">
        <form className="login-form" onSubmit={(event) => void submit(event)} aria-busy={busy}>
          <label htmlFor="registration-decision">Decision</label>
          <select id="registration-decision" className="form-input" value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)} disabled={busy}>
            <option value="APPROVED">Approve tenant access after manual review</option><option value="REJECTED">Reject registration</option>
          </select>
          <label htmlFor="registration-note">Evidence checked and decision reason</label>
          <textarea id="registration-note" className="form-input" value={note} onChange={(event) => setNote(event.target.value)} minLength={20} maxLength={2000} required disabled={busy} aria-describedby="registration-note-help registration-note-error" aria-invalid={Boolean(note && !valid)} rows={5} />
          <p id="registration-note-help">20–2000 characters. Record evidence sources and limitations. Do not include passwords or confidential documents.</p>
          <p id="registration-note-error" aria-live="polite">{note && !valid ? 'Enter 20–2000 characters without markup or unsupported control characters.' : ''}</p>
          {error && <p role="alert">{error}</p>}
          <button type="submit" className="button button-primary" disabled={busy || !valid}>{busy ? 'Saving review…' : 'Save review decision'}</button>
        </form>
      </PermissionGate></PermissionGate>}
  </article>
  <ConfirmDialog
    open={confirmOpen && organization.registrationStatus === 'PENDING_ORGANIZATION_REVIEW' && organization.status === 'PROVISIONING'}
    title={decision === 'APPROVED' ? 'Approve organization access' : 'Reject registration'}
    message={<>
      <p><strong>{organization.name}</strong></p>
      <p>This records a manual review; it does not establish legal genuineness or domain ownership.</p>
      <p>Your evidence and decision reason will be saved with this review.</p>
    </>}
    confirmLabel={decision === 'APPROVED' ? 'Approve access' : 'Reject registration'}
    destructive={decision === 'REJECTED'}
    pending={busy}
    onCancel={() => { if (!busy) setConfirmOpen(false); }}
    onConfirm={() => { void confirmReview(); }}
  />
  </>;
}
