initLayout('Expense Categories');

/* ── Helper ───────────────────────────────────────── */
function escCat(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ── Render ───────────────────────────────────────── */
function renderCategories(list) {
  document.getElementById('cat-tbody').innerHTML = list.map(category => {
    const statusColor = category.status === 'Active'
      ? {bg:'#10B98120',text:'#10B981',border:'#10B981'}
      : {bg:'#EF444420',text:'#EF4444',border:'#EF4444'};
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="category-bar" style="background:${escCat(category.color)};"></div>
          <span style="font-weight:500;color:var(--text-primary);">${escCat(category.name)}</span>
        </div>
      </td>
      <td style="color:var(--text-secondary);max-width:300px;" class="truncate">${escCat(category.description)}</td>
      <td><span class="badge" style="background:${statusColor.bg};color:${statusColor.text};border-color:${statusColor.border}40;">${escCat(category.status)}</span></td>
      <td>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="btn-icon btn-icon-edit" title="Edit category" onclick="openEditCategoryModal('${escCat(category.id)}')">
            <i data-lucide="pencil" style="width:15px;height:15px;"></i>
          </button>
          <button class="btn-icon btn-icon-danger" title="Delete category" onclick="confirmDeleteCategory('${escCat(category.id)}','${escCat(category.name)}')">
            <i data-lucide="trash-2" style="width:15px;height:15px;"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
  lucide.createIcons();
  const info = document.getElementById('cat-page-info');
  if (info) info.textContent = list.length ? `Showing 1-${list.length} of ${list.length} categories` : 'No categories found';
}

/* ── Filter ───────────────────────────────────────── */
function filterCategories() {
  const query  = (document.getElementById('cat-search')?.value || '').toLowerCase();
  const status = document.getElementById('cat-status-filter')?.value || 'all';
  const list   = window.FinStackStore.getCategories().filter(c => {
    const matchQ = !query || c.name.toLowerCase().includes(query) || (c.description || '').toLowerCase().includes(query);
    const matchS = status === 'all' || c.status === status;
    return matchQ && matchS;
  });
  renderCategories(list);
}

/* ── Add Category Form ────────────────────────────── */
function bindCategoryForm() {
  document.getElementById('category-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = document.getElementById('category-name').value.trim();
    if (!name) return;
    window.FinStackStore.addCategory({
      name,
      description:     document.getElementById('category-description').value.trim(),
      requiresReceipt: document.getElementById('category-requires-receipt').classList.contains('active')
    });
    document.getElementById('category-form').reset();
    document.getElementById('category-requires-receipt').classList.add('active');
    closeModal('category-modal');
    filterCategories();
  });
}

/* ── Edit Category Modal ──────────────────────────── */
window.openEditCategoryModal = function(id) {
  const category = window.FinStackStore.getCategories().find(c => c.id === id);
  if (!category) return;

  const idEl   = document.getElementById('edit-category-id');
  const nameEl = document.getElementById('edit-cat-name');
  const descEl = document.getElementById('edit-cat-description');
  const statEl = document.getElementById('edit-cat-status');
  if (idEl)   idEl.value   = category.id;
  if (nameEl) nameEl.value = category.name;
  if (descEl) descEl.value = category.description || '';
  if (statEl) statEl.value = category.status || 'Active';

  openModal('edit-category-modal');
};

function bindEditCategoryForm() {
  const form = document.getElementById('edit-category-form');
  if (!form) return;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const id = document.getElementById('edit-category-id').value;
    window.FinStackStore.updateCategory(id, {
      name:        document.getElementById('edit-cat-name').value.trim(),
      description: document.getElementById('edit-cat-description').value.trim(),
      status:      document.getElementById('edit-cat-status').value
    });
    closeModal('edit-category-modal');
    filterCategories();
    if (typeof Toast !== 'undefined') Toast.success('Category updated successfully.');
  });
}

/* ── Delete Category ──────────────────────────────── */
window.confirmDeleteCategory = function(id, name) {
  var msg = document.getElementById('delete-confirm-msg');
  var btn = document.getElementById('delete-confirm-btn');
  if (!msg || !btn) return;
  msg.textContent = 'Are you sure you want to delete category "' + name + '"?';
  openModal('delete-confirm-modal');
  // Replace handler to avoid stacking
  var newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', function() {
    var ok = window.FinStackStore.deleteCategory(id);
    if (ok) {
      filterCategories();
      if (typeof Toast !== 'undefined') Toast.success('Category deleted.');
    } else {
      if (typeof Toast !== 'undefined') Toast.error('Could not delete this category.');
    }
    closeModal('delete-confirm-modal');
  });
};

/* ── Init ─────────────────────────────────────────── */
window.FinStackStore.ready.then(() => {
  filterCategories();
  bindCategoryForm();
  bindEditCategoryForm();
  document.getElementById('cat-search')?.addEventListener('input', filterCategories);
  document.getElementById('cat-status-filter')?.addEventListener('change', filterCategories);
  lucide.createIcons();
});
