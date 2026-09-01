(function () {
    'use strict';

    var STORAGE_KEY = 'finstack-prototype-state';
    var ROLE_SESSION_KEY = 'finstack-role-sessions';
    var DEFAULT_ROLE_EMPLOYEE = {
        expense_submitter: 'EMP-1001',
        manager: 'MGR-2001',
        finance_officer: 'FIN-2001',
        compliance_officer: 'CMP-2001',
        configuration_manager: 'CFG-1001'
    };
    var currentScript = document.currentScript;
    var rootPath = currentScript && currentScript.src
        ? currentScript.src.replace(/js\/state\.js(?:\?.*)?$/, '')
        : '/';
    var seedUrl = rootPath + 'data/mock-data.json';
    var state = null;

    function deepClone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function readStoredState() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return null;
        }
    }

    function writeStoredState(nextState) {
        state = nextState;
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function makeId(prefix) {
        return prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    }

    function hashString(value) {
        var hash = 0;
        var str = String(value || '');
        for (var i = 0; i < str.length; i += 1) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash).toString(36);
    }

    function titleCase(value) {
        return String(value || '')
            .split(/[_\s-]+/)
            .filter(Boolean)
            .map(function (part) {
                return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
            })
            .join(' ');
    }

    function getWorkspaceRoleFromPath() {
        var path = window.location.pathname.toLowerCase();
        if (path.indexOf('/expense_submitter/') !== -1) return 'expense_submitter';
        if (path.indexOf('/views/submitter/') !== -1) return 'expense_submitter';
        if (path.indexOf('/manager/') !== -1) return 'manager';
        if (path.indexOf('/views/manager/') !== -1) return 'manager';
        if (path.indexOf('/finance_officer/') !== -1) return 'finance_officer';
        if (path.indexOf('/views/finance/') !== -1) return 'finance_officer';
        if (path.indexOf('/compliance_officer/') !== -1) return 'compliance_officer';
        if (path.indexOf('/views/compliance/') !== -1) return 'compliance_officer';
        if (path.indexOf('/configuration_manager/') !== -1) return 'configuration_manager';
        if (path.indexOf('/views/config-manager/') !== -1) return 'configuration_manager';
        return null;
    }

    function inferRoleFromPath() {
        var workspaceRole = getWorkspaceRoleFromPath();
        if (workspaceRole) return workspaceRole;
        return 'expense_submitter';
    }

    function getSession() {
        try {
            var raw = sessionStorage.getItem('finstackUserSession') || localStorage.getItem('currentUser');
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            return null;
        }
    }

    function syncCurrentUserSession(user) {
        if (!user) return;
        var session = getSession();
        if (!session || session.employeeId !== user.employeeId) return;
        var nextSession = {
            id: user.id || session.id || '',
            employeeId: user.employeeId,
            fullName: user.fullName,
            email: user.email,
            role: session.role || (user.roles && user.roles[0]) || '',
            roles: Array.isArray(user.roles) ? user.roles : (user.roles ? [user.roles] : []),
            organizationId: user.organizationId,
            loginAt: session.loginAt || nowIso()
        };
        sessionStorage.setItem('finstackUserSession', JSON.stringify(nextSession));
        localStorage.setItem('currentUser', JSON.stringify(nextSession));
    }

    function getRoleSessions() {
        try {
            var raw = sessionStorage.getItem(ROLE_SESSION_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (error) {
            return {};
        }
    }

    function rememberRoleUser(role, employeeId, organizationId) {
        if (!role || !employeeId) return;
        var roleSessions = getRoleSessions();
        roleSessions[role] = {
            employeeId: employeeId,
            organizationId: organizationId || ''
        };
        sessionStorage.setItem(ROLE_SESSION_KEY, JSON.stringify(roleSessions));
    }

    function getRememberedRoleUser(role) {
        var roleSessions = getRoleSessions();
        var remembered = roleSessions[role];
        if (!remembered || !remembered.employeeId) return null;
        return getUserByEmployeeId(remembered.employeeId);
    }

    function ensureSessionUser() {
        var session = getSession();
        var workspaceRole = getWorkspaceRoleFromPath();
        if (workspaceRole) {
            if (session && session.role === workspaceRole) {
                rememberRoleUser(workspaceRole, session.employeeId, session.organizationId);
                var sessionUser = getUserByEmployeeId(session.employeeId) || getUserByRole(workspaceRole) || getUserByEmployeeId(DEFAULT_ROLE_EMPLOYEE[workspaceRole]);
                return sessionUser ? Object.assign({}, sessionUser) : session;
            }
            return getRememberedRoleUser(workspaceRole) || getUserByEmployeeId(DEFAULT_ROLE_EMPLOYEE[workspaceRole]);
        }

        if (!session || !session.role) {
            return getUserByEmployeeId(DEFAULT_ROLE_EMPLOYEE[inferRoleFromPath()]);
        }

        var role = session.role;
        var user = getUserByEmployeeId(session.employeeId);
        if (!user) {
            user = getUserByRole(role);
        }
        return user ? Object.assign({}, user) : session;
    }

    function normalizeState(nextState) {
        nextState.roles = Array.isArray(nextState.roles) ? nextState.roles : [];
        nextState.categories = Array.isArray(nextState.categories) ? nextState.categories : [];
        nextState.policies = Array.isArray(nextState.policies) ? nextState.policies : [];
        nextState.users = Array.isArray(nextState.users) ? nextState.users : [];
        nextState.expenses = Array.isArray(nextState.expenses) ? nextState.expenses : [];
        nextState.notifications = Array.isArray(nextState.notifications) ? nextState.notifications : [];
        nextState.auditLogs = Array.isArray(nextState.auditLogs) ? nextState.auditLogs : [];
        nextState.transactions = Array.isArray(nextState.transactions) ? nextState.transactions : [];
        nextState.organizations = Array.isArray(nextState.organizations) ? nextState.organizations : [];
        nextState.accountRequests = Array.isArray(nextState.accountRequests) ? nextState.accountRequests : [];
        nextState.subscriptions = Array.isArray(nextState.subscriptions) ? nextState.subscriptions : [];
        nextState.plans = Array.isArray(nextState.plans) ? nextState.plans : [];
        var defaultOrgId = nextState.organizations.length === 1
            ? nextState.organizations[0].organizationId
            : ((nextState.organization && nextState.organization.organizationId) || '');
        var userOrgByEmployeeId = {};
        nextState.users.forEach(function (user) {
            if (user.employeeId && user.organizationId) {
                userOrgByEmployeeId[user.employeeId] = user.organizationId;
            }
        });
        nextState.categories.forEach(function (category) {
            if (!category.organizationId) category.organizationId = defaultOrgId;
        });
        nextState.policies.forEach(function (policy) {
            if (!policy.organizationId) policy.organizationId = defaultOrgId;
        });
        nextState.expenses.forEach(function (expense) {
            if (!expense.organizationId) {
                expense.organizationId = userOrgByEmployeeId[expense.employeeId] || defaultOrgId;
            }
            if (expense.assignedFinanceOfficerId === undefined) expense.assignedFinanceOfficerId = null;
            var category = nextState.categories.find(function (item) { return item.id === expense.categoryId; });
            var employee = nextState.users.find(function (item) { return item.employeeId === expense.employeeId; });
            expense.category = expense.category || (category ? category.name : expense.categoryId);
            expense.employee = expense.employee || (employee ? employee.fullName : expense.employeeId);
            expense.created = expense.created || expense.createdAt;
            dedupeExpenseHistory(expense);
        });
        return nextState;
    }

    function mergeBackendState(baseState, backendState) {
        var nextState = deepClone(baseState || {});
        backendState = backendState || {};
        nextState.users = backendState.users || [];
        nextState.categories = backendState.categories || [];
        nextState.expenses = backendState.expenses || [];
        nextState.policies = backendState.policies || [];
        nextState.notifications = backendState.notifications || [];
        nextState.auditLogs = backendState.auditLogs || [];
        nextState.transactions = backendState.transactions || [];
        nextState.subscriptions = backendState.subscriptions || [];
        nextState.plans = backendState.plans || [];
        nextState.reports = backendState.reports || {};
        nextState.dashboard = backendState.dashboard || {};
        return normalizeState(nextState);
    }

    function refreshFromBackendSync() {
        if (!window.FinStackApi || !window.FinStackApi.syncGetAll) return state;
        writeStoredState(mergeBackendState(state, window.FinStackApi.syncGetAll()));
        return state;
    }

    function getUserByEmployeeId(employeeId) {
        if (!state || !employeeId) return null;
        return state.users.find(function (user) {
            return user.employeeId === employeeId;
        }) || null;
    }

    function getUserByRole(roleId) {
        if (!state || !roleId) return null;
        return state.users.find(function (user) {
            return Array.isArray(user.roles) && user.roles.indexOf(roleId) !== -1;
        }) || null;
    }

    function getFinanceOfficerById(id, organizationId) {
        if (!state || !id) return null;
        return state.users.find(function (user) {
            return user.id === id &&
                (!organizationId || user.organizationId === organizationId) &&
                user.status !== 'Inactive' &&
                Array.isArray(user.roles) &&
                user.roles.indexOf('finance_officer') !== -1;
        }) || null;
    }

    function getDefaultFinanceOfficer(organizationId) {
        if (!state) return null;
        return state.users.find(function (user) {
            return (!organizationId || user.organizationId === organizationId) &&
                user.status !== 'Inactive' &&
                Array.isArray(user.roles) &&
                user.roles.indexOf('finance_officer') !== -1;
        }) || null;
    }

    function getCurrentUser() {
        return ensureSessionUser();
    }

    function getCurrentRole() {
        var workspaceRole = getWorkspaceRoleFromPath();
        if (workspaceRole) return workspaceRole;
        var session = getSession();
        if (session && session.role) return session.role;
        var user = getCurrentUser();
        return user && user.roles && user.roles[0] ? user.roles[0] : inferRoleFromPath();
    }

    function formatTimeAgo(isoString) {
        var diffMs = Date.now() - new Date(isoString).getTime();
        var diffMinutes = Math.floor(diffMs / 60000);
        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return diffMinutes + ' min ago';
        var diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return diffHours + ' hour' + (diffHours === 1 ? '' : 's') + ' ago';
        var diffDays = Math.floor(diffHours / 24);
        if (diffDays === 1) return 'Yesterday';
        return diffDays + ' days ago';
    }

    function addAuditLog(user, action, entityType, entityName, status) {
        var entry = {
            id: makeId('AUD'),
            timestamp: nowIso(),
            userEmployeeId: user ? (user.employeeId || '') : '',
            user: user ? user.fullName : 'System',
            organizationId: user ? (user.organizationId || '') : '',
            userRoleId: user && user.roles && user.roles[0] ? user.roles[0] : '',
            userRole: user && user.roles && user.roles[0] ? titleCase(user.roles[0]) : 'System',
            action: action,
            entityType: entityType,
            entityName: entityName,
            status: status || 'Success'
        };
        state.auditLogs.unshift(entry);
    }

    function getNotificationDedupeKey(payload) {
        var action = payload.actionType || payload.title || 'notification';
        var subject = payload.relatedExpenseId || payload.relatedEntityId || payload.message || '';
        return [
            action,
            subject,
            payload.recipientRole || '',
            payload.recipientEmployeeId || ''
        ].join('|');
    }

    function addNotification(payload) {
        payload = payload || {};
        var dedupeKey = payload.dedupeKey || getNotificationDedupeKey(payload);
        var existing = state.notifications.find(function (item) {
            if (item.dedupeKey && item.dedupeKey === dedupeKey) return true;
            return item.relatedExpenseId === (payload.relatedExpenseId || '') &&
                item.recipientRole === (payload.recipientRole || '') &&
                item.recipientEmployeeId === (payload.recipientEmployeeId || '') &&
                (item.actionType === payload.actionType || (!item.actionType && item.title === payload.title));
        });
        if (existing) return existing;

        var notification = {
            id: payload.id || ('NTF-' + hashString(dedupeKey)),
            unread: true,
            createdAt: nowIso(),
            type: payload.type || 'info',
            recipientEmployeeId: payload.recipientEmployeeId || '',
            recipientRole: payload.recipientRole || '',
            title: payload.title,
            message: payload.message,
            relatedExpenseId: payload.relatedExpenseId || '',
            actionType: payload.actionType || '',
            dedupeKey: dedupeKey
        };
        state.notifications.unshift(notification);
        return notification;
    }

    function broadStatusForWorkflow(workflowStatus) {
        if (workflowStatus === 'rejected') return 'rejected';
        if (workflowStatus === 'paid' || workflowStatus === 'approved_for_payment' || workflowStatus === 'payment_processing') return 'approved';
        return 'pending';
    }

    function createHistoryEntry(code, label, note) {
        return {
            code: code,
            label: label,
            at: nowIso(),
            note: note || ''
        };
    }

    function getHistoryStageKey(expenseId, entry) {
        var code = String(entry && entry.code || '').toLowerCase();
        var label = String(entry && entry.label || '').toLowerCase();
        if (code === 'paid' || label === 'paid' || label.indexOf('reimbursement released') !== -1) {
            return expenseId + '|paid';
        }
        return expenseId + '|' + (code || label);
    }

    function dedupeExpenseHistory(expense) {
        if (!expense || !Array.isArray(expense.history)) return [];
        var seen = {};
        var result = [];
        expense.history.forEach(function (entry) {
            var key = getHistoryStageKey(expense.id || '', entry);
            if (seen[key]) return;
            seen[key] = true;
            result.push(entry);
        });
        expense.history = result;
        return result;
    }

    function pushHistoryEntryOnce(expense, code, label, note) {
        if (!expense) return null;
        expense.history = Array.isArray(expense.history) ? expense.history : [];
        dedupeExpenseHistory(expense);
        var entry = createHistoryEntry(code, label, note);
        var key = getHistoryStageKey(expense.id || '', entry);
        var exists = expense.history.some(function (item) {
            return getHistoryStageKey(expense.id || '', item) === key;
        });
        if (exists) return null;
        expense.history.push(entry);
        return entry;
    }

    function updateExpenseInternal(id, updater) {
        var expense = state.expenses.find(function (item) {
            return item.id === id;
        });
        if (!expense) return null;
        updater(expense);
        expense.updatedAt = nowIso();
        return expense;
    }

    function getPolicyForCategory(categoryId) {
        return state.policies.find(function (policy) {
            return policy.categoryId === categoryId && policy.status === 'Active';
        }) || null;
    }

    function getNotificationsForUser(user) {
        var targetUser = user || getCurrentUser();
        var currentRole = getCurrentRole();
        return state.notifications
            .filter(function (notification) {
                if (notification.recipientEmployeeId) {
                    return !!targetUser && notification.recipientEmployeeId === targetUser.employeeId;
                }
                return !!notification.recipientRole && notification.recipientRole === currentRole;
            })
            .map(function (notification) {
                var copy = deepClone(notification);
                copy.time = formatTimeAgo(copy.createdAt);
                return copy;
            });
    }

    function getStatusTimeline(expense) {
        dedupeExpenseHistory(expense);
        var history = Array.isArray(expense.history) ? expense.history.slice() : [];
        history.sort(function (left, right) {
            return new Date(left.at).getTime() - new Date(right.at).getTime();
        });
        var seen = {};
        return history.filter(function (entry) {
            var key = getHistoryStageKey(expense.id || '', entry);
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });
    }

    function getManagerQueue(managerEmployeeId) {
        return state.expenses.filter(function (expense) {
            return expense.managerEmployeeId === managerEmployeeId && expense.workflowStatus === 'manager_review';
        });
    }

    function getManagerHistory(managerEmployeeId) {
        return state.expenses.filter(function (expense) {
            return expense.managerEmployeeId === managerEmployeeId && expense.managerDecision;
        });
    }

    function getFinanceReviewQueue() {
        var user = getCurrentUser();
        var expenses = state.expenses || [];
        console.log("Current User:", user);
        console.log("Expenses:", expenses);
        return state.expenses.filter(function (expense) {
            return user &&
                expense.workflowStatus === 'finance_review' &&
                expense.assignedFinanceOfficerId === user.id;
        });
    }

    function getFinanceFlaggedQueue() {
        return state.expenses.filter(function (expense) {
            return expense.workflowStatus === 'compliance_review' && expense.financeDecision === 'Flagged';
        });
    }

    function buildPaymentBatches() {
        var approved = state.expenses.filter(function (expense) {
            return expense.workflowStatus === 'approved_for_payment' || expense.workflowStatus === 'payment_processing';
        });
        var batches = [];
        if (approved.length) {
            batches.push({
                id: 'PB-001',
                expenseIds: approved.map(function (expense) { return expense.id; }),
                count: approved.length,
                total: approved.reduce(function (sum, expense) { return sum + Number(expense.amount || 0); }, 0),
                status: approved.some(function (expense) { return expense.workflowStatus === 'payment_processing'; }) ? 'approved' : 'pending',
                scheduled: new Date().toISOString().slice(0, 10)
            });
        }
        return batches;
    }

    function buildComplianceViolations() {
        return state.expenses
            .filter(function (expense) {
                return expense.workflowStatus === 'compliance_review';
            })
            .map(function (expense, index) {
                var policy = getPolicyForCategory(expense.categoryId);
                return {
                    id: 'VIO-' + (index + 101),
                    policyId: policy ? policy.id : 0,
                    policyCode: policy ? 'POL-' + String(policy.id).padStart(3, '0') : 'POL-000',
                    policy: policy ? policy.name : expense.category + ' Review',
                    amount: expense.amount,
                    severity: expense.risk_score >= 70 ? 'High' : expense.risk_score >= 40 ? 'Medium' : 'Low',
                    detectedTime: formatTimeAgo(expense.updatedAt || expense.created),
                    status: expense.complianceDecision === 'Corrective Action' ? 'Corrective Action Initiated' : 'Open',
                    description: expense.financeDecisionNote || expense.notes || 'Flagged by finance for compliance investigation.',
                    expenseId: expense.id,
                    employee: expense.employee,
                    merchant: expense.merchant,
                    riskScore: expense.risk_score
                };
            });
    }

    function seedOrLoad(seedState) {
        var storedState = readStoredState();
        if (!storedState || storedState.version !== seedState.version) {
            writeStoredState(normalizeState(seedState));
            return;
        }
        writeStoredState(normalizeState(storedState));
    }

    var isSubscriptionPage = window.location.pathname.indexOf('/subscription.html') !== -1;
    var ready = isSubscriptionPage
        ? Promise.resolve({ version: 0, organizations: [], accountRequests: [], users: [], roles: [], categories: [], policies: [], expenses: [], notifications: [], auditLogs: [] })
        : fetch(seedUrl).then(function (response) {
            if (!response.ok) throw new Error('Unable to load shared mock data. Status: ' + response.status);
            return response.json();
        });

    ready = ready.then(function (seedState) {
            writeStoredState(normalizeState(deepClone(seedState)));
            if (window.FinStackApi && window.FinStackApi.getAll) {
                return window.FinStackApi.getAll().then(function (backendState) {
                    writeStoredState(mergeBackendState(state, backendState));
                    return state;
                });
            }
            return state;
        })
        .catch(function (err) {
            console.error('[FinStackStore] Failed to load backend state:', err.message);
            if (window.FinStackApi && window.FinStackApi.getAll) {
                var baseState = {
                    version: 0,
                    organization: { organizationId: 'finstack-tech-01', name: 'FinStack Technologies' },
                    organizations: [{ organizationId: 'finstack-tech-01', name: 'FinStack Technologies', enabledRoles: ['expense_submitter', 'manager', 'finance_officer', 'compliance_officer', 'configuration_manager'] }],
                    accountRequests: [],
                    roles: [
                        { id: 'expense_submitter', name: 'Expense Submitter' },
                        { id: 'manager', name: 'Manager' },
                        { id: 'finance_officer', name: 'Finance Officer' },
                        { id: 'compliance_officer', name: 'Compliance Officer' },
                        { id: 'configuration_manager', name: 'Configuration Manager' }
                    ]
                };
                return window.FinStackApi.getAll().then(function (backendState) {
                    writeStoredState(mergeBackendState(baseState, backendState));
                    return state;
                });
            }
            var stored = readStoredState();
            if (stored) {
                console.warn('[FinStackStore] Using cached localStorage state as fallback.');
                state = normalizeState(stored);
                return state;
            }
            /* No stored state either — initialize empty */
            console.warn('[FinStackStore] No stored state found. Initializing empty state.');
            state = normalizeState({ version: 0, organizations: [], accountRequests: [], users: [], roles: [], categories: [], policies: [], expenses: [], notifications: [], auditLogs: [] });
            return state;
        });

    /* ========== Organization & Auth APIs ========== */

    function getOrganizationById(orgId) {
        if (!state || !orgId) return null;
        return state.organizations.find(function (o) { return o.organizationId === orgId; }) || null;
    }

    function authenticateUser(orgId, employeeId, password, role) {
        if (!state) return { success: false, error: 'System not ready.' };
        if (!orgId || !orgId.trim()) return { success: false, error: 'Organization ID is required.' };
        if (!employeeId || !employeeId.trim()) return { success: false, error: 'Employee ID is required.' };
        if (!password) return { success: false, error: 'Password is required.' };

        var org = getOrganizationById(orgId.trim());
        if (!org) return { success: false, error: 'Organization not found. Check your Organization ID.' };

        var user = state.users.find(function (u) {
            return u.employeeId === employeeId.trim() && u.organizationId === orgId.trim();
        });
        if (!user) return { success: false, error: 'Employee ID not found in this organization.' };
        if (user.password !== password) return { success: false, error: 'Incorrect password.' };

        var accountStatus = user.accountStatus || 'approved';
        if (accountStatus === 'pending') return { success: false, error: 'Your account is pending approval by the Configuration Manager.' };
        if (accountStatus === 'rejected') return { success: false, error: 'Your account request was rejected. Contact your administrator.' };
        if (user.status === 'Inactive') return { success: false, error: 'Your account has been deactivated. Contact your administrator.' };

        if (role) {
            if (!(user.roles || []).includes(role)) {
                return { success: false, error: employeeId + ' is not assigned to the ' + titleCase(role) + ' role.' };
            }
            if (org.enabledRoles && org.enabledRoles.indexOf(role) === -1) {
                return { success: false, error: 'The ' + titleCase(role) + ' role is not enabled for this organization.' };
            }
        }

        return { success: true, user: deepClone(user) };
    }

    window.FinStackStore = {
        ready: ready,
        titleCase: titleCase,
        getState: function () {
            return deepClone(state);
        },
        saveState: function (nextState) {
            writeStoredState(normalizeState(deepClone(nextState)));
            return this.getState();
        },
        reset: function () {
            return ready.then(function () {
                return fetch(seedUrl)
                    .then(function (response) { return response.json(); })
                    .then(function (seedState) {
                        writeStoredState(normalizeState(seedState));
                        return deepClone(state);
                    });
            });
        },
        getSession: getSession,
        rememberRoleUser: rememberRoleUser,
        getCurrentUser: getCurrentUser,
        getCurrentRole: getCurrentRole,
        getRoleName: function (roleId) {
            var role = state.roles.find(function (item) { return item.id === roleId; });
            return role ? role.name : titleCase(roleId);
        },

        /* ===== Organization APIs ===== */
        getOrganization: function () {
            return deepClone(state.organization);
        },
        updateOrganization: function (updates) {
            Object.keys(updates || {}).forEach(function (key) {
                state.organization[key] = updates[key];
            });
            addAuditLog(getCurrentUser(), 'Updated Organization Settings', 'Organization', state.organization.organizationId, 'Success');
            writeStoredState(state);
            return deepClone(state.organization);
        },
        getOrganizations: function () {
            return deepClone(state.organizations);
        },
        getOrganizationById: function (orgId) {
            var org = getOrganizationById(orgId);
            return org ? deepClone(org) : null;
        },
        createOrganization: function (payload) {
            var orgId = payload.organizationId || makeId('ORG');
            // Check uniqueness
            if (getOrganizationById(orgId)) {
                return { success: false, error: 'Organization ID already exists.' };
            }
            var org = {
                organizationId: orgId,
                name: payload.name,
                email: payload.email,
                size: payload.size || '1-10 employees',
                enabledRoles: payload.enabledRoles || ['expense_submitter', 'manager', 'finance_officer', 'compliance_officer', 'configuration_manager'],
                createdAt: nowIso()
            };
            state.organizations.push(org);

            // Create super user
            var superUser = {
                employeeId: payload.adminEmployeeId || 'CFG-' + Math.floor(1000 + Math.random() * 9000),
                fullName: payload.adminName,
                email: payload.adminEmail,
                department: 'Administration',
                phone: '',
                location: '',
                roles: ['configuration_manager'],
                managerEmployeeId: '',
                status: 'Active',
                accountStatus: 'approved',
                organizationId: orgId,
                password: payload.adminPassword,
                firstLoginRequired: false
            };
            state.users.push(superUser);

            addAuditLog(superUser, 'Created Organization', 'Organization', orgId, 'Success');
            addAuditLog(superUser, 'Created Super User Account', 'User', superUser.employeeId, 'Success');
            writeStoredState(state);
            return { success: true, organization: deepClone(org), superUser: deepClone(superUser) };
        },
        toggleOrgRole: function (orgId, roleId) {
            var org = state.organizations.find(function (o) { return o.organizationId === orgId; });
            if (!org) return null;
            var role = state.roles.find(function (r) { return r.id === roleId; });
            if (!role || role.required) return null;
            var idx = org.enabledRoles.indexOf(roleId);
            if (idx !== -1) {
                org.enabledRoles.splice(idx, 1);
            } else {
                org.enabledRoles.push(roleId);
            }
            addAuditLog(getCurrentUser(), 'Toggled Organization Role', 'Role', role.name, 'Success');
            writeStoredState(state);
            return deepClone(org);
        },

        /* ===== Auth APIs ===== */
        authenticateUser: function (orgId, employeeId, password, role) {
            return authenticateUser(orgId, employeeId, password, role);
        },

        /* ===== Account Request APIs ===== */
        getAccountRequests: function (orgId) {
            var requests = deepClone(state.accountRequests);
            if (orgId) {
                requests = requests.filter(function (r) { return r.organizationId === orgId; });
            }
            return requests;
        },
        submitAccountRequest: function (payload) {
            if (!payload.organizationId) return { success: false, error: 'Organization ID is required.' };
            var org = getOrganizationById(payload.organizationId);
            if (!org) return { success: false, error: 'Organization not found.' };
            // Check duplicate employee ID in same org
            var existingUser = state.users.find(function (u) {
                return u.employeeId === payload.employeeId && u.organizationId === payload.organizationId;
            });
            if (existingUser) return { success: false, error: 'Employee ID already exists in this organization.' };
            var existingRequest = state.accountRequests.find(function (r) {
                return r.employeeId === payload.employeeId && r.organizationId === payload.organizationId && r.status === 'pending';
            });
            if (existingRequest) return { success: false, error: 'A pending request already exists for this Employee ID.' };

            // Check role is enabled
            if (payload.requestedRole && org.enabledRoles.indexOf(payload.requestedRole) === -1) {
                return { success: false, error: 'The requested role is not enabled for this organization.' };
            }
            if (payload.requestedRole === 'configuration_manager') {
                return { success: false, error: 'Cannot request the Configuration Manager role.' };
            }

            var request = {
                id: makeId('REQ'),
                organizationId: payload.organizationId,
                employeeId: payload.employeeId,
                fullName: payload.fullName,
                email: payload.email,
                requestedRole: payload.requestedRole || 'expense_submitter',
                password: payload.password,
                status: 'pending',
                createdAt: nowIso()
            };
            state.accountRequests.push(request);

            // Notify config managers
            addNotification({
                recipientRole: 'configuration_manager',
                title: 'New Account Request',
                message: payload.fullName + ' (' + payload.employeeId + ') has requested access as ' + titleCase(payload.requestedRole) + '.',
                type: 'warning',
                actionType: 'account_request_submitted',
                relatedEntityId: request.id
            });

            addAuditLog({ fullName: payload.fullName, roles: [payload.requestedRole] }, 'Submitted Account Request', 'Account Request', request.id, 'Success');
            writeStoredState(state);
            return { success: true, request: deepClone(request) };
        },
        approveAccountRequest: function (requestId) {
            var request = state.accountRequests.find(function (r) { return r.id === requestId; });
            if (!request) return { success: false, error: 'Request not found.' };
            if (request.status !== 'pending') return { success: false, error: 'Request is not pending.' };

            request.status = 'approved';
            request.decidedAt = nowIso();

            // Create user account
            var newUser = {
                employeeId: request.employeeId,
                fullName: request.fullName,
                email: request.email,
                department: 'General',
                phone: '',
                location: '',
                roles: [request.requestedRole],
                managerEmployeeId: '',
                status: 'Active',
                accountStatus: 'approved',
                organizationId: request.organizationId,
                password: request.password,
                firstLoginRequired: true
            };
            state.users.push(newUser);

            addNotification({
                recipientEmployeeId: request.employeeId,
                title: 'Account Approved',
                message: 'Your account request has been approved. You can now login.',
                type: 'success',
                actionType: 'account_request_approved',
                relatedEntityId: request.id
            });

            addAuditLog(getCurrentUser(), 'Approved Account Request', 'Account Request', request.id, 'Success');
            writeStoredState(state);
            return { success: true, user: deepClone(newUser) };
        },
        rejectAccountRequest: function (requestId) {
            var request = state.accountRequests.find(function (r) { return r.id === requestId; });
            if (!request) return { success: false, error: 'Request not found.' };
            if (request.status !== 'pending') return { success: false, error: 'Request is not pending.' };

            request.status = 'rejected';
            request.decidedAt = nowIso();

            addNotification({
                recipientEmployeeId: request.employeeId,
                title: 'Account Request Rejected',
                message: 'Your account request was rejected. Contact the administrator.',
                type: 'danger',
                actionType: 'account_request_rejected',
                relatedEntityId: request.id
            });

            addAuditLog(getCurrentUser(), 'Rejected Account Request', 'Account Request', request.id, 'Success');
            writeStoredState(state);
            return { success: true };
        },

        /* ===== Role APIs ===== */
        getRoles: function () {
            return deepClone(state.roles);
        },
        toggleRole: function (roleId) {
            var role = state.roles.find(function (item) { return item.id === roleId; });
            if (!role || role.required) return null;
            role.enabled = !role.enabled;
            addAuditLog(getCurrentUser(), 'Updated Role Access', 'Role', role.name, 'Success');
            writeStoredState(state);
            return deepClone(role);
        },

        /* ===== User APIs ===== */
        getUsers: function () {
            return deepClone(state.users);
        },
        getUsersByOrg: function (orgId) {
            return deepClone(state.users.filter(function (u) { return u.organizationId === orgId; }));
        },
        addUser: function (payload) {
            // Check duplicate
            var existing = state.users.find(function (u) {
                return u.employeeId === payload.employeeId && u.organizationId === (payload.organizationId || '');
            });
            if (existing) return { success: false, error: 'Employee ID already exists in this organization.' };
            var duplicateEmail = state.users.find(function (u) {
                return String(u.email || '').toLowerCase() === String(payload.email || '').toLowerCase() && u.organizationId === (payload.organizationId || '');
            });
            if (duplicateEmail) return { success: false, error: 'Email address already exists in this organization.' };

            var user = {
                employeeId: payload.employeeId,
                fullName: payload.fullName,
                email: payload.email,
                department: payload.department || 'General',
                phone: payload.phone || '',
                location: payload.location || 'India',
                roles: payload.roles && payload.roles.length ? payload.roles : ['expense_submitter'],
                managerEmployeeId: payload.managerEmployeeId || '',
                status: payload.status || 'Active',
                accountStatus: payload.accountStatus || 'approved',
                organizationId: payload.organizationId || '',
                password: payload.password || 'FinStack@123',
                firstLoginRequired: payload.firstLoginRequired !== false
            };
            state.users.push(user);
            addAuditLog(getCurrentUser(), 'Created User', 'User', user.employeeId, 'Success');
            writeStoredState(state);
            return { success: true, user: deepClone(user) };
        },
        updateUser: function (employeeId, updates) {
            var user = getUserByEmployeeId(employeeId);
            if (!user) return null;
            if (updates && updates.email) {
                var duplicateEmail = state.users.find(function (candidate) {
                    return candidate.employeeId !== employeeId &&
                        candidate.organizationId === user.organizationId &&
                        String(candidate.email || '').toLowerCase() === String(updates.email || '').toLowerCase();
                });
                if (duplicateEmail) return { success: false, error: 'Email address already exists in this organization.' };
            }
            Object.keys(updates || {}).forEach(function (key) {
                user[key] = updates[key];
            });
            addAuditLog(getCurrentUser(), 'Updated User', 'User', employeeId, 'Success');
            writeStoredState(state);
            syncCurrentUserSession(user);
            return deepClone(user);
        },
        changePassword: function (employeeId, currentPassword, newPassword) {
            var user = getUserByEmployeeId(employeeId);
            if (!user) return { success: false, error: 'User not found.' };
            if (user.password !== currentPassword) return { success: false, error: 'Incorrect current password.' };
            if (!newPassword || newPassword.length < 6) return { success: false, error: 'New password must be at least 6 characters.' };
            user.password = newPassword;
            addAuditLog(getCurrentUser(), 'Changed Password', 'User', employeeId, 'Success');
            writeStoredState(state);
            return { success: true };
        },
        deleteUser: function (employeeId) {
            var index = state.users.findIndex(function (u) { return u.employeeId === employeeId; });
            if (index === -1) return false;
            var removed = state.users.splice(index, 1)[0];
            addAuditLog(getCurrentUser(), 'Deleted User', 'User', removed.employeeId, 'Success');
            writeStoredState(state);
            return true;
        },
        changeUserRole: function (employeeId, newRoles) {
            var user = getUserByEmployeeId(employeeId);
            if (!user) return null;
            user.roles = Array.isArray(newRoles) ? newRoles : [newRoles];
            addAuditLog(getCurrentUser(), 'Changed User Role', 'User', employeeId, 'Success');
            writeStoredState(state);
            return deepClone(user);
        },

        /* ===== Category APIs ===== */
        getCategories: function () {
            return deepClone(state.categories);
        },
        addCategory: function (payload) {
            var currentUser = getCurrentUser();
            var category = {
                id: payload.id || payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                name: payload.name,
                description: payload.description || '',
                limit: Number(payload.limit || 0),
                currency: payload.currency || 'INR',
                status: payload.status || 'Active',
                organizationId: payload.organizationId || (currentUser ? currentUser.organizationId : ''),
                requiresReceipt: payload.requiresReceipt !== false,
                color: payload.color || '#7C3AED'
            };
            state.categories.push(category);
            addAuditLog(currentUser, 'Created Category', 'Category', category.name, 'Success');
            writeStoredState(state);
            return deepClone(category);
        },

        /* ===== Policy APIs ===== */
        getPolicies: function () {
            return deepClone(state.policies);
        },
        addPolicy: function (payload) {
            var currentUser = getCurrentUser();
            var policy = {
                id: state.policies.length ? Math.max.apply(null, state.policies.map(function (item) { return item.id; })) + 1 : 1,
                name: payload.name,
                categoryId: payload.categoryId,
                category: payload.category,
                maxAmount: Number(payload.maxAmount || 0),
                currency: payload.currency || 'INR',
                approval: payload.approval || 'Manager',
                status: payload.status || 'Active',
                description: payload.description || '',
                requiresApproval: payload.requiresApproval !== false,
                receiptRequired: payload.receiptRequired !== false,
                ownerRole: 'configuration_manager',
                organizationId: payload.organizationId || (currentUser ? currentUser.organizationId : ''),
                createdAt: nowIso()
            };
            state.policies.push(policy);
            addAuditLog(currentUser, 'Created Policy', 'Policy', policy.name, 'Success');
            writeStoredState(state);
            return deepClone(policy);
        },
        updatePolicy: function (id, updates) {
            var policy = state.policies.find(function (item) { return item.id === id; });
            if (!policy) return null;
            Object.keys(updates || {}).forEach(function (key) {
                policy[key] = updates[key];
            });
            policy.updatedAt = nowIso();
            addAuditLog(getCurrentUser(), 'Updated Policy', 'Policy', policy.name, 'Success');
            writeStoredState(state);
            return deepClone(policy);
        },
        deletePolicy: function (id) {
            var index = state.policies.findIndex(function (item) { return item.id === id; });
            if (index === -1) return false;
            var removed = state.policies.splice(index, 1)[0];
            addAuditLog(getCurrentUser(), 'Deleted Policy', 'Policy', removed.name, 'Success');
            writeStoredState(state);
            return true;
        },
        updateCategory: function (id, updates) {
            var category = state.categories.find(function (item) { return item.id === id; });
            if (!category) return null;
            Object.keys(updates || {}).forEach(function (key) {
                category[key] = updates[key];
            });
            addAuditLog(getCurrentUser(), 'Updated Category', 'Category', category.name, 'Success');
            writeStoredState(state);
            return deepClone(category);
        },
        deleteCategory: function (id) {
            var index = state.categories.findIndex(function (item) { return item.id === id; });
            if (index === -1) return false;
            var removed = state.categories.splice(index, 1)[0];
            addAuditLog(getCurrentUser(), 'Deleted Category', 'Category', removed.name, 'Success');
            writeStoredState(state);
            return true;
        },

        /* ===== Expense APIs ===== */
        getExpenses: function () {
            return deepClone(state.expenses).sort(function (left, right) {
                return new Date(right.updatedAt || right.created).getTime() - new Date(left.updatedAt || left.created).getTime();
            });
        },
        getExpenseById: function (id) {
            var expense = state.expenses.find(function (item) { return item.id === id; });
            return expense ? deepClone(expense) : null;
        },
        getExpensesForCurrentUser: function () {
            var user = getCurrentUser();
            return this.getExpenses().filter(function (expense) {
                return user && expense.employeeId === user.employeeId;
            });
        },
        submitExpense: function (payload) {
            var user = getCurrentUser();
            var category = state.categories.find(function (item) {
                return item.id === payload.categoryId || item.name === payload.category;
            });
            var expense = {
                id: 'EXP-' + Math.floor(1000 + Math.random() * 9000),
                employeeId: user ? user.employeeId : DEFAULT_ROLE_EMPLOYEE.expense_submitter,
                employee: user ? user.fullName : 'Expense Submitter',
                organizationId: user ? user.organizationId : '',
                managerEmployeeId: user ? user.managerEmployeeId : 'MGR-2001',
                assignedFinanceOfficerId: null,
                amount: Number(payload.amount),
                category: category ? category.name : payload.category,
                categoryId: category ? category.id : payload.categoryId,
                merchant: payload.merchant,
                date: payload.date,
                status: 'pending',
                workflowStatus: 'manager_review',
                notes: payload.notes || '',
                paymentMethod: payload.paymentMethod || 'personal-card',
                receiptFileName: payload.receiptFileName || '',
                extraction_confidence: payload.extraction_confidence,
                flag: payload.flag,
                risk_score: payload.risk_score,
                managerDecision: '',
                financeDecision: '',
                complianceDecision: '',
                created: nowIso(),
                updatedAt: nowIso(),
                history: [
                    createHistoryEntry('submitted', 'Submitted', 'Expense submitted by ' + (user ? user.fullName : 'Expense Submitter') + '.')
                ]
            };
            state.expenses.unshift(expense);
            addNotification({
                recipientEmployeeId: expense.managerEmployeeId,
                recipientRole: 'manager',
                title: 'New Expense Submitted',
                message: 'New expense submitted by ' + expense.employee,
                type: 'warning',
                relatedExpenseId: expense.id,
                actionType: 'expense_submitted_manager'
            });
            addNotification({
                recipientEmployeeId: expense.employeeId,
                recipientRole: 'expense_submitter',
                title: 'Expense Submitted',
                message: expense.id + ' was submitted successfully and is now in manager review.',
                type: 'info',
                relatedExpenseId: expense.id,
                actionType: 'expense_submitted_submitter'
            });
            addAuditLog(user, 'Submitted Expense', 'Expense', expense.id, 'Success');
            writeStoredState(state);
            return deepClone(expense);
        },
        updateExpenseAsSubmitter: function (id, updates, resubmit) {
            var user = getCurrentUser();
            var expense = updateExpenseInternal(id, function (item) {
                Object.keys(updates || {}).forEach(function (key) {
                    item[key] = updates[key];
                });
                if (resubmit) {
                    item.workflowStatus = 'manager_review';
                    item.status = 'pending';
                    pushHistoryEntryOnce(item, 'resubmitted', 'Resubmitted', 'Expense updated and resubmitted.');
                }
            });
            if (!expense) return null;
            addAuditLog(user, 'Updated Expense', 'Expense', expense.id, 'Success');
            if (resubmit) {
                addNotification({
                    recipientEmployeeId: expense.managerEmployeeId,
                    recipientRole: 'manager',
                    title: 'Expense Resubmitted',
                    message: expense.id + ' has been resubmitted and is back in your review queue.',
                    type: 'info',
                    relatedExpenseId: expense.id,
                    actionType: 'expense_resubmitted_manager'
                });
            }
            writeStoredState(state);
            return deepClone(expense);
        },
        deleteExpense: function (id) {
            var expenseIndex = state.expenses.findIndex(function (item) { return item.id === id; });
            if (expenseIndex === -1) return false;
            var removed = state.expenses.splice(expenseIndex, 1)[0];
            addAuditLog(getCurrentUser(), 'Deleted Expense', 'Expense', removed.id, 'Success');
            writeStoredState(state);
            return true;
        },
        managerApprove: function (id, note, assignedFinanceOfficerId) {
            var manager = getCurrentUser();
            var financeOfficer = getFinanceOfficerById(assignedFinanceOfficerId, manager ? manager.organizationId : '');
            if (!financeOfficer) return { success: false, error: 'Please select a finance officer before approving.' };
            var expense = updateExpenseInternal(id, function (item) {
                item.managerDecision = 'Approved';
                item.managerDecisionAt = nowIso();
                item.managerDecisionNote = note || 'Approved by manager.';
                item.assignedFinanceOfficerId = financeOfficer.id;
                item.workflowStatus = 'finance_review';
                item.status = 'pending';
                pushHistoryEntryOnce(item, 'manager_approved', 'Manager Approved', item.managerDecisionNote);
            });
            if (!expense) return null;
            addNotification({ recipientEmployeeId: financeOfficer.employeeId, recipientRole: 'finance_officer', title: 'Expense Ready for Finance Review', message: 'Expense approved by Manager and ready for finance review', type: 'info', relatedExpenseId: expense.id, actionType: 'manager_approved_finance' });
            addNotification({ recipientEmployeeId: expense.employeeId, recipientRole: 'expense_submitter', title: 'Your Expense Was Approved', message: 'Your expense has been approved by Manager', type: 'success', relatedExpenseId: expense.id, actionType: 'manager_approved_submitter' });
            addAuditLog(manager, 'Manager Approved Expense', 'Expense', expense.id, 'Success');
            writeStoredState(state);
            refreshFromBackendSync();
            return deepClone(expense);
        },
        managerEscalate: function (id, note) {
            var manager = getCurrentUser();
            var expense = updateExpenseInternal(id, function (item) {
                item.managerDecision = 'Escalated';
                item.managerDecisionAt = nowIso();
                item.managerDecisionNote = note || 'Escalated to compliance officer for review.';
                item.assignedFinanceOfficerId = null;
                item.workflowStatus = 'compliance_review';
                item.status = 'pending';
                item.escalatedByManager = true;
                pushHistoryEntryOnce(item, 'manager_escalated', 'Escalated to Compliance', item.managerDecisionNote);
            });
            if (!expense) return null;
            addNotification({ recipientEmployeeId: 'CMP-2001', recipientRole: 'compliance_officer', title: 'Expense Escalated for Compliance Review', message: 'Expense escalated by Manager for compliance review', type: 'warning', relatedExpenseId: expense.id, actionType: 'manager_escalated_compliance' });
            addAuditLog(manager, 'Manager Escalated Expense to Compliance', 'Expense', expense.id, 'Success');
            writeStoredState(state);
            return deepClone(expense);
        },
        managerReturn: function (id, note) {
            var manager = getCurrentUser();
            var expense = updateExpenseInternal(id, function (item) {
                item.managerDecision = 'Returned';
                item.managerDecisionAt = nowIso();
                item.managerDecisionNote = note || 'Returned for clarification.';
                item.workflowStatus = 'returned';
                item.status = 'pending';
                pushHistoryEntryOnce(item, 'manager_returned', 'Returned by Manager', item.managerDecisionNote);
            });
            if (!expense) return null;
            addNotification({ recipientEmployeeId: expense.employeeId, recipientRole: 'expense_submitter', title: 'Expense Returned', message: expense.id + ' was returned by your manager. ' + expense.managerDecisionNote, type: 'warning', relatedExpenseId: expense.id, actionType: 'manager_returned_submitter' });
            addAuditLog(manager, 'Manager Returned Expense', 'Expense', expense.id, 'Success');
            writeStoredState(state);
            return deepClone(expense);
        },
        managerReject: function (id, note) {
            var manager = getCurrentUser();
            var expense = updateExpenseInternal(id, function (item) {
                item.managerDecision = 'Rejected';
                item.managerDecisionAt = nowIso();
                item.managerDecisionNote = note || 'Rejected by manager.';
                item.workflowStatus = 'rejected';
                item.status = 'rejected';
                pushHistoryEntryOnce(item, 'manager_rejected', 'Rejected by Manager', item.managerDecisionNote);
            });
            if (!expense) return null;
            addNotification({ recipientEmployeeId: expense.employeeId, recipientRole: 'expense_submitter', title: 'Your Expense Was Rejected', message: 'Your expense has been rejected by Manager', type: 'danger', relatedExpenseId: expense.id, actionType: 'manager_rejected_submitter' });
            addAuditLog(manager, 'Manager Rejected Expense', 'Expense', expense.id, 'Success');
            writeStoredState(state);
            return deepClone(expense);
        },
        financeApprove: function (id, note) {
            var financeUser = getCurrentUser();
            var expense = updateExpenseInternal(id, function (item) {
                item.financeDecision = 'Approved';
                item.financeDecisionAt = nowIso();
                item.financeDecisionNote = note || 'Approved for payment.';
                item.workflowStatus = 'approved_for_payment';
                item.status = 'approved';
                pushHistoryEntryOnce(item, 'finance_approved', 'Finance Approved', item.financeDecisionNote);
            });
            if (!expense) return null;
            addNotification({ recipientEmployeeId: expense.employeeId, recipientRole: 'expense_submitter', title: 'Finance Approved Expense', message: 'Your expense has been approved by Finance Officer', type: 'success', relatedExpenseId: expense.id, actionType: 'finance_approved_submitter' });
            addAuditLog(financeUser, 'Finance Approved Expense', 'Expense', expense.id, 'Success');
            writeStoredState(state);
            return deepClone(expense);
        },
        financeReject: function (id, note) {
            var financeUser = getCurrentUser();
            var expense = updateExpenseInternal(id, function (item) {
                item.financeDecision = 'Rejected';
                item.financeDecisionAt = nowIso();
                item.financeDecisionNote = note || 'Rejected during finance review.';
                item.workflowStatus = 'rejected';
                item.status = 'rejected';
                pushHistoryEntryOnce(item, 'finance_rejected', 'Rejected by Finance', item.financeDecisionNote);
            });
            if (!expense) return null;
            addNotification({ recipientEmployeeId: expense.employeeId, recipientRole: 'expense_submitter', title: 'Finance Rejected Expense', message: 'Your expense has been rejected by Finance Officer', type: 'danger', relatedExpenseId: expense.id, actionType: 'finance_rejected_submitter' });
            addAuditLog(financeUser, 'Finance Rejected Expense', 'Expense', expense.id, 'Success');
            writeStoredState(state);
            return deepClone(expense);
        },
        financeRequestInfo: function (id, note) {
            var financeUser = getCurrentUser();
            var expense = updateExpenseInternal(id, function (item) {
                item.financeDecision = 'Requested Info';
                item.financeDecisionAt = nowIso();
                item.financeDecisionNote = note || 'Additional information requested by finance.';
                item.workflowStatus = 'returned';
                item.status = 'pending';
                pushHistoryEntryOnce(item, 'finance_requested_info', 'Finance Requested Information', item.financeDecisionNote);
            });
            if (!expense) return null;
            addNotification({ recipientEmployeeId: expense.employeeId, recipientRole: 'expense_submitter', title: 'More Information Requested', message: expense.id + ' needs additional information before finance can continue review.', type: 'warning', relatedExpenseId: expense.id, actionType: 'finance_requested_info_submitter' });
            addAuditLog(financeUser, 'Finance Requested More Info', 'Expense', expense.id, 'Success');
            writeStoredState(state);
            return deepClone(expense);
        },
        financeFlag: function (id, note) {
            var financeUser = getCurrentUser();
            var expense = updateExpenseInternal(id, function (item) {
                item.financeDecision = 'Flagged';
                item.financeDecisionAt = nowIso();
                item.financeDecisionNote = note || 'Flagged for compliance review.';
                item.workflowStatus = 'compliance_review';
                item.status = 'pending';
                pushHistoryEntryOnce(item, 'finance_flagged', 'Flagged by Finance', item.financeDecisionNote);
            });
            if (!expense) return null;
            addNotification({ recipientEmployeeId: 'CMP-2001', recipientRole: 'compliance_officer', title: 'Flagged Expense Requires Review', message: expense.id + ' was escalated by finance for compliance investigation.', type: 'danger', relatedExpenseId: expense.id, actionType: 'finance_flagged_compliance' });
            addNotification({ recipientEmployeeId: expense.employeeId, recipientRole: 'expense_submitter', title: 'Expense Under Compliance Review', message: expense.id + ' is under compliance review after finance flagged the claim.', type: 'warning', relatedExpenseId: expense.id, actionType: 'finance_flagged_submitter' });
            addAuditLog(financeUser, 'Flagged Expense', 'Expense', expense.id, 'Success');
            writeStoredState(state);
            return deepClone(expense);
        },
        complianceApprove: function (id, note) {
            var complianceUser = getCurrentUser();
            var expense = updateExpenseInternal(id, function (item) {
                var financeOfficer = getFinanceOfficerById(item.assignedFinanceOfficerId, item.organizationId) || getDefaultFinanceOfficer(item.organizationId);
                item.complianceDecision = 'Approved';
                item.complianceDecisionAt = nowIso();
                item.complianceDecisionNote = note || 'Approved by compliance officer. Forwarded to finance for payment.';
                item.assignedFinanceOfficerId = financeOfficer ? financeOfficer.id : item.assignedFinanceOfficerId;
                item.workflowStatus = 'finance_review';
                item.status = 'pending';
                pushHistoryEntryOnce(item, 'compliance_approved', 'Compliance Approved — Sent to Finance', item.complianceDecisionNote);
            });
            if (!expense) return null;
            addNotification({ recipientEmployeeId: expense.assignedFinanceOfficerId || DEFAULT_ROLE_EMPLOYEE.finance_officer, recipientRole: 'finance_officer', title: 'Compliance-Reviewed Expense Ready', message: 'Compliance approved escalated expense and sent it for finance review', type: 'success', relatedExpenseId: expense.id, actionType: 'compliance_approved_finance' });
            addNotification({ recipientEmployeeId: expense.employeeId, recipientRole: 'expense_submitter', title: 'Compliance Approved Your Expense', message: 'Your escalated expense has been approved by Compliance Officer', type: 'success', relatedExpenseId: expense.id, actionType: 'compliance_approved_submitter' });
            addAuditLog(complianceUser, 'Compliance Approved Expense', 'Expense', expense.id, 'Success');
            writeStoredState(state);
            return deepClone(expense);
        },
        complianceReject: function (id, note) {
            var complianceUser = getCurrentUser();
            var expense = updateExpenseInternal(id, function (item) {
                item.complianceDecision = 'Rejected';
                item.complianceDecisionAt = nowIso();
                item.complianceDecisionNote = note || 'Rejected during compliance review.';
                item.workflowStatus = 'rejected';
                item.status = 'rejected';
                pushHistoryEntryOnce(item, 'compliance_rejected', 'Rejected by Compliance', item.complianceDecisionNote);
            });
            if (!expense) return null;
            addNotification({ recipientEmployeeId: expense.employeeId, recipientRole: 'expense_submitter', title: 'Expense Rejected by Compliance', message: 'Your escalated expense has been rejected by Compliance Officer', type: 'danger', relatedExpenseId: expense.id, actionType: 'compliance_rejected_submitter' });
            addAuditLog(complianceUser, 'Compliance Rejected Expense', 'Expense', expense.id, 'Success');
            writeStoredState(state);
            return deepClone(expense);
        },
        complianceCorrectiveAction: function (id, actionLabel) {
            var complianceUser = getCurrentUser();
            var expense = updateExpenseInternal(id, function (item) {
                item.complianceDecision = 'Corrective Action';
                item.complianceDecisionAt = nowIso();
                item.complianceDecisionNote = actionLabel;
                pushHistoryEntryOnce(item, 'compliance_corrective_action', 'Corrective Action Initiated', actionLabel);
            });
            if (!expense) return null;
            addAuditLog(complianceUser, 'Initiated Corrective Action', 'Expense', expense.id, 'Success');
            writeStoredState(state);
            return deepClone(expense);
        },
        getManagerQueue: function () {
            var user = getCurrentUser();
            return deepClone(getManagerQueue(user ? user.employeeId : 'MGR-2001'));
        },
        getManagerHistory: function () {
            var user = getCurrentUser();
            return deepClone(getManagerHistory(user ? user.employeeId : 'MGR-2001'));
        },
        getComplianceQueue: function () {
            return deepClone(state.expenses.filter(function (expense) {
                return expense.workflowStatus === 'compliance_review';
            }));
        },
        getFinanceReviewQueue: function () {
            return deepClone(getFinanceReviewQueue());
        },
        getFinanceFlaggedQueue: function () {
            return deepClone(getFinanceFlaggedQueue());
        },
        getPaymentBatches: function () {
            return deepClone(buildPaymentBatches());
        },
        releasePaymentBatch: function (batchId) {
            var financeUser = getCurrentUser();
            var batches = buildPaymentBatches();
            var batch = batches.find(function (item) { return item.id === batchId; });
            if (!batch) return null;
            batch.expenseIds.forEach(function (expenseId) {
                var existingExpense = state.expenses.find(function (expense) { return expense.id === expenseId; });
                if (!existingExpense || existingExpense.workflowStatus === 'paid') return;
                updateExpenseInternal(expenseId, function (expense) {
                    expense.workflowStatus = 'paid';
                    expense.status = 'approved';
                    expense.paidAt = nowIso();
                    pushHistoryEntryOnce(expense, 'paid', 'Paid', 'Reimbursement released in payment batch ' + batchId + '.');
                    addNotification({ recipientEmployeeId: expense.employeeId, recipientRole: 'expense_submitter', title: 'Reimbursement Released', message: 'Your reimbursement has been processed', type: 'success', relatedExpenseId: expense.id, actionType: 'finance_reimbursement_processed_submitter' });
                });
            });
            addAuditLog(financeUser, 'Released Payment Batch', 'Payment Batch', batchId, 'Success');
            writeStoredState(state);
            return deepClone(batch);
        },
        getComplianceViolations: function () {
            return deepClone(buildComplianceViolations());
        },
        getNotifications: function () {
            return getNotificationsForUser();
        },
        markNotificationRead: function (id) {
            var notification = state.notifications.find(function (item) { return item.id === id || item.id === String(id); });
            if (!notification) return null;
            notification.unread = false;
            writeStoredState(state);
            return deepClone(notification);
        },
        markAllNotificationsRead: function () {
            var notifications = getNotificationsForUser();
            notifications.forEach(function (notification) {
                var item = state.notifications.find(function (stored) { return stored.id === notification.id; });
                if (item) item.unread = false;
            });
            writeStoredState(state);
        },
        deleteNotification: function (id) {
            var index = state.notifications.findIndex(function (item) { return item.id === id || item.id === String(id); });
            if (index === -1) return false;
            state.notifications.splice(index, 1);
            writeStoredState(state);
            return true;
        },
        getAuditLogs: function () {
            return deepClone(state.auditLogs);
        },
        getStatusTimeline: function (expenseId) {
            var expense = state.expenses.find(function (item) { return item.id === expenseId; });
            return expense ? deepClone(getStatusTimeline(expense)) : [];
        },
        /* Utility */
        titleCase: titleCase,
        formatCurrency: function (amount, currency) {
            var symbol = currency === 'USD' ? '$' : '₹';
            return symbol + Number(amount || 0).toLocaleString(currency === 'USD' ? 'en-US' : 'en-IN');
        },
        formatTimeAgo: formatTimeAgo
    };

    (function installBackendStoreBridge(storeApi) {
        if (!window.FinStackApi || !storeApi) return;

        function api(path, method, body) {
            var result = window.FinStackApi.syncRequest(path, { method: method, body: body });
            refreshFromBackendSync();
            return result;
        }

        function tryApi(path, method, body, fallback) {
            try {
                return api(path, method, body);
            } catch (error) {
                console.error('[FinStackStore] API error:', error.message);
                if (typeof fallback === 'function') return fallback(error);
                return fallback;
            }
        }

        function currentOrgId(payload) {
            var user = getCurrentUser();
            return (payload && payload.organizationId) || (user && user.organizationId) || (state.organizations[0] && state.organizations[0].organizationId) || 'finstack-tech-01';
        }

        function categoryName(categoryId) {
            var category = state.categories.find(function (item) { return item.id === categoryId; });
            return category ? category.name : categoryId;
        }

        function userName(employeeId) {
            var user = state.users.find(function (item) { return item.employeeId === employeeId; });
            return user ? user.fullName : employeeId;
        }

        function userDto(payload) {
            return {
                employeeId: payload.employeeId,
                fullName: payload.fullName,
                email: payload.email,
                department: payload.department || 'General',
                phone: payload.phone || '',
                location: payload.location || 'India',
                roles: Array.isArray(payload.roles) ? payload.roles : [payload.roles || 'expense_submitter'],
                managerEmployeeId: payload.managerEmployeeId || '',
                status: payload.status || 'Active',
                accountStatus: payload.accountStatus || 'approved',
                organizationId: currentOrgId(payload),
                password: payload.password || 'FinStack@123',
                firstLoginRequired: payload.firstLoginRequired !== false
            };
        }

        function categoryDto(payload, existing) {
            return {
                name: payload.name,
                description: payload.description || '',
                limit: Number(payload.limit !== undefined ? payload.limit : (existing ? existing.limit : 0)),
                currency: payload.currency || (existing && existing.currency) || 'INR',
                status: payload.status || (existing && existing.status) || 'Active',
                organizationId: currentOrgId(payload),
                requiresReceipt: payload.requiresReceipt !== undefined ? !!payload.requiresReceipt : (existing ? !!existing.requiresReceipt : true),
                color: payload.color || (existing && existing.color) || '#7C3AED'
            };
        }

        function policyDto(payload, existing) {
            return {
                name: payload.name,
                categoryId: payload.categoryId || (existing && existing.categoryId),
                maxAmount: Number(payload.maxAmount !== undefined ? payload.maxAmount : (existing ? existing.maxAmount : 0)),
                currency: payload.currency || (existing && existing.currency) || 'INR',
                approval: payload.approval || (existing && existing.approval) || 'Manager + Finance',
                status: payload.status || (existing && existing.status) || 'Active',
                description: payload.description || '',
                requiresApproval: payload.requiresApproval !== undefined ? !!payload.requiresApproval : (existing ? !!existing.requiresApproval : true),
                receiptRequired: payload.receiptRequired !== undefined ? !!payload.receiptRequired : (existing ? !!existing.receiptRequired : true),
                organizationId: currentOrgId(payload)
            };
        }

        function expenseDto(payload, existing) {
            var user = getCurrentUser() || {};
            return {
                employeeId: payload.employeeId || (existing && existing.employeeId) || user.employeeId || 'EMP-1001',
                organizationId: payload.organizationId || (existing && existing.organizationId) || user.organizationId || currentOrgId(payload),
                managerEmployeeId: payload.managerEmployeeId || (existing && existing.managerEmployeeId) || user.managerEmployeeId || 'MGR-2001',
                assignedFinanceOfficerId: payload.assignedFinanceOfficerId !== undefined ? payload.assignedFinanceOfficerId : ((existing && existing.assignedFinanceOfficerId) || null),
                amount: Number(payload.amount !== undefined ? payload.amount : (existing ? existing.amount : 0)),
                currency: payload.currency || (existing && existing.currency) || 'INR',
                categoryId: payload.categoryId || (existing && existing.categoryId),
                merchant: payload.merchant || (existing && existing.merchant) || '',
                date: payload.date || (existing && existing.date) || new Date().toISOString().slice(0, 10),
                status: payload.status || (existing && existing.status) || 'pending',
                workflowStatus: payload.workflowStatus || (existing && existing.workflowStatus) || 'manager_review',
                notes: payload.notes || '',
                paymentMethod: payload.paymentMethod || (existing && existing.paymentMethod) || 'personal-card',
                receiptFileName: payload.receiptFileName || (existing && existing.receiptFileName) || '',
                extraction_confidence: payload.extraction_confidence,
                flag: payload.flag,
                risk_score: payload.risk_score
            };
        }

        function appendHistory(expense, code, label, note) {
            var history = Array.isArray(expense.history) ? deepClone(expense.history) : [];
            history.push({ code: code, label: label, at: nowIso(), note: note || '' });
            return history;
        }

        function transitionExpense(id, updates, code, label, note) {
            var expense = storeApi.getExpenseById(id);
            if (!expense) return null;
            var body = Object.assign({}, updates, { history: appendHistory(expense, code, label, note) });
            return tryApi('/expenses/' + encodeURIComponent(id), 'PATCH', body, null);
        }

        storeApi.refresh = function () {
            return deepClone(refreshFromBackendSync());
        };

        storeApi.addUser = function (payload) {
            var created = tryApi('/users', 'POST', userDto(payload), function (error) {
                return { success: false, error: error.message };
            });
            if (created && created.success === false) return created;
            return { success: true, user: deepClone(getUserByEmployeeId(payload.employeeId)) };
        };
        storeApi.updateUser = function (employeeId, updates) {
            return tryApi('/users/' + encodeURIComponent(employeeId), 'PATCH', updates, null);
        };
        storeApi.deleteUser = function (employeeId) {
            return !!tryApi('/users/' + encodeURIComponent(employeeId), 'DELETE', undefined, false);
        };
        storeApi.changeUserRole = function (employeeId, newRoles) {
            return storeApi.updateUser(employeeId, { roles: Array.isArray(newRoles) ? newRoles : [newRoles] });
        };

        storeApi.addCategory = function (payload) {
            return tryApi('/categories', 'POST', categoryDto(payload), null);
        };
        storeApi.updateCategory = function (id, updates) {
            var existing = state.categories.find(function (item) { return item.id === id; });
            return tryApi('/categories/' + encodeURIComponent(id), 'PATCH', categoryDto(Object.assign({}, existing || {}, updates), existing), null);
        };
        storeApi.deleteCategory = function (id) {
            return !!tryApi('/categories/' + encodeURIComponent(id), 'DELETE', undefined, false);
        };

        storeApi.getPolicies = function () {
            return deepClone(state.policies).map(function (policy) {
                policy.category = categoryName(policy.categoryId);
                return policy;
            });
        };
        storeApi.addPolicy = function (payload) {
            return tryApi('/policies', 'POST', policyDto(payload), null);
        };
        storeApi.updatePolicy = function (id, updates) {
            var existing = state.policies.find(function (item) { return String(item.id) === String(id); });
            return tryApi('/policies/' + encodeURIComponent(id), 'PATCH', policyDto(Object.assign({}, existing || {}, updates), existing), null);
        };
        storeApi.deletePolicy = function (id) {
            return !!tryApi('/policies/' + encodeURIComponent(id), 'DELETE', undefined, false);
        };

        storeApi.submitExpense = function (payload) {
            var expense = tryApi('/expenses', 'POST', expenseDto(payload), null);
            return expense ? Object.assign({}, expense, { category: categoryName(expense.categoryId), employee: userName(expense.employeeId) }) : null;
        };
        storeApi.updateExpenseAsSubmitter = function (id, updates, resubmit) {
            var existing = storeApi.getExpenseById(id);
            var body = Object.assign({}, updates || {});
            if (resubmit) {
                body.workflowStatus = 'manager_review';
                body.status = 'pending';
                body.history = appendHistory(existing, 'resubmitted', 'Resubmitted', 'Expense updated and resubmitted.');
            }
            return tryApi('/expenses/' + encodeURIComponent(id), 'PATCH', body, null);
        };
        storeApi.deleteExpense = function (id) {
            return !!tryApi('/expenses/' + encodeURIComponent(id), 'DELETE', undefined, false);
        };
        storeApi.managerApprove = function (id, note, assignedFinanceOfficerId) {
            if (!assignedFinanceOfficerId) return { success: false, error: 'Please select a finance officer before approving.' };
            return transitionExpense(id, { managerDecision: 'Approved', managerDecisionAt: nowIso(), managerDecisionNote: note || 'Approved by manager.', assignedFinanceOfficerId: assignedFinanceOfficerId, workflowStatus: 'finance_review', status: 'pending' }, 'manager_approved', 'Manager Approved', note || 'Approved by manager.');
        };
        storeApi.managerEscalate = function (id, note) {
            return transitionExpense(id, { managerDecision: 'Escalated', managerDecisionAt: nowIso(), managerDecisionNote: note || 'Escalated to compliance officer for review.', assignedFinanceOfficerId: null, workflowStatus: 'compliance_review', status: 'pending', escalatedByManager: true }, 'manager_escalated', 'Escalated to Compliance', note || 'Escalated to compliance officer for review.');
        };
        storeApi.managerReturn = function (id, note) {
            return transitionExpense(id, { managerDecision: 'Returned', managerDecisionAt: nowIso(), managerDecisionNote: note || 'Returned for clarification.', workflowStatus: 'returned', status: 'pending' }, 'manager_returned', 'Returned by Manager', note || 'Returned for clarification.');
        };
        storeApi.managerReject = function (id, note) {
            return transitionExpense(id, { managerDecision: 'Rejected', managerDecisionAt: nowIso(), managerDecisionNote: note || 'Rejected by manager.', workflowStatus: 'rejected', status: 'rejected' }, 'manager_rejected', 'Rejected by Manager', note || 'Rejected by manager.');
        };
        storeApi.financeApprove = function (id, note) {
            return transitionExpense(id, { financeDecision: 'Approved', financeDecisionAt: nowIso(), financeDecisionNote: note || 'Approved for payment.', workflowStatus: 'approved_for_payment', status: 'approved' }, 'finance_approved', 'Finance Approved', note || 'Approved for payment.');
        };
        storeApi.financeReject = function (id, note) {
            return transitionExpense(id, { financeDecision: 'Rejected', financeDecisionAt: nowIso(), financeDecisionNote: note || 'Rejected during finance review.', workflowStatus: 'rejected', status: 'rejected' }, 'finance_rejected', 'Rejected by Finance', note || 'Rejected during finance review.');
        };
        storeApi.financeRequestInfo = function (id, note) {
            return transitionExpense(id, { financeDecision: 'Requested Info', financeDecisionAt: nowIso(), financeDecisionNote: note || 'Additional information requested by finance.', workflowStatus: 'returned', status: 'pending' }, 'finance_requested_info', 'Finance Requested Information', note || 'Additional information requested by finance.');
        };
        storeApi.financeFlag = function (id, note) {
            return transitionExpense(id, { financeDecision: 'Flagged', financeDecisionAt: nowIso(), financeDecisionNote: note || 'Flagged for compliance review.', workflowStatus: 'compliance_review', status: 'pending' }, 'finance_flagged', 'Flagged by Finance', note || 'Flagged for compliance review.');
        };
        storeApi.complianceApprove = function (id, note) {
            var expense = storeApi.getExpenseById(id);
            var financeOfficer = expense ? (getFinanceOfficerById(expense.assignedFinanceOfficerId, expense.organizationId) || getDefaultFinanceOfficer(expense.organizationId)) : null;
            return transitionExpense(id, { complianceDecision: 'Approved', complianceDecisionAt: nowIso(), complianceDecisionNote: note || 'Approved by compliance officer. Forwarded to finance for payment.', assignedFinanceOfficerId: financeOfficer ? financeOfficer.id : (expense ? expense.assignedFinanceOfficerId : null), workflowStatus: 'finance_review', status: 'pending' }, 'compliance_approved', 'Compliance Approved - Sent to Finance', note || 'Approved by compliance officer.');
        };
        storeApi.complianceReject = function (id, note) {
            return transitionExpense(id, { complianceDecision: 'Rejected', complianceDecisionAt: nowIso(), complianceDecisionNote: note || 'Rejected during compliance review.', workflowStatus: 'rejected', status: 'rejected' }, 'compliance_rejected', 'Rejected by Compliance', note || 'Rejected during compliance review.');
        };
        storeApi.complianceCorrectiveAction = function (id, actionLabel) {
            return transitionExpense(id, { complianceDecision: 'Corrective Action', complianceDecisionAt: nowIso(), complianceDecisionNote: actionLabel || 'Corrective action initiated.' }, 'compliance_corrective_action', 'Corrective Action Initiated', actionLabel || 'Corrective action initiated.');
        };
        storeApi.releasePaymentBatch = function (batchId) {
            var batch = buildPaymentBatches().find(function (item) { return item.id === batchId; });
            if (!batch) return null;
            batch.expenseIds.forEach(function (expenseId) {
                var expense = storeApi.getExpenseById(expenseId);
                if (!expense) return;
                transitionExpense(expenseId, { workflowStatus: 'paid', status: 'approved', paidAt: nowIso() }, 'paid', 'Paid', 'Reimbursement released in payment batch ' + batchId + '.');
                tryApi('/transactions', 'POST', {
                    expenseId: expense.id,
                    employeeId: expense.employeeId,
                    organizationId: expense.organizationId,
                    amount: Number(expense.amount || 0),
                    currency: expense.currency || 'INR',
                    merchant: expense.merchant,
                    categoryId: expense.categoryId,
                    paymentMethod: expense.paymentMethod || 'personal-card',
                    status: 'processed',
                    transactionDate: new Date().toISOString(),
                    processedAt: new Date().toISOString()
                }, null);
            });
            refreshFromBackendSync();
            return deepClone(batch);
        };

        storeApi.markNotificationRead = function (id) {
            return tryApi('/notifications/' + encodeURIComponent(id), 'PATCH', { unread: false }, null);
        };
        storeApi.markAllNotificationsRead = function () {
            getNotificationsForUser().forEach(function (notification) {
                tryApi('/notifications/' + encodeURIComponent(notification.id), 'PATCH', { unread: false }, null);
            });
            refreshFromBackendSync();
        };
        storeApi.deleteNotification = function (id) {
            return !!tryApi('/notifications/' + encodeURIComponent(id), 'DELETE', undefined, false);
        };
        storeApi.getTransactions = function () {
            return deepClone(state.transactions);
        };
        storeApi.addTransaction = function (payload) {
            return tryApi('/transactions', 'POST', payload, null);
        };
        storeApi.updateTransaction = function (id, updates) {
            return tryApi('/transactions/' + encodeURIComponent(id), 'PATCH', updates, null);
        };
        storeApi.deleteTransaction = function (id) {
            return !!tryApi('/transactions/' + encodeURIComponent(id), 'DELETE', undefined, false);
        };
        storeApi.getReports = function () {
            return deepClone(state.reports || {});
        };
        storeApi.getDashboard = function () {
            return deepClone(state.dashboard || {});
        };

        /* ===== Subscription APIs ===== */
        storeApi.getPlans = function () {
            return deepClone(state.plans || []);
        };
        storeApi.getSubscriptions = function () {
            return deepClone(state.subscriptions || []);
        };
        storeApi.getSubscriptionById = function (id) {
            if (!state || !state.subscriptions) return null;
            var sub = state.subscriptions.find(function (s) { return s.id === id; });
            return sub ? deepClone(sub) : null;
        };
        storeApi.getOrganizationSubscription = function (organizationId) {
            if (!state || !state.subscriptions) return null;
            var sub = state.subscriptions.find(function (s) { return s.organizationId === organizationId; });
            return sub ? deepClone(sub) : null;
        };
        storeApi.createSubscription = function (payload) {
            return tryApi('/subscriptions', 'POST', payload, null);
        };
        storeApi.updateSubscription = function (id, updates) {
            return tryApi('/subscriptions/' + encodeURIComponent(id), 'PATCH', updates, null);
        };
    })(window.FinStackStore);
})();
