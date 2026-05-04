(function () {
    'use strict';

    var PREFERENCES_KEY = 'finstack-submitter-preferences-v1';
    var defaultPreferences = {
        defaultCurrency: 'INR (₹)',
        interfaceTheme: 'Dark Mode',
        defaultPage: 'dashboard',
        language: 'English (US)',
        timezone: 'Asia/Kolkata',
        emailAlerts: true,
        pushNotifications: true,
        weeklyDigest: true
    };

    function readPreferences() {
        try {
            var raw = localStorage.getItem(PREFERENCES_KEY);
            return raw ? Object.assign({}, defaultPreferences, JSON.parse(raw)) : Object.assign({}, defaultPreferences);
        } catch (error) {
            return Object.assign({}, defaultPreferences);
        }
    }

    function writePreferences(preferences) {
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    }

    function getSession() {
        try {
            return JSON.parse(sessionStorage.getItem('finstackUserSession')) || null;
        } catch (error) {
            return null;
        }
    }

    function getCurrentUser() {
        return window.FinStackStore ? window.FinStackStore.getCurrentUser() || null : null;
    }

    function getInitials(fullName) {
        return String(fullName || 'ES')
            .split(' ')
            .map(function (part) { return part.charAt(0); })
            .join('')
            .slice(0, 2)
            .toUpperCase();
    }

    function setText(id, value) {
        var node = document.getElementById(id);
        if (node) node.textContent = value;
    }

    function setValue(id, value) {
        var node = document.getElementById(id);
        if (node) node.value = value;
    }

    function setChecked(id, value) {
        var node = document.getElementById(id);
        if (node) node.checked = !!value;
    }

    function updateSummary(user) {
        if (!user) return;

        var session = getSession();
        var lastLogin = session && session.loginAt
            ? new Date(session.loginAt).toLocaleString()
            : 'Current session';
        var initials = getInitials(user.fullName);

        setText('profileAvatarInitials', initials);
        setText('settingsAvatarInitials', initials);
        setText('profileName', user.fullName || 'Expense Submitter');
        setText('profileEmail', user.email || 'No email available');
        setText('profileEmployeeId', user.employeeId || '-');
        setText('profileOrgId', user.organizationId || '-');
        setText('profileManagerId', user.managerEmployeeId || '-');
        setText('profileStatus', user.status || 'Active');
        setText('profileLastLogin', lastLogin);

        if (typeof updateTopbarUser === 'function') {
            updateTopbarUser();
        }
    }

    function populateProfileForm() {
        var user = getCurrentUser();
        var preferences = readPreferences();
        if (!user) return;

        updateSummary(user);

        setValue('profile-name-input', user.fullName || '');
        setValue('profile-email-input', user.email || '');
        setValue('profile-employee-id', user.employeeId || '');
        setValue('profile-department-input', user.department || '');
        setValue('profile-phone-input', user.phone || '');
        setValue('profile-location-input', user.location || '');
        setValue('profile-org-id', user.organizationId || '');
        setValue('profile-manager-id', user.managerEmployeeId || '');

        setValue('pref-default-currency', preferences.defaultCurrency);
        setValue('pref-interface-theme', preferences.interfaceTheme);
        setValue('pref-default-page', preferences.defaultPage);
        setValue('pref-language', preferences.language);
        setValue('pref-timezone', preferences.timezone);
        setChecked('pref-email-alerts', preferences.emailAlerts);
        setChecked('pref-push-notifications', preferences.pushNotifications);
        setChecked('pref-weekly-digest', preferences.weeklyDigest);
    }

    function setActiveTab(tabName) {
        var tabs = document.querySelectorAll('.settings-tab');
        var panels = document.querySelectorAll('.tab-panel');

        for (var i = 0; i < tabs.length; i++) {
            tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === tabName);
        }

        for (var j = 0; j < panels.length; j++) {
            panels[j].classList.toggle('active', panels[j].getAttribute('data-panel') === tabName);
        }
    }

    function bindTabs() {
        var tabs = document.querySelectorAll('.settings-tab');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].addEventListener('click', function () {
                setActiveTab(this.getAttribute('data-tab'));
            });
        }
    }

    function bindProfileForm() {
        var form = document.getElementById('submitter-profile-form');
        if (!form) return;

        form.addEventListener('submit', function (event) {
            event.preventDefault();

            var user = getCurrentUser();
            if (!user || !window.FinStackStore) {
                showToast('Profile data is still loading. Please try again.', 'error');
                return;
            }

            var updates = {
                fullName: (document.getElementById('profile-name-input') || {}).value || user.fullName,
                email: (document.getElementById('profile-email-input') || {}).value || user.email,
                department: (document.getElementById('profile-department-input') || {}).value || '',
                phone: (document.getElementById('profile-phone-input') || {}).value || '',
                location: (document.getElementById('profile-location-input') || {}).value || '',
                managerEmployeeId: (document.getElementById('profile-manager-id') || {}).value || ''
            };

            var result = window.FinStackStore.updateUser(user.employeeId, updates);
            if (result && result.success === false) {
                showToast(result.error || 'Unable to save profile.', 'error');
                return;
            }

            updateSummary(result || user);
            populateProfileForm();
            showToast('Profile updated successfully.');
        });
    }

    function bindPreferencesForm() {
        var button = document.getElementById('savePreferencesBtn');
        if (!button) return;

        button.addEventListener('click', function () {
            var preferences = {
                defaultCurrency: document.getElementById('pref-default-currency').value,
                interfaceTheme: document.getElementById('pref-interface-theme').value,
                defaultPage: document.getElementById('pref-default-page').value,
                language: document.getElementById('pref-language').value,
                timezone: document.getElementById('pref-timezone').value,
                emailAlerts: document.getElementById('pref-email-alerts').checked,
                pushNotifications: document.getElementById('pref-push-notifications').checked,
                weeklyDigest: document.getElementById('pref-weekly-digest').checked
            };

            writePreferences(preferences);
            showToast('Preferences saved.');
        });
    }

    function bindPasswordForm() {
        var form = document.getElementById('submitter-password-form');
        if (!form) return;

        form.addEventListener('submit', function (event) {
            event.preventDefault();

            var user = getCurrentUser();
            if (!user || !window.FinStackStore) {
                showToast('Profile data is still loading. Please try again.', 'error');
                return;
            }

            var currentPassword = document.getElementById('current-password-input').value;
            var newPassword = document.getElementById('new-password-input').value;
            var confirmPassword = document.getElementById('confirm-password-input').value;

            if (!currentPassword) {
                showToast('Current password is required.', 'error');
                return;
            }
            if (newPassword.length < 8) {
                showToast('New password must be at least 8 characters.', 'error');
                return;
            }
            if (newPassword !== confirmPassword) {
                showToast('New password and confirm password must match.', 'error');
                return;
            }

            var result = window.FinStackStore.changePassword(user.employeeId, currentPassword, newPassword);
            if (!result || result.success === false) {
                showToast(result && result.error ? result.error : 'Unable to update password.', 'error');
                return;
            }

            form.reset();
            showToast('Password updated successfully.');
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        FinStack.whenReady(function () {
            populateProfileForm();
            bindTabs();
            bindProfileForm();
            bindPreferencesForm();
            bindPasswordForm();
            setActiveTab('profile');
        });
    });
})();
