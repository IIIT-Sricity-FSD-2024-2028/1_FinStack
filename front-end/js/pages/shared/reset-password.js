lucide.createIcons();
    function togglePw(inputId, iconId) {
      const input = document.getElementById(inputId);
      const icon = document.getElementById(iconId);
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
      lucide.createIcons();
    }
    document.getElementById('reset-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const newPw = document.getElementById('new-pw').value;
      const confirmPw = document.getElementById('confirm-pw').value;
      const errorMsg = document.getElementById('error-msg');
      if (newPw.length < 8) { errorMsg.textContent = 'Password must be at least 8 characters long'; errorMsg.style.display = 'block'; return; }
      if (newPw !== confirmPw) { errorMsg.textContent = 'Passwords do not match'; errorMsg.style.display = 'block'; return; }
      errorMsg.style.display = 'none';
      document.getElementById('form-view').style.display = 'none';
      document.getElementById('success-view').style.display = 'block';
      lucide.createIcons();
    });