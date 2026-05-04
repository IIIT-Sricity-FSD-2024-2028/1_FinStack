(function () {
  window.FinStackNotification = {
    show: function (message) {
      if (window.Toast && typeof window.Toast.info === 'function') {
        window.Toast.info(message);
      }
    }
  };
})();
