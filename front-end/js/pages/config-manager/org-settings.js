initLayout('Organization Settings');
lucide.createIcons();

function setToggleState(id, active) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('active', !!active);
}

window.FinStackStore.ready.then(() => {
  const org = window.FinStackStore.getOrganization();
  document.getElementById('org-name').value = org.name || '';
  document.getElementById('org-id').value = org.organizationId || '';
  document.getElementById('org-email').value = org.email || '';
  document.getElementById('org-size').value = org.size || '51-200 employees';
  document.getElementById('org-address').value = org.address || '';
  document.getElementById('org-currency').value = org.currency === 'INR' ? 'INR - Indian Rupee' : `${org.currency} - ${org.currency}`;
  document.getElementById('org-fiscal-year').value = org.fiscalYearStart || 'April';
  document.getElementById('org-tax-id').value = org.taxId || '';
  document.getElementById('org-payment-method').value = org.defaultPaymentMethod || 'Bank Transfer';
  setToggleState('org-email-notifications', org.notifications && org.notifications.email);
  setToggleState('org-slack-notifications', org.notifications && org.notifications.slack);
  setToggleState('org-budget-alerts', org.notifications && org.notifications.budgetAlerts);
  setToggleState('org-policy-alerts', org.notifications && org.notifications.policyViolationAlerts);

  document.getElementById('save-btn').addEventListener('click', () => {
    const currencyValue = document.getElementById('org-currency').value.split(' - ')[0];
    window.FinStackStore.updateOrganization({
      name: document.getElementById('org-name').value.trim(),
      email: document.getElementById('org-email').value.trim(),
      size: document.getElementById('org-size').value,
      address: document.getElementById('org-address').value.trim(),
      currency: currencyValue,
      fiscalYearStart: document.getElementById('org-fiscal-year').value,
      taxId: document.getElementById('org-tax-id').value.trim(),
      defaultPaymentMethod: document.getElementById('org-payment-method').value,
      notifications: {
        email: document.getElementById('org-email-notifications').classList.contains('active'),
        slack: document.getElementById('org-slack-notifications').classList.contains('active'),
        budgetAlerts: document.getElementById('org-budget-alerts').classList.contains('active'),
        policyViolationAlerts: document.getElementById('org-policy-alerts').classList.contains('active')
      }
    });
    const msg = document.getElementById('org-save-msg');
    if (msg) {
      msg.textContent = 'Organization settings saved successfully.';
      msg.style.display = 'inline-block';
      setTimeout(() => msg.style.display = 'none', 3000);
    }
  });
});
