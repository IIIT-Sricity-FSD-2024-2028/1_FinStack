(function () {
  function setPage() {
    if (document.body) document.body.dataset.page = 'reconciliation-page';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setPage);
  setPage();
})();
