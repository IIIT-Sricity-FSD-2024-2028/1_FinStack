import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationRegistrationReview } from './OrganizationRegistrationReview';
import { reviewOrganization } from '../../services/api/platform-organizations';
import type { Organization } from '../../types/organization';
const policy = vi.hoisted(() => ({ allowed: true }));
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ hasPermission: () => policy.allowed }) }));
vi.mock('../../services/api/platform-organizations', () => ({ reviewOrganization: vi.fn() }));
const organization = { id:'org-1', name:'Example organization', status:'PROVISIONING', registrationStatus:'PENDING_ORGANIZATION_REVIEW', registrationCountry:'IN', registrationIdentifier:'REG-123', domainVerifiedAt:null, normalizedDomain:'example-company.org' } as Organization;
describe('Organization registration review', () => {
  beforeEach(() => { policy.allowed = true; vi.clearAllMocks(); vi.spyOn(window,'confirm').mockReturnValue(true); });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });
  it('requires an evidence note and submits only one authorized decision while a request is pending', async () => {
    let resolve!: (org: Organization) => void;
    vi.mocked(reviewOrganization).mockImplementation(() => new Promise(done => { resolve = done; }));
    const onReviewed = vi.fn().mockResolvedValue(undefined);
    render(<OrganizationRegistrationReview organization={organization} onReviewed={onReviewed} />);
    const save = screen.getByRole('button',{name:'Save review decision'});
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Evidence checked and decision reason'),{target:{value:'Checked evidence source.\nDomain control is still unverified.'}});
    expect(save).toBeEnabled();
    const form = save.closest('form')!;
    fireEvent.submit(form);fireEvent.submit(form);
    expect(reviewOrganization).toHaveBeenCalledTimes(1);
    expect(reviewOrganization).toHaveBeenCalledWith('org-1','APPROVED','Checked evidence source.\nDomain control is still unverified.');
    resolve(organization);await waitFor(() => expect(onReviewed).toHaveBeenCalledTimes(1));
  });
  it('keeps review evidence for retry after an API failure', async () => {
    vi.mocked(reviewOrganization).mockRejectedValue(new Error('Review was changed by another reviewer.'));
    render(<OrganizationRegistrationReview organization={organization} onReviewed={vi.fn()} />);
    const note = screen.getByLabelText('Evidence checked and decision reason');
    fireEvent.change(note,{target:{value:'Independent evidence is insufficient for approval.'}});
    fireEvent.change(screen.getByLabelText('Decision'),{target:{value:'REJECTED'}});
    fireEvent.click(screen.getByRole('button',{name:'Save review decision'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('another reviewer');
    expect(note).toHaveValue('Independent evidence is insufficient for approval.');
  });
  it('shows honest unverified context without offering review actions to unauthorized staff', () => {
    policy.allowed = false;
    render(<OrganizationRegistrationReview organization={organization} onReviewed={vi.fn()} />);
    expect(screen.getByText(/Ownership unverified/)).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Save review decision'})).not.toBeInTheDocument();
    expect(reviewOrganization).not.toHaveBeenCalled();
  });
});
