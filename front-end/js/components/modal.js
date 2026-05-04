(function () {
  window.FinStackModal = {
    open: function (element) {
      if (element) element.classList.add('active');
    },
    close: function (element) {
      if (element) element.classList.remove('active');
    }
  };
})();
