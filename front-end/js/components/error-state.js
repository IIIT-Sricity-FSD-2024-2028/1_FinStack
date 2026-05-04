(function () {
  window.FinStackErrorState = {
    render: function (title, description) {
      return '<div class=\"error-state\"><h3>' + (title || 'Something went wrong') + '</h3><p>' +
        (description || 'Please try again.') + '</p></div>';
    }
  };
})();
