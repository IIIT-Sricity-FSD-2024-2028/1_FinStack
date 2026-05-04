lucide.createIcons();
    document.getElementById('forgot-form').addEventListener('submit', (e) => {
      e.preventDefault();
      document.getElementById('form-view').style.display = 'none';
      document.getElementById('success-view').style.display = 'block';
      lucide.createIcons();
    });