(function () {
  function setPage() {
    if (document.body) document.body.dataset.page = 'payments-page';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setPage);
  setPage();
})();
