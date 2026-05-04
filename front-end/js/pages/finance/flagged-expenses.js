(function () {
  function setPage() {
    if (document.body) document.body.dataset.page = 'flagged-page';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setPage);
  setPage();
})();
