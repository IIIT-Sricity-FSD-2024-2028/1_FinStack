initLayout('Expense Policies');

/* ── Helper ───────────────────────────────────────── */
function escPol(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ── Render ───────────────────────────────────────── */
function renderPolicies(list) {
  document.getElementById('policy-tbody').innerHTML = list.map(policy => {
    const statusColor = policy.status === 'Active'
      ? {bg:'#10B98120',text:'#10B981',border:'#10B981'}
      : {bg:'#EF444420',text:'#EF4444',border:'#EF4444'};
    return `<tr>
      <td style="font-weight:500;color:var(--text-primary);">${escPol(policy.name)}</td>
      <td><span class="badge badge-purple">${escPol(policy.category)}</span></td>
      <td style="font-weight:500;color:var(--text-primary);">₹${Number(policy.maxAmount || 0).toLocaleString('en-IN')}</td>
      <td style="color:var(--text-secondary);">${escPol(policy.approval)}</td>
      <td><span class="badge" style="background:${statusColor.bg};color:${statusColor.text};border-color:${statusColor.border}40;">${escPol(policy.status)}</span></td>
      <td>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn-icon btn-icon-edit" title="Edit policy" onclick="openEditPolicyModal('${escPol(policy.id)}')">
            <i data-lucide="pencil" style="width:15px;height:15px;"></i>
          </button>
          <button class="btn-icon btn-icon-danger" title="Delete policy" onclick="confirmDeletePolicy('${escPol(policy.id)}','${escPol(policy.name)}')">
            <i data-lucide="trash-2" style="width:15px;height:15px;"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
  lucide.createIcons();
  const info = document.querySelector('.pagination-info');
  if (info) info.textContent = list.length ? `Showing 1-${list.length} of ${list.length} policies` : 'No policies found';
}

/* ── Category options ─────────────────────────────── */
function populateCategoryOptions(selectId) {
  const select = document.getElementById(selectId || 'policy-category');
  const filter = document.getElementById('policy-cat-filter');
  const categories = window.FinStackStore.getCategories();
  const options = categories.map(c => `<option value="${c.id}">${escPol(c.name)}</option>`).join('');
  if (select) select.innerHTML = options || '<option value="">No categories</option>';
  if (filter) {
    filter.innerHTML = '<option value="all">All Categories</option>' +
      categories.map(c => `<option value="${escPol(c.name)}">${escPol(c.name)}</option>`).join('');
  }
}

/* ── Filter ───────────────────────────────────────── */
function filterPolicies() {
  const query  = (document.getElementById('policy-search')?.value || '').toLowerCase();
  const cat    = document.getElementById('policy-cat-filter')?.value || 'all';
  const status = document.getElementById('policy-status-filter')?.value || 'all';
  const list   = window.FinStackStore.getPolicies().filter(p => {
    const matchQ = !query || p.name.toLowerCase().includes(query) || (p.description || '').toLowerCase().includes(query);
    const matchC = cat === 'all' || p.category === cat;
    const matchS = status === 'all' || p.status === status;
    return matchQ && matchC && matchS;
  });
  renderPolicies(list);
}

/* ── Add Policy Form ──────────────────────────────── */
function bindPolicyForm() {
  document.getElementById('policy-form').addEventListener('submit', event => {
    event.preventDefault();
    const categories = window.FinStackStore.getCategories();
    const categoryId = document.getElementById('policy-category').value;
    const category   = categories.find(item => item.id === categoryId);
    window.FinStackStore.addPolicy({
      name:             document.getElementById('policy-name').value.trim(),
      categoryId:       category ? category.id : 'all_categories',
      category:         category ? category.name : 'All Categories',
      maxAmount:        Number(document.getElementById('policy-amount').value || 0),
      description:      document.getElementById('policy-description').value.trim(),
      requiresApproval: document.getElementById('policy-requires-approval').classList.contains('active'),
      receiptRequired:  document.getElementById('policy-receipt-required').classList.contains('active'),
      approval:         document.getElementById('policy-requires-approval').classList.contains('active') ? 'Manager + Finance' : 'Auto Approved'
    });
    document.getElementById('policy-form').reset();
    document.getElementById('policy-requires-approval').classList.add('active');
    document.getElementById('policy-receipt-required').classList.add('active');
    closeModal('policy-modal');
    filterPolicies();
  });
}

/* ── Edit Policy Modal ────────────────────────────── */
window.openEditPolicyModal = function(id) {
  // Policy IDs can be numeric; coerce for safe lookup
  const numId = isNaN(Number(id)) ? id : Number(id);
  const policy = window.FinStackStore.getPolicies().find(p => p.id === numId || String(p.id) === String(id));
  if (!policy) return;

  // Populate category select for edit modal
  populateCategoryOptions('edit-policy-category');
  const editCatSel = document.getElementById('edit-policy-category');
  if (editCatSel) {
    // Set selected option
    Array.from(editCatSel.options).forEach(opt => {
      const cats = window.FinStackStore.getCategories();
      const match = cats.find(c => c.id === policy.categoryId || c.name === policy.category);
      opt.selected = match ? opt.value === match.id : false;
    });
  }

  const nameEl   = document.getElementById('edit-policy-name');
  const amtEl    = document.getElementById('edit-policy-amount');
  const descEl   = document.getElementById('edit-policy-description');
  const statusEl = document.getElementById('edit-policy-status');
  const idEl     = document.getElementById('edit-policy-id');
  if (nameEl)   nameEl.value   = policy.name;
  if (amtEl)    amtEl.value    = policy.maxAmount || 0;
  if (descEl)   descEl.value   = policy.description || '';
  if (statusEl) statusEl.value = policy.status || 'Active';
  if (idEl)     idEl.value     = policy.id;

  openModal('edit-policy-modal');
};

function bindEditPolicyForm() {
  const form = document.getElementById('edit-policy-form');
  if (!form) return;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const rawId      = document.getElementById('edit-policy-id').value;
    const id         = isNaN(Number(rawId)) ? rawId : Number(rawId);
    const categories = window.FinStackStore.getCategories();
    const categoryId = document.getElementById('edit-policy-category').value;
    const category   = categories.find(c => c.id === categoryId);
    window.FinStackStore.updatePolicy(id, {
      name:        document.getElementById('edit-policy-name').value.trim(),
      categoryId:  category ? category.id : categoryId,
      category:    category ? category.name : 'All Categories',
      maxAmount:   Number(document.getElementById('edit-policy-amount').value || 0),
      description: document.getElementById('edit-policy-description').value.trim(),
      status:      document.getElementById('edit-policy-status').value
    });
    closeModal('edit-policy-modal');
    filterPolicies();
    if (typeof Toast !== 'undefined') Toast.success('Policy updated successfully.');
  });
}

/* ── Delete Policy ────────────────────────────────── */
window.confirmDeletePolicy = function(id, name) {
  var msg = document.getElementById('delete-confirm-msg');
  var btn = document.getElementById('delete-confirm-btn');
  if (!msg || !btn) return;
  msg.textContent = 'Are you sure you want to delete policy "' + name + '"?';
  openModal('delete-confirm-modal');
  // Replace handler to avoid stacking
  var newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', function() {
    var numId = isNaN(Number(id)) ? id : Number(id);
    var ok = window.FinStackStore.deletePolicy(numId);
    if (ok) {
      filterPolicies();
      if (typeof Toast !== 'undefined') Toast.success('Policy deleted.');
    } else {
      if (typeof Toast !== 'undefined') Toast.error('Could not delete this policy.');
    }
    closeModal('delete-confirm-modal');
  });
};

/* ── Init ─────────────────────────────────────────── */
window.FinStackStore.ready.then(() => {
  populateCategoryOptions('policy-category');
  filterPolicies();
  bindPolicyForm();
  bindEditPolicyForm();
  document.getElementById('policy-search')?.addEventListener('input', filterPolicies);
  document.getElementById('policy-cat-filter')?.addEventListener('change', filterPolicies);
  document.getElementById('policy-status-filter')?.addEventListener('change', filterPolicies);
  lucide.createIcons();
});
