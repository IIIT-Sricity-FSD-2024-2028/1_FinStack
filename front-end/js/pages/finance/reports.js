(function () {
  function setPage() {
    if (document.body) document.body.dataset.page = 'reports-page';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setPage);
  setPage();
})();
