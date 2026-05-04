(function () {
  window.FinStackEmptyState = {
    render: function (title, description) {
      return '<div class=\"empty-state\"><h3>' + (title || 'Nothing here yet') + '</h3><p>' +
        (description || 'Content will appear here once data is available.') + '</p></div>';
    }
  };
})();
