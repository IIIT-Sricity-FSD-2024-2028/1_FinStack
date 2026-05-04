initLayout('Preferences');

(function () {
  function getUserKey() {
    var user = window.FinStackStore && window.FinStackStore.getCurrentUser ? window.FinStackStore.getCurrentUser() : null;
    return user ? (user.employeeId || user.email) : 'anonymous';
  }

  function safeRead() {
    try {
      return JSON.parse(localStorage.getItem('finstack-user-preferences') || '{}');
    } catch (e) {
      return {};
    }
  }

  function collectPreferences() {
    return {
      compactMode: document.querySelectorAll('.toggle-switch')[0]?.classList.contains('active') || false,
      animations: document.querySelectorAll('.toggle-switch')[1]?.classList.contains('active') || false,
      emailDigest: document.querySelectorAll('.toggle-switch')[2]?.classList.contains('active') || false,
      desktopNotifications: document.querySelectorAll('.toggle-switch')[3]?.classList.contains('active') || false,
      soundAlerts: document.querySelectorAll('.toggle-switch')[4]?.classList.contains('active') || false,
      autoRefresh: document.querySelectorAll('.toggle-switch')[5]?.classList.contains('active') || false
    };
  }

  function showMessage(text) {
    var msg = document.getElementById('preferences-msg');
    if (!msg) return;
    msg.textContent = text;
    msg.style.display = 'block';
    setTimeout(function () { msg.style.display = 'none'; }, 2500);
  }

  window.FinStackStore.ready.then(function () {
    if (window.lucide) lucide.createIcons();
    var btn = document.getElementById('save-preferences-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var all = safeRead();
      all[getUserKey()] = collectPreferences();
      localStorage.setItem('finstack-user-preferences', JSON.stringify(all));
      showMessage('Preferences saved successfully.');
    });
  });
})();
