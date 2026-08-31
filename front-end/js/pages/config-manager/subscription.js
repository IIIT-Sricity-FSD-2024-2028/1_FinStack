(function () {
    'use strict';

    var store = window.FinStackStore;
    var api = window.FinStackApi;
    var user = store.getCurrentUser();

    // UI Elements
    var plansContainer = document.getElementById('plans-container');
    var currentSubContainer = document.getElementById('current-subscription-container');
    var actionModal = document.getElementById('action-modal');

    // Run layout init synchronously so sidebar is populated before dashboard.js binds events on DOMContentLoaded
    if (typeof initLayout === 'function') {
        initLayout('Subscription Management');
    }
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Independent state — auth and subscription are separate concerns
    var currentSub = null;       // null = no subscription, object = has subscription
    var authState = 'UNKNOWN';   // UNKNOWN, AUTHENTICATED, AUTH_MISSING, AUTH_EXPIRED
    var availablePlans = [];

    /**
     * Check whether the existing customer session includes a tenant access token.
     * The token is stored in sessionStorage under 'finstackUserSession' by login.js.
     */
    function hasTenantToken() {
        try {
            var raw = sessionStorage.getItem('finstackUserSession');
            if (!raw) return false;
            var session = JSON.parse(raw);
            return !!(session && session.accessToken);
        } catch (e) {
            return false;
        }
    }

    function init() {
      if (!user || !user.organizationId) {
        plansContainer.innerHTML = '<p style="color:var(--red);">No organization context found. Please log in again.</p>';
        return;
      }

      // Load plans independently (no auth required)
      loadPlans();

      // Only attempt subscription fetch if we have a tenant token
      if (hasTenantToken()) {
          loadCurrentSubscription();
      } else {
          // User is logged into Configuration Manager but has no tenant JWT.
          // This is normal for sessions created before tenant auth was added.
          // Plans are still visible and actionable — subscription mutation
          // errors will be handled at action time.
          authState = 'AUTH_MISSING';
          currentSub = null;
          renderCurrentSubscription();
      }
    }

    function loadPlans() {
      plansContainer.innerHTML = '<p style="color:var(--text-secondary)">Loading available plans...</p>';

      api.request('/api/v1/tenant/plans')
        .then(function(res) {
          availablePlans = res && res.items ? res.items : (Array.isArray(res) ? res : []);

          if (!availablePlans || availablePlans.length === 0) {
            plansContainer.innerHTML = '<div class="card" style="padding: 24px; text-align: center;"><p style="color:var(--text-secondary); margin-bottom: 16px;">No plans are currently available.</p></div>';
            return;
          }

          // Plans loaded successfully — render them immediately
          renderPlans();
        })
        .catch(function(err) {
          plansContainer.innerHTML = '<div class="card" style="padding: 24px; text-align: center;">' +
            '<p style="color:var(--red); margin-bottom: 16px;">Unable to load available plans: ' + (err.message || 'Network error') + '</p>' +
            '<button class="btn btn-secondary" onclick="window.location.reload()">Retry</button></div>';
        });
    }

    function loadCurrentSubscription() {
      currentSubContainer.style.display = 'none';

      api.request('/api/v1/tenant/subscriptions/current')
        .then(function(res) {
          currentSub = res || null;
          authState = 'AUTHENTICATED';
          renderCurrentSubscription();
          // Re-render plans to update action buttons now that we know current subscription
          if (availablePlans.length > 0) {
            renderPlans();
          }
        })
        .catch(function(err) {
          var msg = err.message || '';
          if (msg.indexOf('401') !== -1 || msg.indexOf('Unauthorized') !== -1 || msg.indexOf('context missing') !== -1 || msg.indexOf('token') !== -1) {
            authState = 'AUTH_EXPIRED';
            currentSub = null;
          } else if (msg.indexOf('404') !== -1 || msg.indexOf('not found') !== -1) {
            authState = 'AUTHENTICATED';
            currentSub = null;
          } else {
            authState = 'AUTHENTICATED';
            currentSub = null;
          }
          renderCurrentSubscription();
          // Re-render plans to update action buttons
          if (availablePlans.length > 0) {
            renderPlans();
          }
        });
    }

    function loadData() {
      if (hasTenantToken()) {
        loadPlans();
        loadCurrentSubscription();
      } else {
        loadPlans();
      }
    }

    function renderCurrentSubscription() {
      if (authState === 'AUTH_MISSING') {
          // User is logged into the app but doesn't have a tenant JWT.
          // This happens when the session predates tenant auth, or user
          // navigated directly to subscription without a fresh login.
          currentSubContainer.style.display = 'block';
          currentSubContainer.innerHTML = '<div class="card" style="padding: 16px; margin-bottom: 24px; border: 1px solid rgba(245, 158, 11, 0.3); background: rgba(245, 158, 11, 0.05);">' +
            '<h3 style="color:var(--warning);margin:0 0 4px 0">Authentication Required</h3>' +
            '<p style="margin:0;font-size:14px;color:var(--text-secondary);">To manage your subscription, please sign out and sign back in. Your current session does not include the subscription authentication token.</p></div>';
          return;
      }

      if (authState === 'AUTH_EXPIRED') {
          currentSubContainer.style.display = 'block';
          currentSubContainer.innerHTML = '<div class="card" style="padding: 16px; margin-bottom: 24px; border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.05);">' +
            '<h3 style="color:var(--red);margin:0 0 4px 0">Session Expired</h3>' +
            '<p style="margin:0;font-size:14px;color:var(--text-secondary);">Your authentication session has expired. Please sign out and sign back in to manage your subscription.</p></div>';
          return;
      }

      if (!currentSub) {
        // Authenticated but no subscription — this is a valid state
        currentSubContainer.style.display = 'block';
        currentSubContainer.innerHTML = '<div class="card" style="padding: 16px; margin-bottom: 24px; border: 1px solid rgba(124, 58, 237, 0.2); background: rgba(124, 58, 237, 0.05);">' +
          '<h3 style="color:var(--primary);margin:0 0 4px 0">No Active Subscription</h3>' +
          '<p style="margin:0;font-size:14px;color:var(--text-secondary);">Your organization does not have an active subscription. Choose a plan below to get started.</p></div>';
        return;
      }

      var plan = availablePlans.find(function(p) { return p.id === currentSub.planId; });
      var planName = plan ? (plan.name + ' Plan') : 'Active Subscription';
      var planInterval = plan
        ? (plan.currency + ' ' + plan.basePrice + ' / ' + (currentSub.billingInterval || plan.billingInterval).toLowerCase())
        : (currentSub.currency + ' ' + currentSub.priceAtSubscription);

      var statusStr = currentSub.status || 'UNKNOWN';
      var badgeColor = 'badge-secondary';
      if (statusStr === 'ACTIVE') badgeColor = 'badge-green';
      if (statusStr === 'TRIAL') badgeColor = 'badge-yellow';
      if (statusStr === 'PAST_DUE') badgeColor = 'badge-red';
      if (statusStr === 'CANCELLED') badgeColor = 'badge-red';
      if (statusStr === 'SUSPENDED') badgeColor = 'badge-red';

      var datesStr = currentSub.currentPeriodEnd ? ('Renews on ' + new Date(currentSub.currentPeriodEnd).toLocaleDateString()) : '';

      currentSubContainer.style.display = 'block';
      currentSubContainer.innerHTML = '<div class="card" style="padding: 16px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between;">' +
        '<div>' +
          '<h3 style="margin:0 0 4px 0">' + planName + '</h3>' +
          '<p style="margin:0;font-size:14px;color:var(--text-secondary);">' + planInterval + '</p>' +
        '</div>' +
        '<div style="text-align: right;">' +
          '<span class="badge ' + badgeColor + '">' + statusStr + '</span>' +
          '<p style="margin:6px 0 0;font-size:12px;color:var(--text-secondary);">' + datesStr + '</p>' +
        '</div>' +
      '</div>';
    }

    /**
     * Determine the correct button action for a plan card.
     *
     * Auth state and subscription state are independent:
     * - AUTHENTICATED + no sub → Start Trial
     * - AUTHENTICATED + sub on this plan → Current Plan
     * - AUTHENTICATED + sub on other plan → Upgrade/Downgrade
     * - AUTH_MISSING/AUTH_EXPIRED + any → Start Trial (will prompt re-auth on action)
     */
    function getPlanAction(currentSub, plan) {
        // If user is authenticated and has a subscription on this plan
        if (currentSub && currentSub.planId === plan.id) {
            return { label: 'Current Plan', type: 'secondary', disabled: true, id: 'current' };
        }

        // If no subscription (either no auth, or authenticated with no sub)
        if (!currentSub || currentSub.status === 'CANCELLED') {
            return { label: 'Start Trial', type: 'primary', disabled: false, id: 'start_trial' };
        }

        // Has active/trial subscription, changing plan
        var currentPlanDef = availablePlans.find(function(p) { return p.id === currentSub.planId; });
        var isUpgrade = currentPlanDef && plan.basePrice > currentPlanDef.basePrice;

        return {
            label: isUpgrade ? 'Upgrade' : 'Downgrade',
            type: isUpgrade ? 'primary' : 'secondary',
            disabled: false,
            id: 'change_plan'
        };
    }

    function renderPlans() {
      plansContainer.innerHTML = '';

      availablePlans.forEach(function (plan) {
        var isCurrent = currentSub && currentSub.planId === plan.id;

        var card = document.createElement('div');
        card.className = 'card' + (isCurrent ? ' active-plan' : '');
        card.style.padding = '24px';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.height = '100%';
        if (isCurrent) {
            card.style.borderColor = 'var(--primary)';
            card.style.background = 'linear-gradient(145deg, var(--surface-raised), var(--surface))';
            card.style.boxShadow = '0 4px 20px rgba(124, 58, 237, 0.1)';
        }

        var header = document.createElement('div');
        header.style.marginBottom = '20px';
        header.innerHTML = '<h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0 0 8px 0;">' + plan.name + '</h3>' +
                           '<div style="font-size: 2rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: baseline; gap: 4px;">' + plan.currency + ' ' + plan.basePrice +
                           ' <span style="font-size: 0.875rem; font-weight: 500; color: var(--text-secondary);">/' + plan.billingInterval.toLowerCase() + '</span></div>';

        var desc = document.createElement('p');
        desc.style.fontSize = '0.875rem';
        desc.style.color = 'var(--text-secondary)';
        desc.style.lineHeight = '1.5';
        desc.style.marginBottom = '24px';
        desc.style.flexGrow = '1';
        desc.textContent = plan.description;

        var action = getPlanAction(currentSub, plan);
        var actionBtn = document.createElement('button');
        actionBtn.className = 'btn btn-' + action.type;
        actionBtn.style.width = '100%';
        actionBtn.textContent = action.label;
        actionBtn.disabled = action.disabled;

        if (!action.disabled) {
            actionBtn.onclick = function() { openActionModal(action.id, plan); };
        }

        card.appendChild(header);
        card.appendChild(desc);
        card.appendChild(actionBtn);

        plansContainer.appendChild(card);
      });

      // If we have a subscription and it's active/trial, add a cancel button at the bottom
      if (currentSub && (currentSub.status === 'ACTIVE' || currentSub.status === 'TRIAL')) {
          var dangerZone = document.createElement('div');
          dangerZone.style.gridColumn = '1 / -1';
          dangerZone.style.marginTop = '24px';
          dangerZone.style.padding = '24px';
          dangerZone.style.border = '1px solid rgba(239,68,68,0.3)';
          dangerZone.style.borderRadius = '12px';

          dangerZone.innerHTML = '<h3 style="color:var(--red);margin:0 0 8px 0;">Cancel Subscription</h3>' +
                                 '<p style="color:var(--text-secondary);margin:0 0 16px 0;font-size:14px;">Canceling your subscription will schedule it to end at the conclusion of the current billing period.</p>' +
                                 '<button class="btn btn-outline-red" id="btn-cancel-sub">Cancel Subscription</button>';

          plansContainer.appendChild(dangerZone);
          document.getElementById('btn-cancel-sub').onclick = function() { openActionModal('cancel', null); };
      }
    }

    // Global Modal Control
    window.closeModal = function(id) {
        var m = document.getElementById(id || 'action-modal');
        if (m) m.classList.remove('active');
    };

    function openActionModal(action, plan) {
        // If the user doesn't have a tenant token, show an auth-required message
        if (!hasTenantToken()) {
            var title = document.getElementById('action-modal-title');
            var msg = document.getElementById('action-modal-message');
            var confirmBtn = document.getElementById('action-modal-confirm');

            actionModal.classList.add('active');
            title.textContent = 'Authentication Required';
            msg.textContent = 'To manage your subscription, please sign out and sign back in. Your current session was created before the subscription system was available.';
            confirmBtn.style.display = 'none';
            return;
        }

        var title = document.getElementById('action-modal-title');
        var msg = document.getElementById('action-modal-message');
        var confirmBtn = document.getElementById('action-modal-confirm');

        actionModal.classList.add('active');
        confirmBtn.style.display = '';

        // Reset button
        confirmBtn.className = 'btn btn-primary';
        confirmBtn.textContent = 'Confirm';
        confirmBtn.onclick = null;

        if (action === 'start_trial') {
            title.textContent = 'Start ' + plan.name + ' Trial';
            msg.textContent = 'You will get full access to the ' + plan.name + ' plan free for 14 days. No credit card required.';
            confirmBtn.onclick = function() { processAction('start_trial', plan); };
        } else if (action === 'change_plan') {
            title.textContent = 'Change Plan to ' + plan.name;
            msg.textContent = 'Your billing will be prorated automatically on your next invoice.';
            confirmBtn.onclick = function() { processAction('change_plan', plan); };
        } else if (action === 'cancel') {
            title.textContent = 'Cancel Subscription';
            msg.textContent = 'Are you sure you want to cancel? You will maintain access until the end of your billing period, after which your account will be suspended.';
            confirmBtn.className = 'btn btn-outline-red';
            confirmBtn.textContent = 'Yes, Cancel';
            confirmBtn.onclick = function() { processAction('cancel', null); };
        }
    }

    function processAction(action, plan) {
        var confirmBtn = document.getElementById('action-modal-confirm');
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Processing...';

        var request;
        if (action === 'start_trial') {
            request = api.request('/api/v1/tenant/subscriptions', { method: 'POST', body: { planId: plan.id } });
        } else if (action === 'change_plan') {
            var currentPlanDef = availablePlans.find(function(p) { return p.id === currentSub.planId; });
            var isUpgrade = currentPlanDef && plan.basePrice > currentPlanDef.basePrice;
            var endpoint = isUpgrade ? '/api/v1/tenant/subscriptions/current/upgrades' : '/api/v1/tenant/subscriptions/current/downgrades';
            request = api.request(endpoint, { method: 'POST', body: { planId: plan.id } });
        } else if (action === 'cancel') {
            request = api.request('/api/v1/tenant/subscriptions/current/cancellations', { method: 'POST', body: {} });
        }

        if (request) {
            request.then(function() {
                closeModal();
                loadData();
            }).catch(function(err) {
                var errMsg = err.message || 'An error occurred';
                // If it's a 401, show auth-specific message
                if (errMsg.indexOf('401') !== -1 || errMsg.indexOf('Unauthorized') !== -1 || errMsg.indexOf('token') !== -1) {
                    alert('Your session has expired. Please sign out and sign back in to manage your subscription.');
                } else {
                    alert('Error: ' + errMsg);
                }
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Try Again';
            });
        }
    }

    // Init Page
    document.addEventListener('DOMContentLoaded', init);

    // Refetch on window focus to keep state fresh
    window.addEventListener('focus', function() {
        if (user && user.organizationId && hasTenantToken()) {
            loadCurrentSubscription();
        }
    });
  })();
