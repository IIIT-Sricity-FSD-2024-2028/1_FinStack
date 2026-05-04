initLayout('Profile Settings');
lucide.createIcons();

window.togglePw = function(id) {
  const input = document.getElementById(id);
  input.type = input.type === 'password' ? 'text' : 'password';
};

window.FinStackStore.ready.then(() => {
  const user = window.FinStackStore.getCurrentUser();
  if (!user) return;

  const initials = user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const roleName = window.FinStackStore.getRoleName(user.roles[0]) || 'Role';

  document.getElementById('profile-avatar-letters').textContent = initials;
  document.getElementById('profile-display-name').textContent = user.fullName;
  document.getElementById('profile-display-role').textContent = roleName;

  document.getElementById('profile-fullname').value = user.fullName;
  document.getElementById('profile-email').value = user.email;
  document.getElementById('profile-email').readOnly = true;
  document.getElementById('profile-empid').value = user.employeeId;
  document.getElementById('profile-department').value = user.department || '';
  document.getElementById('profile-phone').value = user.phone || '';
  document.getElementById('profile-location').value = user.location || '';

  // Handle Save Profile Info
  document.getElementById('btn-save-profile').addEventListener('click', () => {
    const msg = document.getElementById('profile-msg');
    const fullName = document.getElementById('profile-fullname').value.trim();
    if (!fullName) {
      msg.textContent = 'Full name is required.';
      msg.style.color = '#f87171';
      msg.style.display = 'inline-block';
      return;
    }
    const result = window.FinStackStore.updateUser(user.employeeId, {
      fullName: fullName,
      email: user.email,
      department: document.getElementById('profile-department').value.trim(),
      phone: document.getElementById('profile-phone').value.trim(),
      location: document.getElementById('profile-location').value.trim()
    });
    if (result && result.success === false) {
      msg.textContent = result.error || 'Profile update failed.';
      msg.style.color = '#f87171';
      msg.style.display = 'inline-block';
      return;
    }
    document.getElementById('profile-display-name').textContent = fullName;
    document.getElementById('profile-avatar-letters').textContent = fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    msg.textContent = 'Profile updated successfully!';
    msg.style.color = 'var(--green)';
    msg.style.display = 'inline-block';
    setTimeout(() => msg.style.display = 'none', 3000);
  });

  // Handle Change Password
  document.getElementById('btn-update-pw').addEventListener('click', () => {
    const currentPw = document.getElementById('current-pw').value;
    const newPw = document.getElementById('new-pw').value;
    const confirmPw = document.getElementById('confirm-pw').value;
    const msg = document.getElementById('pw-msg');

    msg.style.display = 'inline-block';
    
    if (currentPw !== user.password) {
      msg.textContent = 'Incorrect current password.';
      msg.style.color = '#f87171';
      return;
    }
    if (newPw.length < 6) {
      msg.textContent = 'New password must be at least 6 characters.';
      msg.style.color = '#f87171';
      return;
    }
    if (newPw !== confirmPw) {
      msg.textContent = 'New passwords do not match.';
      msg.style.color = '#f87171';
      return;
    }

    const res = window.FinStackStore.changePassword(user.employeeId, currentPw, newPw);
    if (res.success) {
      msg.textContent = 'Password updated successfully!';
      msg.style.color = 'var(--green)';
      document.getElementById('current-pw').value = '';
      document.getElementById('new-pw').value = '';
      document.getElementById('confirm-pw').value = '';
      setTimeout(() => msg.style.display = 'none', 3000);
    } else {
      msg.textContent = res.error || 'Failed to update password.';
      msg.style.color = '#f87171';
    }
  });

});
