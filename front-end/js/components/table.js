(function () {
  window.FinStackTable = {
    filterRows: function (rows, predicate) {
      Array.prototype.forEach.call(rows || [], function (row) {
        row.style.display = predicate(row) ? '' : 'none';
      });
    }
  };
})();
