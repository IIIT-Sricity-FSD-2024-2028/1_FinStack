(function () {
  function read(key, fallbackValue) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallbackValue;
    } catch (error) {
      return fallbackValue;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  window.FinStackStorage = {
    read: read,
    write: write,
    remove: function (key) {
      localStorage.removeItem(key);
    }
  };
})();
