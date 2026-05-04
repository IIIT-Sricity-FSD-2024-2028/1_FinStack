(function () {
  window.FinStackValidation = {
    email: function (value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
    },
    password: function (value) {
      return typeof value === 'string' && value.length >= 8;
    },
    required: function (value) {
      return String(value || '').trim().length > 0;
    }
  };
})();
