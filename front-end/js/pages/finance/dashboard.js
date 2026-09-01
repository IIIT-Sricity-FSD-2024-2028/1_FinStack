
      const state = {
        settings: {
          officerName: 'Rajesh Kumar',
          officerEmail: 'rajesh.kumar@finstack.io',
          department: 'Finance Operations',
          employeeId: 'FIN-2001',
          phone: '+91 90000 33333',
          location: 'Chennai, India',
          organizationId: 'finstack-tech-01',
          managerEmployeeId: '',
          timezone: 'Asia/Kolkata',
          currency: 'INR',
          theme: 'Dark',
          notes: 'Enable dual verification for flagged reimbursements before release. Review duplicate claim thresholds every Friday.',
          language: 'English (US)',
          summaryTime: '09:00 AM',
          dateFormat: 'DD MMM, YYYY',
          landingPage: 'Dashboard',
          emailNotifications: true,
          highRiskAlerts: true,
          weeklyDigest: true,
          soundAlerts: false,
          twoFactor: true,
          loginAlerts: true,
          riskConfirm: true,
          sessionTimeoutEnabled: true,
          sessionTimeout: '30 minutes',
          approvalConfirm: 'High',
          sidebarDefaultCollapsed: false,
          compactDensity: false
        },
        policyCount: 0,
        expenses: [
{"id":"EXP-1001","employee":"Sarah Johnson","category":"Travel","amount":7500,"status":"approved","method":"Corporate Card","submitted":"2026-03-21","notes":"Client visit to Bangalore"},
{"id":"EXP-1002","employee":"Aarav Sharma","category":"Meals","amount":1850,"status":"paid","method":"Reimbursement","submitted":"2026-03-20","notes":"Team dinner after client workshop"},
{"id":"EXP-1003","employee":"Ishita Rao","category":"Hotel","amount":12600,"status":"approved","method":"Corporate Card","submitted":"2026-03-19","notes":"2-night stay for Hyderabad summit"},
{"id":"EXP-1004","employee":"Kabir Singh","category":"Flight","amount":9400,"status":"approved","method":"Corporate Card","submitted":"2026-03-18","notes":"Round trip airfare to Pune"},
{"id":"EXP-1005","employee":"Ravi Kumar","category":"Office Supplies","amount":4800,"status":"paid","method":"Reimbursement","submitted":"2026-03-23","notes":"Printer paper and accessories"},
{"id":"EXP-1006","employee":"Neha Verma","category":"Software","amount":15999,"status":"approved","method":"Corporate Card","submitted":"2026-03-17","notes":"Quarterly analytics tool renewal"},
{"id":"EXP-1007","employee":"Vikram Patel","category":"Transport","amount":2200,"status":"pending","method":"Reimbursement","submitted":"2026-03-24","notes":"Local cabs for vendor meetings"},
{"id":"EXP-1008","employee":"Michael Chen","category":"Food","amount":12000,"status":"flagged","method":"Reimbursement","submitted":"2026-03-22","notes":"Potential duplicate invoice detected"},
{"id":"EXP-1009","employee":"Pooja Nair","category":"Training","amount":8600,"status":"approved","method":"Corporate Card","submitted":"2026-03-16","notes":"Compliance workshop registration"},
{"id":"EXP-1010","employee":"Daniel Lee","category":"Travel","amount":11250,"status":"pending","method":"Corporate Card","submitted":"2026-03-24","notes":"Airport transfers and train booking"}
],
        reviews: [
{"id":"EXP-1001","by":"Sarah Johnson","amount":7500,"manager":"Approved","note":"Travel plan verified"},
{"id":"EXP-1002","by":"Aarav Sharma","amount":1850,"manager":"Approved","note":"Ready for reimbursement"},
{"id":"EXP-1003","by":"Ishita Rao","amount":12600,"manager":"Approved","note":"Hotel invoice attached"},
{"id":"EXP-1004","by":"Kabir Singh","amount":9400,"manager":"Approved","note":"Airfare matched with itinerary"},
{"id":"EXP-1005","by":"Ravi Kumar","amount":4800,"manager":"Approved","note":"Office supply bill approved"},
{"id":"EXP-1006","by":"Neha Verma","amount":15999,"manager":"Approved","note":"License renewal validated"},
{"id":"EXP-1007","by":"Vikram Patel","amount":2200,"manager":"Approved","note":"Awaiting finance review"},
{"id":"EXP-1008","by":"Michael Chen","amount":12000,"manager":"Approved with note","note":"Potential duplicate invoice — investigate"},
{"id":"EXP-1009","by":"Pooja Nair","amount":8600,"manager":"Approved","note":"Training registration confirmed"},
{"id":"EXP-1010","by":"Daniel Lee","amount":11250,"manager":"Approved","note":"Need bank sync before release"}
],
        transactions: [],
        flagged: [
{"id":"EXP-1008","reason":"Duplicate invoice suspected","risk":"High","tone":"flagged"},
{"id":"EXP-1007","reason":"Receipt missing vendor GST details","risk":"Medium","tone":"pending"},
{"id":"EXP-1010","reason":"Travel cost above expected corridor average","risk":"Medium","tone":"pending"}
],
        payments: [
{"id":"PB-228","expenseIds":["EXP-1002","EXP-1005"],"count":2,"total":6650,"status":"paid","scheduled":"2026-03-23"},
{"id":"PB-229","expenseIds":["EXP-1001","EXP-1003","EXP-1004"],"count":3,"total":29500,"status":"pending","scheduled":"2026-03-28"},
{"id":"PB-230","expenseIds":["EXP-1006","EXP-1009"],"count":2,"total":24599,"status":"approved","scheduled":"2026-03-29"},
{"id":"PB-231","expenseIds":["EXP-1007","EXP-1010"],"count":2,"total":13450,"status":"pending","scheduled":"2026-03-30"}
],
        reports: [{"id": "RPT-01", "title": "Monthly Expense Report", "description": "Track submitted, approved, flagged, and paid expenses with totals and category splits.", "button": "Download", "file": "monthly-expense-report.txt", "type": "finance", "owner": "Finance Ops", "pinned": true, "scheduled": true, "generatedToday": true, "runs": 18, "priority": 10, "freshness": 9, "lastRun": "09:14 AM", "size": "2.4 MB"}, {"id": "RPT-02", "title": "Fraud Detection Report", "description": "Summary of suspicious patterns, escalations, and rule-based anomalies.", "button": "Generate", "file": "fraud-detection-report.txt", "type": "risk", "owner": "Risk Engine", "pinned": true, "scheduled": false, "generatedToday": false, "runs": 11, "priority": 9, "freshness": 8, "lastRun": "Yesterday", "size": "1.1 MB"}, {"id": "RPT-03", "title": "Payment Release Report", "description": "Batches released, payment status, total value, and timeline.", "button": "Export", "file": "payment-release-report.txt", "type": "finance", "owner": "Treasury Desk", "pinned": false, "scheduled": true, "generatedToday": true, "runs": 15, "priority": 8, "freshness": 8, "lastRun": "08:36 AM", "size": "1.8 MB"}, {"id": "RPT-04", "title": "Compliance Summary", "description": "Audit-readiness snapshot of approvals, controls, and violations.", "button": "Open", "file": "compliance-summary.txt", "type": "compliance", "owner": "Compliance", "pinned": true, "scheduled": true, "generatedToday": false, "runs": 21, "priority": 10, "freshness": 7, "lastRun": "Yesterday", "size": "1.3 MB"}, {"id": "RPT-05", "title": "Expense Category Analysis", "description": "Category-level spending trends and outlier amounts.", "button": "Generate", "file": "category-analysis.txt", "type": "finance", "owner": "Analytics", "pinned": false, "scheduled": false, "generatedToday": true, "runs": 9, "priority": 7, "freshness": 9, "lastRun": "11:04 AM", "size": "2.0 MB"}, {"id": "RPT-06", "title": "Audit Readiness Pack", "description": "Consolidated summary for internal reviews and compliance checks.", "button": "Download", "file": "audit-readiness-pack.txt", "type": "compliance", "owner": "Internal Audit", "pinned": true, "scheduled": false, "generatedToday": false, "runs": 13, "priority": 9, "freshness": 6, "lastRun": "2 days ago", "size": "3.6 MB"}, {"id": "RPT-07", "title": "Approval SLA Breach Monitor", "description": "Measures review delays, queue health, and teams breaching finance SLA windows.", "button": "Generate", "file": "approval-sla-monitor.txt", "type": "ops", "owner": "Workflow Ops", "pinned": false, "scheduled": true, "generatedToday": true, "runs": 7, "priority": 8, "freshness": 10, "lastRun": "10:22 AM", "size": "944 KB"}, {"id": "RPT-08", "title": "Vendor Spend Concentration", "description": "Highlights concentration risk by vendor, team, and payment corridor.", "button": "Download", "file": "vendor-spend-concentration.txt", "type": "risk", "owner": "Procurement Finance", "pinned": false, "scheduled": false, "generatedToday": false, "runs": 6, "priority": 7, "freshness": 7, "lastRun": "3 days ago", "size": "1.7 MB"}, {"id": "RPT-09", "title": "Reconciliation Variance Tracker", "description": "Breakdown of mismatches by amount, bank, owner, and resolution cycle time.", "button": "Open", "file": "reconciliation-variance-tracker.txt", "type": "ops", "owner": "Reconciliation Desk", "pinned": true, "scheduled": true, "generatedToday": true, "runs": 17, "priority": 10, "freshness": 10, "lastRun": "09:42 AM", "size": "1.5 MB"}, {"id": "RPT-10", "title": "Policy Exception Ledger", "description": "Full list of out-of-policy submissions with disposition and control owner.", "button": "Export", "file": "policy-exception-ledger.txt", "type": "compliance", "owner": "Policy Control", "pinned": false, "scheduled": true, "generatedToday": false, "runs": 12, "priority": 8, "freshness": 8, "lastRun": "Yesterday", "size": "1.2 MB"}, {"id": "RPT-11", "title": "Travel Corridor Heatmap", "description": "Shows repeated travel routes, unit cost per corridor, and budget pressure zones.", "button": "Open", "file": "travel-corridor-heatmap.txt", "type": "finance", "owner": "Travel Desk", "pinned": false, "scheduled": true, "generatedToday": true, "runs": 14, "priority": 8, "freshness": 9, "lastRun": "10:41 AM", "size": "2.8 MB"}, {"id": "RPT-12", "title": "Corporate Card Utilization", "description": "Card-level utilization, anomalies, inactive cards, and repayment behaviour.", "button": "Generate", "file": "card-utilization.txt", "type": "risk", "owner": "Card Program", "pinned": true, "scheduled": true, "generatedToday": false, "runs": 16, "priority": 9, "freshness": 8, "lastRun": "Yesterday", "size": "1.9 MB"}, {"id": "RPT-13", "title": "Department Burn Rate", "description": "Compares department spend velocity against monthly budget envelopes.", "button": "Download", "file": "department-burn-rate.txt", "type": "finance", "owner": "FP&A", "pinned": false, "scheduled": false, "generatedToday": true, "runs": 8, "priority": 7, "freshness": 9, "lastRun": "11:12 AM", "size": "2.2 MB"}, {"id": "RPT-14", "title": "Aging Review Queue", "description": "Lists expense claims by aging bucket and likely owner bottlenecks.", "button": "Open", "file": "aging-review-queue.txt", "type": "ops", "owner": "Finance Ops", "pinned": false, "scheduled": true, "generatedToday": true, "runs": 10, "priority": 8, "freshness": 10, "lastRun": "09:57 AM", "size": "1.0 MB"}, {"id": "RPT-15", "title": "Exception Resolution Tracker", "description": "Monitors flagged expenses through investigation, escalation, and closure.", "button": "Export", "file": "exception-resolution-tracker.txt", "type": "compliance", "owner": "Risk Ops", "pinned": true, "scheduled": false, "generatedToday": false, "runs": 12, "priority": 9, "freshness": 8, "lastRun": "2 days ago", "size": "1.4 MB"}, {"id": "RPT-16", "title": "Treasury Cash Outflow Forecast", "description": "Projects next seven days of reimbursement outflows and release risk.", "button": "Generate", "file": "cash-outflow-forecast.txt", "type": "finance", "owner": "Treasury Desk", "pinned": false, "scheduled": true, "generatedToday": true, "runs": 19, "priority": 10, "freshness": 10, "lastRun": "08:58 AM", "size": "1.6 MB"}, {"id": "RPT-17", "title": "Duplicate Claim Detector", "description": "Potential duplicate submissions matched by amount, merchant, and timestamps.", "button": "Open", "file": "duplicate-claim-detector.txt", "type": "risk", "owner": "Risk Engine", "pinned": true, "scheduled": true, "generatedToday": true, "runs": 22, "priority": 10, "freshness": 10, "lastRun": "11:20 AM", "size": "1.3 MB"}, {"id": "RPT-18", "title": "Control Ownership Matrix", "description": "Maps active controls to owners, frequencies, and execution gaps.", "button": "Download", "file": "control-ownership-matrix.txt", "type": "compliance", "owner": "Governance", "pinned": false, "scheduled": false, "generatedToday": false, "runs": 5, "priority": 7, "freshness": 6, "lastRun": "4 days ago", "size": "1.1 MB"}],
        reportRuns: [{"time": "11:21 AM", "reportId": "RPT-17", "action": "Generated", "owner": "Risk Engine", "status": "Ready"}, {"time": "11:12 AM", "reportId": "RPT-13", "action": "Downloaded", "owner": "FP&A", "status": "Delivered"}, {"time": "11:06 AM", "reportId": "RPT-05", "action": "Previewed", "owner": "Analytics", "status": "Ready"}, {"time": "10:48 AM", "reportId": "RPT-09", "action": "Generated", "owner": "Reconciliation Desk", "status": "Ready"}, {"time": "10:41 AM", "reportId": "RPT-11", "action": "Opened", "owner": "Travel Desk", "status": "Ready"}, {"time": "10:22 AM", "reportId": "RPT-07", "action": "Scheduled", "owner": "Workflow Ops", "status": "Queued"}, {"time": "09:58 AM", "reportId": "RPT-01", "action": "Downloaded", "owner": "Finance Ops", "status": "Delivered"}, {"time": "09:57 AM", "reportId": "RPT-14", "action": "Opened", "owner": "Finance Ops", "status": "Ready"}, {"time": "09:25 AM", "reportId": "RPT-07", "action": "Scheduled", "owner": "Workflow Ops", "status": "Queued"}, {"time": "08:58 AM", "reportId": "RPT-16", "action": "Generated", "owner": "Treasury Desk", "status": "Ready"}],
        reportView: { chip: 'all', search: '', type: 'all', sort: 'priority' },
        activities: [],
        alerts: [
{"tone":"red","title":"Duplicate invoice detected","text":"EXP-1008 submitted by Michael Chen is flagged for possible duplicate billing.","time":"5 min ago"},
{"tone":"yellow","title":"Pending finance approvals","text":"EXP-1007 and EXP-1010 are still waiting for final finance action.","time":"18 min ago"},
{"tone":"cyan","title":"Payment batch ready","text":"PB-229 contains EXP-1001, EXP-1003, and EXP-1004 and is ready for release.","time":"43 min ago"},
{"tone":"yellow","title":"Receipt verification required","text":"EXP-1007 needs GST details before reimbursement can be cleared.","time":"1 hour ago"},
{"tone":"red","title":"Travel variance alert","text":"EXP-1010 is above corridor average and is under additional review.","time":"2 hours ago"}
],
        audit: [
{"time":"08:42 AM","user":"System","action":"Bank Sync Pending","entity":"Awaiting backend transaction data"},
{"time":"09:02 AM","user":"Finance Officer","action":"Approved Expense","entity":"EXP-1001"},
{"time":"09:08 AM","user":"Finance Officer","action":"Released Payment","entity":"PB-228"},
{"time":"09:18 AM","user":"Risk Engine","action":"Duplicate Match Found","entity":"EXP-1008"},
{"time":"09:31 AM","user":"Finance Officer","action":"Approved Expense","entity":"EXP-1003"},
{"time":"09:44 AM","user":"Finance Officer","action":"Scheduled Payment","entity":"PB-229"},
{"time":"10:05 AM","user":"Finance Officer","action":"Reconciliation Run","entity":"Backend transaction review"},
{"time":"10:18 AM","user":"Finance Officer","action":"Queued Payment Batch","entity":"PB-230"},
{"time":"10:27 AM","user":"Analytics","action":"Generated Report","entity":"RPT-13"},
{"time":"10:58 AM","user":"Finance Officer","action":"Approved Expense","entity":"EXP-1009"}
],
        reconciliation: [],
        autoMatch: false,
        lastReconciliationRun: 'Not executed today'

      };

      function mapFinanceStatus(expense) {
        if (expense.workflowStatus === 'paid') return 'paid';
        if (expense.workflowStatus === 'approved_for_payment' || expense.workflowStatus === 'payment_processing') return 'approved';
        if (expense.workflowStatus === 'compliance_review') return 'flagged';
        if (expense.workflowStatus === 'rejected') return 'rejected';
        return 'pending';
      }

      function mapPaymentMethod(value) {
        if (!value) return 'Reimbursement';
        if (value === 'corporate-card') return 'Corporate Card';
        if (value === 'personal-card') return 'Reimbursement';
        return capitalize(String(value).replace(/-/g, ' '));
      }

      function uniqueById(items) {
        const seen = new Set();
        return (items || []).filter(item => {
          if (!item || !item.id || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      }

      function recordBelongsToOrganization(record, organizationId, organizationEmployeeIds) {
        if (!organizationId) return true;
        if (record.organizationId) return record.organizationId === organizationId;
        if (record.employeeId) return organizationEmployeeIds.has(record.employeeId);
        return true;
      }

      function scopePaymentBatchesToExpenses(batches, expenses) {
        const expenseById = new Map(expenses.map(expense => [expense.id, expense]));
        return (batches || [])
          .map(batch => {
            const expenseIds = (batch.expenseIds || []).filter(id => expenseById.has(id));
            if (!expenseIds.length) return null;
            return {
              ...batch,
              expenseIds,
              count: expenseIds.length,
              total: expenseIds.reduce((sum, id) => sum + Number((expenseById.get(id) || {}).amount || 0), 0)
            };
          })
          .filter(Boolean);
      }

      function isConfigurationManagerPolicy(policy) {
        const ownerRole = String(policy.ownerRole || '').toLowerCase();
        return !ownerRole || ownerRole === 'configuration_manager';
      }

      function isFinanceReviewedExpense(expense) {
        return Boolean(String(expense.financeDecision || '').trim());
      }

      function classifyFinanceActivity(action) {
        const text = String(action || '').toLowerCase();
        if (text === 'approved expense' || text.includes('finance approved expense')) {
          return { key: 'finance_approved', label: 'Expense moved to payment queue' };
        }
        if (text === 'rejected expense' || text.includes('finance rejected expense')) {
          return { key: 'finance_rejected', label: 'Expense rejected by Finance Officer' };
        }
        if (text === 'flagged expense' || text.includes('flagged expense')) {
          return { key: 'finance_flagged', label: 'Expense flagged by Finance Officer' };
        }
        if (text.includes('requested more info') || text.includes('requested information')) {
          return { key: 'finance_requested_info', label: 'More information requested' };
        }
        if (text.includes('released payment') || text.includes('payment released')) {
          return { key: 'payment_released', label: 'Payment released by Finance Officer' };
        }
        if (text.includes('scheduled payment')) {
          return { key: 'payment_scheduled', label: 'Payment batch scheduled' };
        }
        if (text.includes('matched reconciliation') || text.includes('reconciled transaction') || text.includes('reconciliation run')) {
          return { key: 'reconciliation_completed', label: 'Reconciliation completed' };
        }
        return null;
      }

      function extractFinanceEntityId(entry) {
        const raw = [entry.entityName, entry.entity, entry.entityType].filter(Boolean).join(' ');
        const match = String(raw).match(/\b(EXP-\d+|PB-[A-Z0-9-]+|REC-\d+|TXN-\d+)\b/i);
        return match ? match[1].toUpperCase() : String(entry.entityName || entry.entity || '').trim();
      }

      function isFinanceActor(entry) {
        const role = String(entry.userRole || '').toLowerCase();
        const user = String(entry.user || '').toLowerCase();
        const currentEmployeeId = String(state.settings.employeeId || '').toLowerCase();
        const currentOrganizationId = String(state.settings.organizationId || '').toLowerCase();
        const currentName = String(state.settings.officerName || '').toLowerCase();
        const entryEmployeeId = String(entry.userEmployeeId || entry.employeeId || '').toLowerCase();
        const entryOrganizationId = String(entry.organizationId || '').toLowerCase();

        if (entryOrganizationId && currentOrganizationId && entryOrganizationId !== currentOrganizationId) return false;
        if (entryEmployeeId) return entryEmployeeId === currentEmployeeId;

        const hasFinanceRole = role.includes('finance') || user === 'finance officer' || user === currentName;
        if (!hasFinanceRole) return false;
        return !user || user === 'finance officer' || user === currentName;
      }

      function getFinanceActivityUser(entry) {
        const user = String(entry.user || '').trim();
        if (!user || user.toLowerCase() === 'finance officer') {
          return state.settings.officerName || 'Finance Officer';
        }
        return user;
      }

      function formatAuditActivityTime(entry) {
        if (entry.timestamp && window.FinStackStore && window.FinStackStore.formatTimeAgo) {
          return window.FinStackStore.formatTimeAgo(entry.timestamp);
        }
        if (entry.timestamp) {
          return new Date(entry.timestamp).toLocaleString();
        }
        return entry.time || 'Just now';
      }

      function toFinanceActivity(entry) {
        const classified = classifyFinanceActivity(entry.action);
        if (!classified || !isFinanceActor(entry)) return null;
        const entityId = extractFinanceEntityId(entry);
        if (!entityId) return null;
        const displayUser = getFinanceActivityUser(entry);
        return {
          key: classified.key + '|' + entityId,
          initials: initials(displayUser),
          user: displayUser,
          action: classified.label,
          entity: entityId,
          time: formatAuditActivityTime(entry),
          timestamp: entry.timestamp || new Date().toISOString()
        };
      }

      function buildFinanceActivities(auditLogs) {
        const seen = new Set();
        return (auditLogs || [])
          .map(toFinanceActivity)
          .filter(Boolean)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .filter(item => {
            if (seen.has(item.key)) return false;
            seen.add(item.key);
            return true;
          })
          .slice(0, 10);
      }

      function buildSharedAlerts(reviewQueue, flaggedQueue, payments) {
        const alerts = [];
        if (flaggedQueue.length) {
          alerts.push({
            tone: 'red',
            title: 'Flagged expenses in compliance',
            text: `${flaggedQueue.length} expense${flaggedQueue.length === 1 ? '' : 's'} currently need compliance attention.`,
            time: 'Live',
            unread: true
          });
        }
        if (reviewQueue.length) {
          alerts.push({
            tone: 'yellow',
            title: 'Pending finance approvals',
            text: `${reviewQueue.length} expense${reviewQueue.length === 1 ? '' : 's'} are waiting in the finance review queue.`,
            time: 'Live',
            unread: true
          });
        }
        const releasable = payments.filter(batch => batch.status === 'pending');
        if (releasable.length) {
          alerts.push({
            tone: 'cyan',
            title: 'Payment batch ready',
            text: `${releasable[0].id} is available for payment release.`,
            time: 'Live',
            unread: true
          });
        }
        return alerts;
      }

      function buildSharedTransactions(transactions, expenses) {
        const expenseById = new Map((expenses || []).map(expense => [expense.id, expense]));
        return (transactions || [])
          .filter(transaction => expenseById.has(transaction.expenseId))
          .map(transaction => {
            const expense = expenseById.get(transaction.expenseId) || {};
            return {
              id: transaction.id,
              expenseId: transaction.expenseId,
              employeeId: transaction.employeeId,
              employee: expense.employee || transaction.employeeId || '-',
              category: expense.category || transaction.categoryId || '-',
              bank: 'Bank Sandbox',
              amount: Number(transaction.amount || 0),
              date: (transaction.processedAt || transaction.transactionDate || transaction.createdAt || '').slice(0, 10),
              status: transaction.status || 'pending',
              processedAt: transaction.processedAt || '',
              transactionDate: transaction.transactionDate || '',
              merchant: transaction.merchant || expense.merchant || '',
              paymentMethod: transaction.paymentMethod || expense.paymentMethod || '',
              workflowStatus: expense.workflowStatus || ''
            };
          });
      }

      function buildSharedReconciliation(transactions, expenses) {
        const expenseById = new Map((expenses || []).map(expense => [expense.id, expense]));
        return (transactions || [])
          .filter(transaction => transaction.status === 'processed' || transaction.status === 'reconciled')
          .filter(transaction => expenseById.has(transaction.expenseId))
          .map(transaction => ({
            id: transaction.id,
            transactionId: transaction.id,
            expense: transaction.expenseId,
            bankRef: transaction.id,
            amount: Number(transaction.amount || 0),
            variance: 0,
            status: transaction.status === 'reconciled' ? 'matched' : 'ready',
            transactionStatus: transaction.status
          }));
      }

      function syncSharedFinanceState() {
        if (!window.FinStackStore) return;
        const financeUser = window.FinStackStore.getCurrentUser() || {};
        const organizationId = financeUser.organizationId || state.settings.organizationId || '';
        const users = typeof window.FinStackStore.getUsers === 'function' ? window.FinStackStore.getUsers() : [];
        const organizationEmployeeIds = new Set(users
          .filter(user => !organizationId || user.organizationId === organizationId)
          .map(user => user.employeeId));
        const allExpenses = uniqueById(window.FinStackStore.getExpenses())
          .filter(expense => recordBelongsToOrganization(expense, organizationId, organizationEmployeeIds));
        console.log("Current User:", financeUser);
        console.log("Expenses:", allExpenses);
        const financeReviewExpenses = allExpenses.filter(e =>
          e.workflowStatus === "finance_review" &&
          e.assignedFinanceOfficerId === financeUser.id
        );
        const expenseIds = new Set(financeReviewExpenses.map(expense => expense.id));
        const reviewQueue = window.FinStackStore.getFinanceReviewQueue()
          .filter(expense =>
            expenseIds.has(expense.id) &&
            expense.workflowStatus === "finance_review" &&
            expense.assignedFinanceOfficerId === financeUser.id
          );
        const flaggedQueue = window.FinStackStore.getFinanceFlaggedQueue()
          .filter(expense => expenseIds.has(expense.id));
        const payments = scopePaymentBatchesToExpenses(window.FinStackStore.getPaymentBatches(), allExpenses);
        const auditLogs = window.FinStackStore.getAuditLogs();

        state.settings.officerName = financeUser.fullName || state.settings.officerName;
        state.settings.officerEmail = financeUser.email || state.settings.officerEmail;
        state.settings.department = financeUser.department || state.settings.department;
        state.settings.employeeId = financeUser.employeeId || state.settings.employeeId;
        state.settings.phone = financeUser.phone || state.settings.phone;
        state.settings.location = financeUser.location || state.settings.location;
        state.settings.organizationId = financeUser.organizationId || state.settings.organizationId;
        state.settings.managerEmployeeId = financeUser.managerEmployeeId || state.settings.managerEmployeeId;
        state.policyCount = window.FinStackStore.getPolicies()
          .filter(isConfigurationManagerPolicy)
          .length;

        state.expenses = financeReviewExpenses.map(expense => ({
          id: expense.id,
          employeeId: expense.employeeId,
          organizationId: expense.organizationId || organizationId,
          assignedFinanceOfficerId: expense.assignedFinanceOfficerId || null,
          employee: expense.employee,
          category: expense.category,
          amount: Number(expense.amount || 0),
          status: mapFinanceStatus(expense),
          method: mapPaymentMethod(expense.paymentMethod),
          paymentMethod: expense.paymentMethod,
          merchant: expense.merchant || '',
          submitted: (expense.date || expense.created || '').slice(0, 10),
          date: expense.date || '',
          notes: expense.notes || '',
          receiptFileName: expense.receiptFileName || '',
          workflowStatus: expense.workflowStatus,
          riskScore: expense.risk_score || 0,
          flag: expense.flag || 'none',
          managerDecision: expense.managerDecision || '',
          managerDecisionNote: expense.managerDecisionNote || '',
          complianceDecision: expense.complianceDecision || '',
          complianceDecisionNote: expense.complianceDecisionNote || '',
          financeDecision: expense.financeDecision || '',
          financeDecisionNote: expense.financeDecisionNote || '',
          created: expense.created || '',
          updatedAt: expense.updatedAt || ''
        }));

        state.reviews = reviewQueue.map(expense => ({
          id: expense.id,
          by: (users.find(user => user.employeeId === expense.employeeId) || {}).fullName || expense.employeeId || expense.employee || '-',
          amount: Number(expense.amount || 0),
          manager: expense.complianceDecision ? `Compliance ${expense.complianceDecision}` : (expense.managerDecision || 'Approved'),
          note: expense.complianceDecisionNote || expense.managerDecisionNote || 'Awaiting finance review'
        }));

        state.flagged = flaggedQueue.map(expense => ({
          id: expense.id,
          reason: expense.financeDecisionNote || expense.notes || 'Flagged for compliance review',
          risk: expense.risk_score >= 70 ? 'High' : expense.risk_score >= 40 ? 'Medium' : 'Low',
          tone: 'flagged'
        }));

        state.payments = payments
          .filter(batch => batch.status !== 'paid')
          .map(batch => ({
            id: batch.id,
            expenseIds: batch.expenseIds,
            count: batch.count,
            total: Number(batch.total || 0),
            status: batch.status,
            scheduled: batch.scheduled
          }));

        const backendTransactions = typeof window.FinStackStore.getTransactions === 'function' ? window.FinStackStore.getTransactions() : [];
        state.transactions = buildSharedTransactions(backendTransactions, allExpenses);
        state.reconciliation = buildSharedReconciliation(backendTransactions, allExpenses);

        state.activities = buildFinanceActivities(auditLogs);

        state.audit = auditLogs.slice(0, 10).map(entry => ({
          time: entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : 'Now',
          user: entry.user || 'System',
          action: entry.action,
          entity: `${entry.entityType || 'Record'} • ${entry.entityName || ''}`.trim()
        }));

        state.alerts = buildSharedAlerts(reviewQueue, flaggedQueue, state.payments);
        state.lastReconciliationRun = state.reconciliation.length ? `Last synced at ${nowLabel()}` : 'No reconciliation candidates';
      }

      const pages = [...document.querySelectorAll('.page')];
      const navButtons = [...document.querySelectorAll('.nav-btn')];
      const toast = document.getElementById('toast');
      const modal = document.getElementById('mainModal');
      const modalBackdrop = document.getElementById('modalBackdrop');
      const modalTitle = document.getElementById('modalTitle');
      const modalSubtitle = document.getElementById('modalSubtitle');
      const modalIcon = document.getElementById('modalIcon');
      const modalBody = document.getElementById('modalBody');
      const modalFooter = document.getElementById('modalFooter');
      const drawerBackdrop = document.getElementById('drawerBackdrop');
      const notificationDrawer = document.getElementById('notificationDrawer');
      const profileDrawer = document.getElementById('profileDrawer');
      const appRoot = document.querySelector('.app');
      const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
      const sidebarExpandBtn = document.getElementById('sidebarExpandBtn');
      const logoText = document.querySelector('.logo-text');
      const shellIcons = {
        panelLeftClose: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M9 3v18"></path><path d="m16 15-3-3 3-3"></path></svg>',
        panelLeftOpen: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M9 3v18"></path><path d="m13 9 3 3-3 3"></path></svg>',
        chevronDown: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>',
        dashboard: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="7" height="9" x="3" y="3" rx="1"></rect><rect width="7" height="5" x="14" y="3" rx="1"></rect><rect width="7" height="9" x="14" y="12" rx="1"></rect><rect width="7" height="5" x="3" y="16" rx="1"></rect></svg>',
        financeReview: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><path d="m9 15 2 2 4-4"></path></svg>',
        reconciliation: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 7 4-4 4 4"></path><path d="M7 3v11"></path><path d="m21 17-4 4-4-4"></path><path d="M17 21V10"></path><path d="M10 7h11"></path><path d="M3 17h11"></path></svg>',
        transactions: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5h18"></path><path d="M3 12h18"></path><path d="M3 19h18"></path></svg>',
        flagged: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>',
        payments: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"></path><path d="M16 12h.01"></path><path d="M4 7V5a2 2 0 0 1 2-2h12"></path></svg>',
        reports: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"></path><path d="M18 17V9"></path><path d="M13 17V5"></path><path d="M8 17v-3"></path></svg>',
        notifications: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>',
        audit: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8"></path><path d="M12 17v4"></path><path d="M7 3h10a2 2 0 0 1 2 2v10a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V5a2 2 0 0 1 2-2z"></path><path d="M9 7h6"></path><path d="M9 11h6"></path><path d="M9 15h4"></path></svg>',
        settings: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
        logout: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="m16 17 5-5-5-5"></path><path d="M21 12H9"></path></svg>'
      };

      function syncFinanceShellIcons() {
        const collapsed = appRoot.classList.contains('sidebar-collapsed');
        if (logoText) {
          logoText.textContent = 'FinStack';
        }
        if (sidebarToggleBtn) {
          sidebarToggleBtn.innerHTML = collapsed ? shellIcons.panelLeftOpen : shellIcons.panelLeftClose;
          sidebarToggleBtn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
          sidebarToggleBtn.setAttribute('title', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
          sidebarToggleBtn.setAttribute('aria-expanded', String(!collapsed));
        }
        if (sidebarExpandBtn) {
          sidebarExpandBtn.innerHTML = shellIcons.panelLeftOpen;
          sidebarExpandBtn.setAttribute('aria-label', 'Expand sidebar');
          sidebarExpandBtn.setAttribute('title', 'Expand sidebar');
          sidebarExpandBtn.setAttribute('aria-hidden', 'true');
        }
        const iconMap = {
          'dashboard-page': shellIcons.dashboard,
          'finance-review-page': shellIcons.financeReview,
          'reconciliation-page': shellIcons.reconciliation,
          'transactions-page': shellIcons.transactions,
          'flagged-page': shellIcons.flagged,
          'payments-page': shellIcons.payments,
          'reports-page': shellIcons.reports,
          'notifications-page': shellIcons.notifications,
          'settings-page': shellIcons.settings
        };
        navButtons.forEach(btn => {
          const iconSlot = btn.querySelector('.nav-icon');
          const label = btn.querySelector('span:not(.nav-icon)');
          if (iconSlot && iconMap[btn.dataset.target]) {
            iconSlot.innerHTML = iconMap[btn.dataset.target];
          }
          if (label) {
            btn.setAttribute('title', label.textContent.trim());
            btn.setAttribute('aria-label', label.textContent.trim());
          }
        });
        const logoutBtnEl = document.getElementById('logoutBtn');
        const logoutIcon = logoutBtnEl ? logoutBtnEl.querySelector('.nav-icon') : null;
        const logoutLabel = logoutBtnEl ? logoutBtnEl.querySelector('span:not(.nav-icon)') : null;
        if (logoutIcon) logoutIcon.innerHTML = shellIcons.logout;
        if (logoutBtnEl && logoutLabel) {
          logoutBtnEl.setAttribute('title', logoutLabel.textContent.trim());
          logoutBtnEl.setAttribute('aria-label', logoutLabel.textContent.trim());
        }
        const topChevron = document.querySelector('#userMenuBtn .muted');
        if (topChevron) topChevron.innerHTML = shellIcons.chevronDown;
      }

      function setSidebarCollapsed(collapsed) {
        appRoot.classList.toggle('sidebar-collapsed', collapsed);
        localStorage.setItem('finstackSidebarCollapsed', collapsed ? '1' : '0');
        syncFinanceShellIcons();
      }
      function getFinanceNotifications() {
        if (!window.FinStackStore || typeof window.FinStackStore.getNotifications !== 'function') return [];
        try {
          return window.FinStackStore.getNotifications();
        } catch (e) {
          return [];
        }
      }
      function unreadFinanceAlerts() {
        return getFinanceNotifications().filter(alert => alert.unread !== false).length;
      }
      function ensureFinanceNotificationDropdown() {
        const notificationBtn = document.getElementById('notificationBtn');
        if (!notificationBtn) return null;
        notificationBtn.classList.add('notif-btn');
        let anchor = notificationBtn.parentElement;
        if (!anchor || !anchor.classList.contains('notif-anchor')) {
          anchor = document.createElement('div');
          anchor.className = 'notif-anchor';
          notificationBtn.parentNode.insertBefore(anchor, notificationBtn);
          anchor.appendChild(notificationBtn);
        }
        let dropdown = document.getElementById('foNotifDropdown');
        if (dropdown) return dropdown;
        dropdown = document.createElement('div');
        dropdown.className = 'notif-dropdown';
        dropdown.id = 'foNotifDropdown';
        anchor.appendChild(dropdown);
        return dropdown;
      }
      function financeAlertGlyph(tone) {
        if (tone === 'red') return '!';
        if (tone === 'yellow') return '!';
        return 'i';
      }
      function financeNotificationTone(notification) {
        const text = `${notification.title || ''} ${notification.message || ''}`.toLowerCase();
        if (text.includes('reject') || notification.type === 'danger') return 'red';
        if (notification.type === 'warning') return 'yellow';
        if (notification.type === 'success') return 'green';
        return 'cyan';
      }
      function syncFinanceNotificationDot() {
        const notificationBtn = document.getElementById('notificationBtn');
        if (!notificationBtn) return;
        let dot = notificationBtn.querySelector('.dot');
        const unreadCount = unreadFinanceAlerts();
        if (!dot && unreadCount) {
          dot = document.createElement('span');
          dot.className = 'dot';
          notificationBtn.appendChild(dot);
        }
        if (dot) {
          dot.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
          dot.style.display = unreadCount ? 'flex' : 'none';
        }
      }
      function buildFinanceNotificationDropdownHTML() {
        const unreadCount = unreadFinanceAlerts();
        const notifications = getFinanceNotifications();
        const markAllButton = `<button class="notif-mark-read" id="markAllFinanceNotifs" type="button"${unreadCount ? '' : ' disabled'}>Mark all as read</button>`;
        const items = notifications.slice(0, 5).map((alert) => {
          const tone = financeNotificationTone(alert);
          return `
          <div class="notif-item ${alert.unread !== false ? 'unread' : ''}${tone === 'red' ? ' priority-high' : ''}" data-notif-id="${escapeHtml(alert.id || '')}">
            <div class="notif-item-icon ${escapeHtml(tone)}"><span>${financeAlertGlyph(tone)}</span></div>
            <div class="notif-item-body">
              <div class="notif-item-title">
                <span>${escapeHtml(alert.title)}</span>
                ${alert.unread !== false ? '<span class="notif-unread-dot"></span>' : ''}
              </div>
              <div class="notif-item-desc">${escapeHtml(alert.message || '')}</div>
              <div class="notif-item-time">${escapeHtml(alert.time || 'Recently')}</div>
            </div>
          </div>
        `;
        }).join('') || `<div class="notif-dropdown-empty">No notifications</div>`;
        return `
          <div class="notif-dropdown-header">
            <div>
              <h3>Notifications</h3>
              <p>${unreadCount} unread</p>
            </div>
            ${markAllButton}
          </div>
          <div class="notif-list">${items}</div>
          <div class="notif-dropdown-footer">
            <button class="notif-view-all" id="viewAllFinanceNotifs" type="button">View All Notifications</button>
          </div>
        `;
      }
      function bindFinanceNotificationDropdownEvents(dropdown, closeFinanceNotifMenu) {
        const markAllBtn = dropdown.querySelector('#markAllFinanceNotifs');
        if (markAllBtn) {
          markAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.FinStackStore) window.FinStackStore.markAllNotificationsRead();
            refreshFinanceNotificationDropdown(closeFinanceNotifMenu);
            renderNotificationsPage();
            showToast('All notifications marked as read.');
          });
        }
        const viewAllBtn = dropdown.querySelector('#viewAllFinanceNotifs');
        if (viewAllBtn) {
          viewAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeFinanceNotifMenu();
            setPage('notifications-page');
          });
        }
        dropdown.querySelectorAll('.notif-item[data-notif-id]').forEach(item => {
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = item.dataset.notifId;
            if (id && window.FinStackStore) window.FinStackStore.markNotificationRead(id);
            refreshFinanceNotificationDropdown(closeFinanceNotifMenu);
            renderNotificationsPage();
          });
        });
      }
      function refreshFinanceNotificationDropdown(closeFinanceNotifMenu = () => {}) {
        const dropdown = ensureFinanceNotificationDropdown();
        if (!dropdown) return;
        dropdown.innerHTML = buildFinanceNotificationDropdownHTML();
        bindFinanceNotificationDropdownEvents(dropdown, closeFinanceNotifMenu);
        syncFinanceNotificationDot();
      }
      function ensureFinanceProfileDropdown() {
        const userMenuEl = document.getElementById('userMenuBtn');
        if (!userMenuEl) return null;
        let dropdown = document.getElementById('foProfileDropdown');
        if (dropdown) return dropdown;
        dropdown = document.createElement('div');
        dropdown.className = 'profile-dropdown';
        dropdown.id = 'foProfileDropdown';
        dropdown.innerHTML = `
          <div class="profile-dropdown-header">
            <div class="pd-name" id="foDropdownName">Rajesh Kumar</div>
            <div class="pd-email" id="foDropdownRole">Finance Officer</div>
          </div>
          <div class="profile-dropdown-menu">
            <button class="pd-item" data-action="profile-settings" type="button">Profile Settings</button>
            <button class="pd-item" data-action="preferences" type="button">Preferences</button>
            <div class="pd-divider"></div>
            <button class="pd-item danger" data-action="logout" type="button">Logout</button>
          </div>
        `;
        userMenuEl.appendChild(dropdown);
        return dropdown;
      }
      function syncSettingsProfile() {
        const name = state.settings.officerName || 'Rajesh Kumar';
        const email = state.settings.officerEmail || 'rajesh.kumar@finstack.io';
        const initialsText = initials(name);
        const roleText = 'Finance Officer';
        let lastLogin = 'Current session';
        try {
          const session = JSON.parse(sessionStorage.getItem('finstackUserSession') || 'null');
          if (session && session.loginAt) lastLogin = new Date(session.loginAt).toLocaleString();
        } catch (error) {}
        const dropdownName = document.getElementById('foDropdownName');
        const dropdownRole = document.getElementById('foDropdownRole');
        document.getElementById('userNameTop').textContent = name;
        document.getElementById('userEmailTop').textContent = roleText;
        document.getElementById('userAvatar').textContent = initialsText;
        document.getElementById('settingsAvatarLarge').textContent = initialsText;
        document.getElementById('profileName').textContent = name;
        document.getElementById('profileEmail').textContent = roleText + ' • ' + (state.settings.department || 'Finance Operations');
        const employeeCard = document.getElementById('settingsEmployeeIdCard');
        const organizationCard = document.getElementById('settingsOrganizationIdCard');
        const managerCard = document.getElementById('settingsManagerIdCard');
        const lastLoginCard = document.getElementById('settingsLastLoginCard');
        if (employeeCard) employeeCard.textContent = state.settings.employeeId || '-';
        if (organizationCard) organizationCard.textContent = state.settings.organizationId || '-';
        if (managerCard) managerCard.textContent = state.settings.managerEmployeeId || 'Not assigned';
        if (lastLoginCard) lastLoginCard.textContent = lastLogin;
        if (dropdownName) dropdownName.textContent = name;
        if (dropdownRole) dropdownRole.textContent = roleText;
      }

      function formatINR(value) { return '₹' + Number(value).toLocaleString('en-IN'); }
      function escapeHtml(str) { return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
      function capitalize(v) { return String(v).charAt(0).toUpperCase() + String(v).slice(1); }
      function formatExpenseId(id) { return 'EXP-' + String(id || '').slice(0, 6); }
      function getEmployeeDisplay(expense) {
        const users = window.FinStackStore && typeof window.FinStackStore.getUsers === 'function' ? window.FinStackStore.getUsers() : [];
        const userMap = {};
        users.forEach(user => { userMap[user.employeeId] = user.fullName; });
        return userMap[expense.employeeId] || expense.employeeId || expense.employee || '-';
      }
      function readableStatus(value) {
        return String(value || '').split(/[_\s-]+/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
      }
      function initials(name) { return String(name).split(' ').map(p => p[0] || '').join('').slice(0,2).toUpperCase(); }
      function nowLabel() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
      function downloadText(filename, content) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      }
      function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(window.__toastTimer);
        window.__toastTimer = setTimeout(() => toast.classList.remove('show'), 2300);
      }
      function setPage(targetId) {
        pages.forEach(p => p.classList.remove('active'));
        navButtons.forEach(b => b.classList.remove('active'));
        const page = document.getElementById(targetId);
        if (page) page.classList.add('active');
        const btn = document.querySelector(`.nav-btn[data-target="${targetId}"]`);
        if (btn) btn.classList.add('active');
        const pageLabel = btn ? btn.textContent.trim() : 'FinStack Workspace';
        document.getElementById('workspaceTitle').textContent = 'FinStack Workspace';
        closeDrawers();
      }
      function logActivity(user, action, entity) {
        const activity = toFinanceActivity({
          user,
          userEmployeeId: state.settings.employeeId,
          organizationId: state.settings.organizationId,
          userRole: user === 'Finance Officer' ? 'Finance Officer' : '',
          action,
          entity,
          timestamp: new Date().toISOString()
        });
        if (activity && !state.activities.some(item => item.key === activity.key)) {
          state.activities.unshift(activity);
          state.activities = state.activities.slice(0, 10);
        }
        state.audit.unshift({ time: nowLabel(), user, action, entity });
        renderActivities(); renderAudit(); updateMetrics();
      }

      function openDrawer(which) {
        drawerBackdrop.classList.add('show');
        [notificationDrawer, profileDrawer].forEach(d => d.classList.remove('show'));
        which.classList.add('show');
      }
      function closeDrawers() {
        drawerBackdrop.classList.remove('show');
        [notificationDrawer, profileDrawer].forEach(d => d.classList.remove('show'));
      }
      function openModal(config) {
        modalTitle.textContent = config.title || 'Details';
        modalSubtitle.textContent = config.subtitle || 'Workspace detail';
        modalIcon.textContent = config.icon || '◫';
        modalBody.innerHTML = config.body || '';
        modalFooter.innerHTML = '';
        (config.actions || []).forEach(action => {
          const btn = document.createElement('button');
          btn.className = `mini-btn ${action.variant || 'btn-outline'}`;
          btn.textContent = action.label;
          btn.addEventListener('click', action.onClick);
          modalFooter.appendChild(btn);
        });
        if (!(config.actions || []).length) {
          const close = document.createElement('button');
          close.className = 'mini-btn btn-primary';
          close.textContent = 'Close';
          close.addEventListener('click', closeModal);
          modalFooter.appendChild(close);
        }
        modalBackdrop.classList.add('show');
        modal.classList.add('show');
      }
      function closeModal() {
        modalBackdrop.classList.remove('show');
        modal.classList.remove('show');
      }

      function updateMetrics() {
        const reviewedExpenses = state.expenses.filter(isFinanceReviewedExpense);
        document.getElementById('metricTotalExpenses').textContent = String(reviewedExpenses.length);
        document.getElementById('metricExpenseAmount').textContent = `${formatINR(reviewedExpenses.reduce((sum, e) => sum + e.amount, 0))} reviewed by finance`;
        document.getElementById('metricActiveReviews').textContent = String(state.reviews.length);
        document.getElementById('metricCategories').textContent = String(new Set(state.expenses.map(e => e.category)).size);
        document.getElementById('metricPolicies').textContent = String(state.policyCount);
        document.getElementById('matchedItems').textContent = String(state.reconciliation.filter(r => r.status === 'matched').length);
        document.getElementById('mismatchItems').textContent = String(state.reconciliation.filter(r => r.status === 'mismatch').length);
        document.getElementById('reconciliationStatus').textContent = state.lastReconciliationRun;
        document.getElementById('autoMatchStatus').textContent = state.autoMatch ? 'Enabled' : 'Disabled';
        const roleText = 'Finance Officer';
        const dropdownName = document.getElementById('foDropdownName');
        const dropdownRole = document.getElementById('foDropdownRole');
        document.getElementById('workspaceTitle').textContent = 'FinStack Workspace';
        document.getElementById('userNameTop').textContent = state.settings.officerName;
        document.getElementById('userEmailTop').textContent = roleText;
        document.getElementById('profileName').textContent = state.settings.officerName;
        document.getElementById('profileEmail').textContent = roleText + ' • ' + (state.settings.department || 'Finance Operations');
        document.getElementById('userAvatar').textContent = initials(state.settings.officerName);
        if (dropdownName) dropdownName.textContent = state.settings.officerName;
        if (dropdownRole) dropdownRole.textContent = roleText;
      }

      function renderActivities() {
        const body = document.getElementById('activityTableBody');
        body.innerHTML = state.activities.map((item, index) => `
          <tr>
            <td><div class="table-user"><div class="mini-avatar">${escapeHtml(item.initials)}</div><span>${escapeHtml(item.user)}</span></div></td>
            <td>${escapeHtml(item.action)}</td>
            <td class="muted">${escapeHtml(item.entity)}</td>
            <td class="time-cell muted">${escapeHtml(item.time)}</td>
            <td><button class="table-btn view" onclick="openActivity(${index})">Open</button></td>
          </tr>
        `).join('') || `<tr><td colspan="5" class="empty-row">No recent finance activity yet.</td></tr>`;
      }

      function renderAlerts() {
        const wrap = document.getElementById('alertList');
        wrap.innerHTML = state.alerts.map((a, i) => `
          <div class="alert-card ${escapeHtml(a.tone)}">
            <h4>${escapeHtml(a.title)}</h4>
            <p>${escapeHtml(a.text)}</p>
            <div class="muted" style="margin-bottom:12px;">${escapeHtml(a.time)}</div>
            <div class="inline-actions">
              <button class="table-btn view" onclick="resolveAlert(${i})">Open</button>
              <button class="table-btn review" onclick="dismissAlert(${i})">Dismiss</button>
            </div>
          </div>
        `).join('') || `<div class="muted">No active alerts.</div>`;

        const drawerBody = document.getElementById('notificationDrawerBody');
        if (drawerBody) {
          drawerBody.innerHTML = state.alerts.map((a, i) => `
            <div class="drawer-card">
              <h4>${escapeHtml(a.title)}</h4>
              <p>${escapeHtml(a.text)}</p>
              <div class="inline-actions"><button class="table-btn view" onclick="resolveAlert(${i})">Open</button><button class="table-btn review" onclick="dismissAlert(${i})">Dismiss</button></div>
            </div>
          `).join('') || `<div class="drawer-card"><h4>No notifications</h4><p>You're all caught up.</p></div>`;
        }
        refreshFinanceNotificationDropdown();
        renderNotificationsPage();
      }

      function renderNotificationsPage() {
        const container = document.getElementById('foNotificationsContainer');
        const badge = document.getElementById('foUnreadCountBadge');
        if (!container) return;
        const notifications = getFinanceNotifications();
        const unreadCount = notifications.filter(a => a.unread !== false).length;

        // Update badge
        if (badge) {
          if (unreadCount > 0) {
            badge.textContent = unreadCount + ' unread';
            badge.style.display = '';
          } else {
            badge.style.display = 'none';
          }
        }

        if (!notifications.length) {
          container.innerHTML = '<div style="padding:48px;text-align:center;color:var(--text-muted,#6b7280);font-size:0.9rem;">No notifications. You\'re all caught up!</div>';
          return;
        }

        container.innerHTML = notifications.map((a) => {
          const isUnread = a.unread !== false;
          const tone = financeNotificationTone(a);
          const toneColors = { red: '#ef4444', yellow: '#f59e0b', cyan: '#22d3ee', green: '#22c55e' };
          const toneColor = toneColors[tone] || '#8B5CF6';
          return `
            <div data-fo-notif-id="${escapeHtml(a.id || '')}" style="display:flex;align-items:flex-start;gap:16px;padding:20px 24px;border-bottom:1px solid rgba(31,41,55,0.5);cursor:pointer;${isUnread ? 'background:rgba(124,58,237,0.04);' : ''}" onclick="markFinanceNotificationRead('${escapeHtml(a.id || '')}')">
              <div style="width:10px;height:10px;border-radius:50%;background:${isUnread ? toneColor : 'transparent'};flex-shrink:0;margin-top:6px;"></div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:0.9375rem;font-weight:${isUnread ? '600' : '500'};color:${isUnread ? '#f1f5f9' : '#9ca3af'};margin-bottom:4px;">${escapeHtml(a.title)}</div>
                <div style="font-size:0.8125rem;color:#9ca3af;margin-bottom:6px;">${escapeHtml(a.message || '')}</div>
                <div style="font-size:0.75rem;color:#6b7280;">${escapeHtml(a.time || 'Recently')} • ${isUnread ? 'Unread' : 'Read'}</div>
              </div>
              <div class="inline-actions" style="flex-shrink:0;">
                <button class="table-btn view" onclick="event.stopPropagation();markFinanceNotificationRead('${escapeHtml(a.id || '')}')">Mark Read</button>
                <button class="table-btn review" onclick="event.stopPropagation();deleteFinanceNotification('${escapeHtml(a.id || '')}')">Dismiss</button>
              </div>
            </div>`;
        }).join('');
      }

      function renderExpenses(data = state.expenses) {
        const body = document.getElementById('expenseTableBody');
        if (!body) return;
        body.innerHTML = data.map((expense) => `
          <tr>
            <td>${escapeHtml(formatExpenseId(expense.id))}</td>
            <td>${escapeHtml(getEmployeeDisplay(expense))}</td>
            <td>${escapeHtml(expense.category)}</td>
            <td>${formatINR(expense.amount)}</td>
            <td><span class="status ${expense.status}">${escapeHtml(readableStatus(expense.workflowStatus || expense.status))}</span></td>
            <td>
              <div class="inline-actions">
                <button class="table-btn view" onclick="viewExpense('${expense.id}')">View</button>
                <button class="table-btn review" onclick="reviewExpense('${expense.id}')">Review</button>
              </div>
            </td>
          </tr>
        `).join('') || `<tr><td colspan="6" class="empty-row">No expenses found.</td></tr>`;
      }

      function renderReviews() {
        const body = document.getElementById('reviewTableBody');
        body.innerHTML = state.reviews.map(item => `
          <tr>
            <td>${escapeHtml(formatExpenseId(item.id))}</td>
            <td>${escapeHtml(item.by)}</td>
            <td>${formatINR(item.amount)}</td>
            <td>${escapeHtml(item.manager)}</td>
            <td>
              <div class="inline-actions">
                <button class="table-btn approve" onclick="approveReview('${item.id}')">Approve</button>
                <button class="table-btn reject" onclick="rejectReview('${item.id}')">Reject</button>
                <button class="table-btn escalate" onclick="flagReview('${item.id}')">Flag</button>
                <button class="table-btn view" onclick="requestInfo('${item.id}')">Request Info</button>
              </div>
            </td>
          </tr>
        `).join('') || `<tr><td colspan="5" class="empty-row">No items in review queue.</td></tr>`;
      }

      function renderReconciliation() {
        const list = document.getElementById('reconciliationList');
        list.innerHTML = state.reconciliation.map(item => `
          <div class="kv">
            <div>
              <div style="font-weight:800; color:white; margin-bottom:6px;">${escapeHtml(item.id)}</div>
              <div class="muted">${escapeHtml(item.expense)} ↔ ${escapeHtml(item.bankRef)}</div>
              <div class="muted">${item.status === 'matched' ? 'Matched / Reconciled' : 'Ready to Reconcile'}</div>
              <div class="muted">Variance: ${formatINR(item.variance)}</div>
            </div>
            <div class="inline-actions">
              ${item.status === 'ready' ? `<button class="table-btn review" onclick="matchReconciliation('${item.id}')">Reconcile</button>` : `<button class="table-btn view" disabled>Reconciled</button>`}
              <button class="table-btn review" onclick="investigateMismatch('${item.id}')">Investigate</button>
            </div>
          </div>
        `).join('') || `<div class="muted">No pending matches.</div>`;
      }

      function renderTransactions() {
        const body = document.getElementById('transactionTableBody');
        body.innerHTML = state.transactions.map(txn => `
          <tr>
            <td>${escapeHtml(txn.id)}</td>
            <td>${escapeHtml(txn.bank)}</td>
            <td>${formatINR(txn.amount)}</td>
            <td>${escapeHtml(txn.date)}</td>
            <td><span class="status ${txn.status}">${capitalize(txn.status)}</span></td>
            <td><div class="inline-actions">${transactionActions(txn)}</div></td>
          </tr>
        `).join('') || `<tr><td colspan="6" class="empty-row">No transactions available.</td></tr>`;
      }

      function transactionActions(txn) {
        const open = `<button class="table-btn view" onclick="viewTransaction('${txn.id}')">Open</button>`;
        if (txn.status === 'pending') {
          return `${open}<button class="table-btn approve" onclick="simulateBankSuccess('${txn.id}')">Test: Simulate Success</button><button class="table-btn reject" onclick="simulateBankFailure('${txn.id}')">Test: Simulate Failure</button>`;
        }
        if (txn.status === 'processed') {
          return `${open}<button class="table-btn review" onclick="reconcileTransaction('${txn.id}')">Reconcile</button>`;
        }
        if (txn.status === 'reconciled') {
          return `${open}<button class="table-btn view" disabled>Completed</button>`;
        }
        return open;
      }

      function renderFlagged() {
        const body = document.getElementById('flaggedTableBody');
        body.innerHTML = state.flagged.map(item => `
          <tr>
            <td>${escapeHtml(item.id)}</td>
            <td>${escapeHtml(item.reason)}</td>
            <td><span class="status ${item.tone}">${escapeHtml(item.risk)}</span></td>
            <td><div class="inline-actions"><button class="table-btn view" onclick="viewFlagged('${item.id}')">View</button><button class="table-btn escalate" onclick="escalateFlagged('${item.id}')">Escalate</button></div></td>
          </tr>
        `).join('') || `<tr><td colspan="4" class="empty-row">No flagged expenses.</td></tr>`;
      }

      function renderPayments() {
        const body = document.getElementById('paymentTableBody');
        body.innerHTML = state.payments.map(item => `
          <tr>
            <td>${escapeHtml(item.id)}</td>
            <td>${item.count}</td>
            <td>${formatINR(item.total)}</td>
            <td><span class="status ${item.status === 'processing' ? 'processed' : item.status === 'paid' ? 'paid' : 'pending'}">${item.status === 'processing' ? 'Processing / Sent to Bank' : capitalize(item.status)}</span></td>
            <td><div class="inline-actions">${item.status === 'pending' ? `<button class="table-btn approve" onclick="releasePayment('${item.id}')">Release Payment</button>` : `<button class="table-btn view" disabled>Sent to Bank</button>`}<button class="table-btn view" onclick="viewPayment('${item.id}')">View</button></div></td>
          </tr>
        `).join('') || `<tr><td colspan="5" class="empty-row">No payment batches.</td></tr>`;
      }

      function getFilteredReports() {
        const view = state.reportView;
        let reports = [...state.reports];
        if (view.search) {
          const q = view.search.toLowerCase();
          reports = reports.filter(report => [report.title, report.description, report.owner, report.type].join(' ').toLowerCase().includes(q));
        }
        if (view.type !== 'all') reports = reports.filter(report => report.type === view.type);
        if (view.chip === 'pinned') reports = reports.filter(report => report.pinned);
        if (view.chip === 'scheduled') reports = reports.filter(report => report.scheduled);
        if (view.chip === 'generated') reports = reports.filter(report => report.generatedToday);
        const sorters = {
          priority: (a,b) => b.priority - a.priority,
          runs: (a,b) => b.runs - a.runs,
          fresh: (a,b) => b.freshness - a.freshness,
          name: (a,b) => a.title.localeCompare(b.title)
        };
        reports.sort(sorters[view.sort] || sorters.priority);
        return reports;
      }

      function renderReports() {
        const reports = getFilteredReports();
        const grid = document.getElementById('reportsGrid');
        const metrics = document.getElementById('reportMetrics');
        const pulse = document.getElementById('reportPulseList');
        const runsBody = document.getElementById('reportRunsTableBody');
        if (!grid || !metrics || !pulse || !runsBody) return;

        const scheduledCount = state.reports.filter(r => r.scheduled).length;
        const pinnedCount = state.reports.filter(r => r.pinned).length;
        const generatedToday = state.reports.filter(r => r.generatedToday).length;
        const totalRuns = state.reports.reduce((sum, r) => sum + r.runs, 0);

        metrics.innerHTML = `
          <div class="report-metric"><div class="k">Visible Reports</div><div class="v">${reports.length}</div></div>
          <div class="report-metric"><div class="k">Pinned Reports</div><div class="v">${pinnedCount}</div></div>
          <div class="report-metric"><div class="k">Scheduled Reports</div><div class="v">${scheduledCount}</div></div>
          <div class="report-metric"><div class="k">Total Runs</div><div class="v">${totalRuns}</div></div>
        `;

        pulse.innerHTML = `
          <div class="soft-item"><strong style="color:white;">${generatedToday}</strong><div class="muted">Generated today</div></div>
          <div class="soft-item"><strong style="color:white;">${state.reportRuns.length}</strong><div class="muted">Run history entries</div></div>
          <div class="soft-item"><strong style="color:white;">${state.reports.filter(r => r.type==='compliance').length}</strong><div class="muted">Compliance packs ready</div></div>
        `;

        grid.innerHTML = reports.map(report => `
          <div class="report-card">
            <div class="tag">${report.type.toUpperCase()} • ${report.owner}</div>
            <h3>${escapeHtml(report.title)}</h3>
            <p>${escapeHtml(report.description)}</p>
            <div class="report-meta">
              <span>Runs: ${report.runs}</span>
              <span>Last run: ${report.lastRun}</span>
              <span>Size: ${report.size}</span>
            </div>
            <div class="report-actions">
              <button class="mini-btn btn-outline" onclick="openReport('${report.id}')">${escapeHtml(report.button)}</button>
              <button class="mini-btn btn-primary" onclick="viewReportSummary('${report.id}')">View</button>
              <button class="mini-btn btn-outline" onclick="previewReport('${report.id}')">Preview</button>
              <button class="mini-btn btn-outline" onclick="toggleReportPin('${report.id}')">${report.pinned ? 'Unpin' : 'Pin'}</button>
              <button class="mini-btn btn-outline" onclick="scheduleReport('${report.id}')">${report.scheduled ? 'Reschedule' : 'Schedule'}</button>
              <button class="mini-btn btn-outline" onclick="cloneReport('${report.id}')">Clone</button>
            </div>
          </div>
        `).join('') || `<div class="sub-card"><p class="muted">No reports match the current filters.</p></div>`;

        runsBody.innerHTML = state.reportRuns.map((run, index) => {
          const report = state.reports.find(r => r.id === run.reportId);
          return `
            <tr>
              <td>${escapeHtml(run.time)}</td>
              <td>${escapeHtml(report ? report.title : run.reportId)}</td>
              <td>${escapeHtml(run.action)}</td>
              <td>${escapeHtml(run.owner)}</td>
              <td><span class="status ${run.status === 'Queued' ? 'pending' : run.status === 'Delivered' ? 'paid' : 'approved'}">${escapeHtml(run.status)}</span></td>
              <td><button class="table-btn view" onclick="openReportRun(${index})">Open</button></td>
            </tr>`;
        }).join('') || `<tr><td colspan="6" class="empty-row">No report activity yet.</td></tr>`;
      }

      function renderAudit() {
        const body = document.getElementById('auditTableBody');
        if (!body) return;
        body.innerHTML = state.audit.map((item, index) => `
          <tr>
            <td>${escapeHtml(item.time)}</td>
            <td>${escapeHtml(item.user)}</td>
            <td>${escapeHtml(item.action)}</td>
            <td>${escapeHtml(item.entity)}</td>
            <td><button class="table-btn view" onclick="openAudit(${index})">Open</button></td>
          </tr>
        `).join('') || `<tr><td colspan="5" class="empty-row">No audit logs available.</td></tr>`;
      }

      function applyExpenseFilter() {
        const searchEl = document.getElementById('expenseSearch');
        const filterEl = document.getElementById('expenseFilter');
        if (!searchEl || !filterEl) return;
        const query = searchEl.value.trim().toLowerCase();
        const status = document.getElementById('expenseFilter').value;
        const filtered = state.expenses.filter(expense => {
          const matchText = !query || expense.id.toLowerCase().includes(query) || expense.employee.toLowerCase().includes(query) || expense.category.toLowerCase().includes(query);
          const matchStatus = status === 'all' || expense.status === status;
          return matchText && matchStatus;
        });
        renderExpenses(filtered);
        showToast(`Showing ${filtered.length} expense record(s).`);
      }
      function resetExpenseFilter() {
        const searchEl = document.getElementById('expenseSearch');
        const filterEl = document.getElementById('expenseFilter');
        if (!searchEl || !filterEl) return;
        searchEl.value = '';
        filterEl.value = 'all';
        renderExpenses();
        showToast('Expense filters reset.');
      }


      function getExpenseById(id) {
        const localExpense = state.expenses.find(e => e.id === id) || null;
        const sharedExpense = window.FinStackStore && typeof window.FinStackStore.getExpenseById === 'function'
          ? window.FinStackStore.getExpenseById(id)
          : null;
        if (!sharedExpense) return localExpense;
        return {
          ...(localExpense || {}),
          ...sharedExpense,
          status: localExpense ? localExpense.status : mapFinanceStatus(sharedExpense),
          method: mapPaymentMethod(sharedExpense.paymentMethod || (localExpense && localExpense.method)),
          submitted: (sharedExpense.date || sharedExpense.created || (localExpense && localExpense.submitted) || '').slice(0, 10),
          notes: sharedExpense.notes || (localExpense && localExpense.notes) || '',
          riskScore: sharedExpense.risk_score || (localExpense && localExpense.riskScore) || 0
        };
      }
      function getExpenseRiskMeta(expense) {
        const explicitRisk = expense.riskScore !== undefined ? expense.riskScore : expense.risk_score;
        const parsedRisk = Number(explicitRisk);
        const riskScore = Number.isFinite(parsedRisk) ? Math.max(0, Math.min(100, Math.round(parsedRisk))) : (/flagged/i.test(expense.status) ? 82 : /pending/i.test(expense.status) ? 49 : /approved/i.test(expense.status) ? 25 : 36);
        const riskLabel = riskScore >= 75 ? 'High Risk' : riskScore >= 40 ? 'Medium Risk' : 'Low Risk';
        const riskColor = riskScore >= 75 ? '#FF7272' : riskScore >= 40 ? '#F5C152' : '#18D69D';
        const riskBg = riskScore >= 75 ? 'rgba(239,68,68,.12)' : riskScore >= 40 ? 'rgba(245,158,11,.12)' : 'rgba(16,185,129,.12)';
        const riskGradient = riskScore >= 75 ? 'linear-gradient(90deg,#FF5252,#FF7A7A)' : riskScore >= 40 ? 'linear-gradient(90deg,#F59E0B,#FCD34D)' : 'linear-gradient(90deg,#17D7A1,#20D0C0)';
        return { riskScore, riskLabel, riskColor, riskBg, riskGradient };
      }
      function expenseSupportData(expense) {
        const categoryMerchantMap = { Travel: 'IndiGo Business', Meals: 'The Capital Grille', Hotel: 'Taj Residency', Flight: 'Air India Corporate', Transport: 'Uber for Business', Food: 'Urban Tandoor', Marketing: 'Creative Media Hub', Equipment: 'Office Depot Pro', Software: 'SaaS Central', Training: 'SkillForge Learning', Internet: 'Airtel Business', 'Office Supplies': 'Staples Workspace' };
        const merchant = (expense.merchant && expense.merchant.trim()) ? expense.merchant.trim() : (categoryMerchantMap[expense.category] || 'Vendor Partner');
        const categoryTone = expense.category === 'Meals' || expense.category === 'Food' ? 'Meals & Entertainment' : expense.category;
        return { merchant, categoryTone };
      }
      function getSubmitterEmail(expense) {
        const users = window.FinStackStore && typeof window.FinStackStore.getUsers === 'function' ? window.FinStackStore.getUsers() : [];
        const submitter = users.find(user => user.employeeId === expense.employeeId);
        if (submitter && submitter.email) return submitter.email;
        if (expense.email) return expense.email;
        return `${String(expense.employee || 'employee').toLowerCase().replace(/\s+/g,'.')}@company.com`;
      }
      function getReviewNoteMeta(expense) {
        if (expense.complianceDecisionNote) return { label: 'Compliance review note', value: expense.complianceDecisionNote };
        if (expense.managerDecisionNote) return { label: 'Manager review note', value: expense.managerDecisionNote };
        if (expense.financeDecisionNote) return { label: 'Finance review note', value: expense.financeDecisionNote };
        if (expense.notes) return { label: 'Submitter notes', value: expense.notes };
        return { label: 'Current review note', value: 'Clarify supporting documents and business purpose for this expense.' };
      }
      function buildInfoRequestMessage(expense) {
        const details = [
          expense.merchant ? `merchant ${expense.merchant}` : '',
          expense.date ? `expense date ${expense.date}` : '',
          expense.receiptFileName ? `receipt ${expense.receiptFileName}` : ''
        ].filter(Boolean).join(', ');
        return `Please clarify the supporting details for ${expense.id}${details ? ` (${details})` : ''}.`;
      }

      function openActivity(index) {
        const item = state.activities[index]; if (!item) return;
        openModal({
          title: 'Activity Details',
          subtitle: item.time,
          body: `
            <div class="popup-stack">
              <div class="expense-panel">
                <h4><span class="panel-ico">◔</span>Activity Overview</h4>
                <div class="popup-kv-grid">
                  <div><div class="expense-label">User</div><div class="expense-value">${escapeHtml(item.user)}</div></div>
                  <div><div class="expense-label">Time</div><div class="expense-value">${escapeHtml(item.time)}</div></div>
                  <div class="full"><div class="expense-label">Action</div><div class="expense-value">${escapeHtml(item.action)}</div></div>
                  <div class="full"><div class="expense-label">Entity</div><div class="expense-value">${escapeHtml(item.entity)}</div></div>
                </div>
              </div>
            </div>`,
          actions: [{ label: 'Close', variant: 'btn-primary', onClick: closeModal }]
        });
      }
      function resolveAlert(index) {
        const alert = state.alerts[index]; if (!alert) return;
        alert.unread = false;
        renderAlerts();
        closeDrawers();
        if (alert.title.toLowerCase().includes('violation')) setPage('flagged-page');
        else if (alert.title.toLowerCase().includes('payment')) setPage('payments-page');
        else setPage('finance-review-page');
        showToast(`Opened alert: ${alert.title}`);
      }
      function dismissAlert(index) {
        const alert = state.alerts[index]; if (!alert) return;
        state.alerts.splice(index, 1);
        renderAlerts();
        logActivity('Finance Officer', 'Dismissed Alert', alert.title);
        showToast('Alert dismissed.');
      }

      function markFinanceNotificationRead(id) {
        if (id && window.FinStackStore) window.FinStackStore.markNotificationRead(id);
        refreshFinanceNotificationDropdown();
        renderNotificationsPage();
      }

      function deleteFinanceNotification(id) {
        if (id && window.FinStackStore) window.FinStackStore.deleteNotification(id);
        refreshFinanceNotificationDropdown();
        renderNotificationsPage();
      }

      function viewExpense(id) {
        const expense = state.expenses.find(e => e.id === id); if (!expense) return;
        const riskScore = /flagged/i.test(expense.status) ? 82 : /pending/i.test(expense.status) ? 49 : 25;
        const riskLabel = riskScore >= 75 ? 'High Risk' : riskScore >= 40 ? 'Medium Risk' : 'Low Risk';
        const riskWidth = Math.max(12, Math.min(100, riskScore));
        const merchant = ({ Travel: 'IndiGo Business', Meals: 'The Capital Grille', Hotel: 'Taj Residency', Flight: 'Air India Corporate', Transport: 'Uber for Business', Food: 'Urban Tandoor', Marketing: 'Creative Media Hub', Equipment: 'Office Depot Pro', Software: 'SaaS Central', Training: 'SkillForge Learning', Internet: 'Airtel Business', 'Office Supplies': 'Staples Workspace' })[expense.category] || 'Vendor Partner';
        const categoryTone = expense.category === 'Meals' || expense.category === 'Food' ? 'Meals & Entertainment' : expense.category;
        openModal({
          title: 'Expense Details',
          subtitle: expense.id,
          body: `
            <div class="expense-modal">
              <div>
                <div class="expense-panel">
                  <h4><span class="panel-ico">◔</span>Employee Information</h4>
                  <div class="expense-info-grid">
                    <div class="full">
                      <div class="expense-label">Name</div>
                      <div class="expense-value">${escapeHtml(expense.employee)}</div>
                    </div>
                    <div class="full">
                      <div class="expense-label">Email</div>
                      <div class="expense-value">${escapeHtml(expense.employee.toLowerCase().replace(/\s+/g,'.'))}@company.com</div>
                    </div>
                  </div>
                </div>

                <div class="expense-panel" style="margin-top:22px;">
                  <h4><span class="panel-ico">▣</span>Expense Information</h4>
                  <div class="expense-info-grid">
                    <div class="full">
                      <div class="expense-label">Title</div>
                      <div class="expense-value">${escapeHtml(expense.notes || expense.category + ' Expense')}</div>
                    </div>
                    <div class="full">
                      <div class="expense-label">Description</div>
                      <div class="expense-value">${escapeHtml(expense.notes || 'Business expense submitted for finance review.')}</div>
                    </div>
                    <div>
                      <div class="expense-label">Amount</div>
                      <div class="expense-value big">${formatINR(expense.amount)}</div>
                    </div>
                    <div>
                      <div class="expense-label">Date</div>
                      <div class="expense-value">${escapeHtml(expense.submitted)}</div>
                    </div>
                    <div>
                      <div class="expense-label">Category</div>
                      <div class="expense-value"><span class="expense-tag">⌂ ${escapeHtml(categoryTone)}</span></div>
                    </div>
                    <div>
                      <div class="expense-label">Merchant</div>
                      <div class="expense-value">${escapeHtml(merchant)}</div>
                    </div>
                    <div class="full">
                      <div class="expense-label">Payment Method</div>
                      <div class="expense-value">${escapeHtml(expense.method)} •••• 4532</div>
                    </div>
                  </div>
                </div>

                <div class="expense-panel" style="margin-top:22px;">
                  <h4><span class="panel-ico">⌲</span>OCR Extracted Data</h4>
                  <div class="ocr-grid">
                    <div>
                      <div class="expense-label">Merchant Name</div>
                      <div class="expense-value">${escapeHtml(merchant.toUpperCase())}</div>
                    </div>
                    <div>
                      <div class="expense-label">Receipt Date</div>
                      <div class="expense-value">${escapeHtml(expense.submitted.replace(/-/g,'/'))}</div>
                    </div>
                    <div class="ocr-items">
                      <div class="expense-label">Items</div>
                      <ul class="ocr-list">
                        <li>Entrees (4)</li>
                        <li>Beverages</li>
                        <li>Appetizers</li>
                        <li>Tax and service charges</li>
                      </ul>
                    </div>
                    <div>
                      <div class="expense-label">Tax Amount</div>
                      <div class="expense-value">${formatINR(Math.round(expense.amount * 0.074))}</div>
                    </div>
                    <div>
                      <div class="expense-label">Total</div>
                      <div class="expense-value big">${formatINR(expense.amount)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div class="expense-panel">
                  <h4><span class="panel-ico">▤</span>Receipt</h4>
                  <div class="receipt-download">⇩ Download Receipt</div>
                </div>

                <div class="expense-panel" style="margin-top:22px;">
                  <h4><span class="panel-ico">◌</span>Risk Assessment</h4>
                  <div style="display:flex; justify-content:space-between; gap:14px; align-items:center; margin-bottom:6px;">
                    <div class="expense-label" style="margin:0;">Risk Score</div>
                    <div class="expense-value big" style="color:${riskScore >= 75 ? '#FF7272' : riskScore >= 40 ? '#F5C152' : '#18D69D'};">${riskScore}/100</div>
                  </div>
                  <div class="risk-line"><div class="risk-fill" style="width:${riskWidth}%; background:${riskScore >= 75 ? 'linear-gradient(90deg,#FF5252,#FF7A7A)' : riskScore >= 40 ? 'linear-gradient(90deg,#F59E0B,#FCD34D)' : 'linear-gradient(90deg,#17D7A1,#20D0C0)'};"></div></div>
                  <span class="risk-tag" style="background:${riskScore >= 75 ? 'rgba(239,68,68,.12)' : riskScore >= 40 ? 'rgba(245,158,11,.12)' : 'rgba(16,185,129,.12)'}; color:${riskScore >= 75 ? '#FF8E8E' : riskScore >= 40 ? '#FCD34D' : '#54F0BA'};">${riskLabel}</span>
                </div>

                <div class="expense-panel" style="margin-top:22px;">
                  <h4><span class="panel-ico">▭</span>Clarification Thread</h4>
                  <div class="thread-empty">No messages yet. Start a clarification thread.</div>
                  <div class="thread-box">
                    <input class="thread-input" value="" placeholder="Ask for clarification..." />
                    <button class="thread-send" onclick="showToast('Clarification message queued for ${expense.id}.')">✈ Send</button>
                  </div>
                </div>
              </div>
            </div>
          `,
          actions: [
            { label: 'Send to Review', variant: 'btn-outline', onClick: () => { reviewExpense(expense.id); closeModal(); } },
            { label: 'Close', variant: 'btn-primary', onClick: closeModal }
          ]
        });
      }
      function reviewExpense(id) {
        syncSharedFinanceState();
        const expense = state.expenses.find(e => e.id === id); if (!expense) return;
        renderReviews(); updateMetrics(); setPage('finance-review-page');
        showToast(`${id} moved to finance review.`);
      }

      function approveReview(id) {
        window.FinStackStore.financeApprove(id, 'Approved by finance officer.');
        syncSharedFinanceState();
        renderReviews(); renderExpenses(); renderPayments(); renderReconciliation(); renderFlagged(); updateMetrics();
        logActivity('Finance Officer', 'Approved Expense', id);
        showToast(`${id} approved.`);
      }
      function rejectReview(id) {
        window.FinStackStore.financeReject(id, 'Rejected during finance review.');
        syncSharedFinanceState();
        renderReviews(); renderExpenses(); renderFlagged(); renderPayments(); updateMetrics();
        logActivity('Finance Officer', 'Rejected Expense', id);
        showToast(`${id} rejected.`);
      }
      function flagReview(id) {
        window.FinStackStore.financeFlag(id, 'Flagged for compliance review by finance.');
        syncSharedFinanceState();
        renderReviews(); renderExpenses(); renderFlagged(); updateMetrics();
        logActivity('Finance Officer', 'Flagged Expense', id);
        showToast(`${id} sent to compliance review.`);
      }
      function requestInfo(id) {
        const expense = getExpenseById(id) || { id, employee: 'Employee', category: 'General', amount: 0, submitted: new Date().toISOString().slice(0,10), method: 'Reimbursement', status: 'pending', notes: 'Additional clarification required for review.' };
        const { riskScore, riskLabel, riskColor, riskBg, riskGradient } = getExpenseRiskMeta(expense);
        const { merchant, categoryTone } = expenseSupportData(expense);
        const submitterEmail = getSubmitterEmail(expense);
        const reviewNote = getReviewNoteMeta(expense);
        const paymentMethod = expense.method || mapPaymentMethod(expense.paymentMethod);
        const receiptFileName = expense.receiptFileName || 'No receipt file recorded';
        const requestMessage = buildInfoRequestMessage(expense);
        openModal({
          title: 'Request Information',
          subtitle: id,
          body: `
            <div class="expense-modal">
              <div class="popup-stack">
                <div class="expense-panel">
                  <h4><span class="panel-ico">◔</span>Expense Snapshot</h4>
                  <div class="popup-kv-grid">
                    <div>
                      <div class="expense-label">Employee</div>
                      <div class="expense-value">${escapeHtml(expense.employee)}</div>
                    </div>
                    <div>
                      <div class="expense-label">Expense ID</div>
                      <div class="expense-value">${escapeHtml(expense.id)}</div>
                    </div>
                    <div>
                      <div class="expense-label">Amount</div>
                      <div class="expense-value big">${formatINR(expense.amount)}</div>
                    </div>
                    <div>
                      <div class="expense-label">Submitted</div>
                      <div class="expense-value">${escapeHtml(expense.submitted)}</div>
                    </div>
                    <div>
                      <div class="expense-label">Category</div>
                      <div class="expense-value"><span class="expense-tag">⌂ ${escapeHtml(categoryTone)}</span></div>
                    </div>
                    <div>
                      <div class="expense-label">Merchant</div>
                      <div class="expense-value">${escapeHtml(merchant)}</div>
                    </div>
                    <div>
                      <div class="expense-label">Payment Method</div>
                      <div class="expense-value">${escapeHtml(paymentMethod)}</div>
                    </div>
                    <div>
                      <div class="expense-label">Receipt</div>
                      <div class="expense-value">${escapeHtml(receiptFileName)}</div>
                    </div>
                    <div class="full">
                      <div class="expense-label">${escapeHtml(reviewNote.label)}</div>
                      <div class="expense-value">${escapeHtml(reviewNote.value)}</div>
                    </div>
                  </div>
                </div>

                <div class="expense-panel">
                  <h4><span class="panel-ico">◌</span>Review Risk</h4>
                  <div style="display:flex; justify-content:space-between; gap:14px; align-items:center; margin-bottom:6px;">
                    <div class="expense-label" style="margin:0;">Risk Score</div>
                    <div class="expense-value big" style="color:${riskColor};">${riskScore}/100</div>
                  </div>
                  <div class="risk-line"><div class="risk-fill" style="width:${riskScore}%; background:${riskGradient};"></div></div>
                  <span class="risk-tag" style="background:${riskBg}; color:${riskColor};">${riskLabel}</span>
                </div>
              </div>

              <div class="popup-stack">
                <div class="expense-panel">
                  <h4><span class="panel-ico">✉</span>Request Message</h4>
                  <div class="popup-kv-grid">
                    <div class="full">
                      <div class="expense-label">Subject</div>
                      <input class="field" id="infoSubject" value="Additional documentation required for ${escapeHtml(id)}" />
                    </div>
                    <div class="full">
                      <div class="expense-label">Message</div>
                      <textarea class="popup-note-box" id="infoMessage">${escapeHtml(requestMessage)}</textarea>
                    </div>
                  </div>
                </div>

                <div class="expense-panel">
                  <h4><span class="panel-ico">▭</span>Delivery & Follow-up</h4>
                  <div class="popup-subgrid">
                    <div class="popup-stat-box">
                      <div class="expense-label">Send to</div>
                      <div class="expense-value">${escapeHtml(submitterEmail)}</div>
                    </div>
                    <div class="popup-stat-box">
                      <div class="expense-label">Response SLA</div>
                      <div class="expense-value">Within 24 hours</div>
                    </div>
                  </div>
                  <div class="popup-inline-actions" style="margin-top:18px;">
                    <button class="mini-btn btn-outline" onclick="showToast('Receipt reminder added for ${id}.')">Add reminder</button>
                    <button class="mini-btn btn-outline" onclick="showToast('Compliance copied for ${id}.')">Copy compliance</button>
                  </div>
                </div>
              </div>
            </div>
          `,
          actions: [
            { label: 'Cancel', variant: 'btn-outline', onClick: closeModal },
            { label: 'Send Request', variant: 'btn-primary', onClick: () => {
                const message = document.getElementById('infoMessage').value.trim() || 'Additional information requested';
                window.FinStackStore.financeRequestInfo(id, message);
                syncSharedFinanceState();
                renderReviews(); renderExpenses(); updateMetrics();
                logActivity('Finance Officer', 'Requested More Info', `${id}: ${message.slice(0, 34)}...`);
                closeModal();
                showToast(`Info request sent for ${id}.`);
              }
            }
          ]
        });
      }

      function matchReconciliation(id) {
        const item = state.reconciliation.find(r => r.id === id); if (!item) return;
        reconcileTransaction(item.transactionId || item.id);
      }
      function investigateMismatch(id) {
        const item = state.reconciliation.find(r => r.id === id); if (!item) return;
        item.status = 'mismatch';
        renderReconciliation(); updateMetrics();
        logActivity('Finance Officer', 'Investigated Reconciliation', id);
        showToast(`Mismatch investigation opened for ${id}.`);
      }

      function viewTransaction(id) {
        const txn = state.transactions.find(t => t.id === id); if (!txn) return;
        const actions = [{ label: 'Close', variant: 'btn-outline', onClick: closeModal }];
        if (txn.status === 'pending') {
          actions.push(
            { label: 'Test: Simulate Success', variant: 'btn-primary', onClick: () => { simulateBankSuccess(id); closeModal(); } },
            { label: 'Test: Simulate Failure', variant: 'btn-outline', onClick: () => { simulateBankFailure(id); closeModal(); } }
          );
        } else if (txn.status === 'processed') {
          actions.push({ label: 'Reconcile', variant: 'btn-primary', onClick: () => { reconcileTransaction(id); closeModal(); } });
        }
        openModal({
          title: 'Transaction Details',
          subtitle: id,
          body: `
            <div class="popup-stack">
              <div class="expense-panel">
                <h4><span class="panel-ico">💳</span>Transaction Information</h4>
                <div class="popup-kv-grid">
                  <div><div class="expense-label">Transaction ID</div><div class="expense-value">${escapeHtml(txn.id)}</div></div>
                  <div><div class="expense-label">Bank</div><div class="expense-value">${escapeHtml(txn.bank)}</div></div>
                  <div><div class="expense-label">Amount</div><div class="expense-value big">${formatINR(txn.amount)}</div></div>
                  <div><div class="expense-label">Date</div><div class="expense-value">${escapeHtml(txn.date)}</div></div>
                  <div><div class="expense-label">Expense</div><div class="expense-value">${escapeHtml(txn.expenseId || '-')}</div></div>
                  <div class="full"><div class="expense-label">Status</div><div class="expense-value">${escapeHtml(capitalize(txn.status))}</div></div>
                </div>
              </div>
            </div>`,
          actions: actions
        });
      }
      function simulateBankSuccess(id) {
        if (!window.FinStackStore || typeof window.FinStackStore.simulateBankSuccess !== 'function') return showToast('Bank Sandbox is unavailable.');
        const result = window.FinStackStore.simulateBankSuccess(id);
        syncSharedFinanceState();
        renderTransactions(); renderReconciliation(); renderPayments(); updateMetrics();
        if (!result) return showToast('Bank Sandbox success could not be applied.');
        logActivity('Bank Sandbox', 'Simulated Success', id);
        showToast(`${id} marked processed by Bank Sandbox.`);
      }
      function simulateBankFailure(id) {
        if (!window.FinStackStore || typeof window.FinStackStore.simulateBankFailure !== 'function') return showToast('Bank Sandbox is unavailable.');
        const result = window.FinStackStore.simulateBankFailure(id);
        syncSharedFinanceState();
        renderTransactions(); renderReconciliation(); renderPayments(); updateMetrics();
        if (!result) return showToast('Bank Sandbox failure could not be applied.');
        logActivity('Bank Sandbox', 'Simulated Failure', id);
        showToast(`${id} marked failed by Bank Sandbox.`);
      }
      function reconcileTransaction(id) {
        const txn = state.transactions.find(t => t.id === id); if (!txn) return;
        if (!window.FinStackStore || typeof window.FinStackStore.reconcileTransaction !== 'function') return showToast('Reconciliation service is unavailable.');
        const result = window.FinStackStore.reconcileTransaction(id);
        syncSharedFinanceState();
        state.lastReconciliationRun = `Last run at ${nowLabel()}`;
        renderTransactions(); renderReconciliation(); renderPayments(); renderExpenses(); updateMetrics();
        if (!result) return showToast('Transaction could not be reconciled.');
        logActivity('Finance Officer', 'Reconciled Transaction', id);
        showToast(`${id} reconciled.`);
      }

      function viewFlagged(id) {
        const item = state.flagged.find(f => f.id === id); if (!item) return;
        const expense = getExpenseById(id) || { id, employee: 'Unknown Employee', category: 'General', amount: 0, submitted: '2026-03-24', method: 'Reimbursement', status: 'flagged', notes: item.reason };
        const { riskScore, riskLabel, riskColor, riskBg, riskGradient } = getExpenseRiskMeta(expense);
        const { merchant, categoryTone } = expenseSupportData(expense);
        openModal({
          title: 'Flagged Expense',
          subtitle: id,
          body: `
            <div class="expense-modal">
              <div class="popup-stack">
                <div class="expense-panel">
                  <h4><span class="panel-ico">⚠</span>Flag Summary</h4>
                  <div class="popup-kv-grid">
                    <div><div class="expense-label">Employee</div><div class="expense-value">${escapeHtml(expense.employee)}</div></div>
                    <div><div class="expense-label">Amount</div><div class="expense-value big">${formatINR(expense.amount)}</div></div>
                    <div><div class="expense-label">Category</div><div class="expense-value"><span class="expense-tag">⌂ ${escapeHtml(categoryTone)}</span></div></div>
                    <div><div class="expense-label">Merchant</div><div class="expense-value">${escapeHtml(merchant)}</div></div>
                    <div class="full"><div class="expense-label">Reason</div><div class="expense-value">${escapeHtml(item.reason)}</div></div>
                  </div>
                </div>

                <div class="expense-panel">
                  <h4><span class="panel-ico">⌲</span>Review Notes</h4>
                  <ul class="popup-muted-list">
                    <li>Duplicate pattern detection is active for this claim.</li>
                    <li>Supporting receipt and policy match should be manually verified.</li>
                    <li>Escalation is recommended if clarification is not received today.</li>
                  </ul>
                </div>
              </div>

              <div class="popup-stack">
                <div class="expense-panel">
                  <h4><span class="panel-ico">◌</span>Risk Assessment</h4>
                  <div style="display:flex; justify-content:space-between; gap:14px; align-items:center; margin-bottom:6px;">
                    <div class="expense-label" style="margin:0;">Risk Score</div>
                    <div class="expense-value big" style="color:${riskColor};">${riskScore}/100</div>
                  </div>
                  <div class="risk-line"><div class="risk-fill" style="width:${riskScore}%; background:${riskGradient};"></div></div>
                  <span class="risk-tag" style="background:${riskBg}; color:${riskColor};">${riskLabel}</span>
                </div>

                <div class="expense-panel">
                  <h4><span class="panel-ico">▭</span>Case Actions</h4>
                  <div class="popup-inline-actions">
                    <button class="mini-btn btn-outline" onclick="requestInfo('${id}')">Request Info</button>
                    <button class="mini-btn btn-outline" onclick="showToast('Receipt downloaded for ${id}.')">Download Receipt</button>
                  </div>
                  <div class="popup-inline-actions" style="margin-top:14px;">
                    <button class="mini-btn btn-outline" onclick="showToast('Audit note added for ${id}.')">Add Audit Note</button>
                    <button class="mini-btn btn-primary" onclick="escalateFlagged('${id}')">Escalate Case</button>
                  </div>
                </div>
              </div>
            </div>
          `,
          actions: [
            { label: 'Close', variant: 'btn-outline', onClick: closeModal },
            { label: 'Escalate', variant: 'btn-primary', onClick: () => { closeModal(); escalateFlagged(id); } }
          ]
        });
      }
      function escalateFlagged(id) {
        const item = state.flagged.find(f => f.id === id); if (!item) return;
        const expense = getExpenseById(id) || { employee: 'Unknown Employee', amount: 0, category: 'General', submitted: '2026-03-24' };
        openModal({
          title: 'Escalate Case',
          subtitle: id,
          body: `
            <div class="expense-modal">
              <div class="popup-stack">
                <div class="expense-panel">
                  <h4><span class="panel-ico">⇪</span>Escalation Summary</h4>
                  <div class="popup-kv-grid">
                    <div><div class="expense-label">Employee</div><div class="expense-value">${escapeHtml(expense.employee)}</div></div>
                    <div><div class="expense-label">Amount</div><div class="expense-value big">${formatINR(expense.amount)}</div></div>
                    <div><div class="expense-label">Issue Type</div><div class="expense-value">${escapeHtml(item.reason)}</div></div>
                    <div><div class="expense-label">Target Team</div><div class="expense-value">Compliance & Internal Audit</div></div>
                  </div>
                </div>

                <div class="expense-panel">
                  <h4><span class="panel-ico">⏱</span>Case Priority</h4>
                  <div class="popup-subgrid">
                    <div class="popup-stat-box">
                      <div class="expense-label">SLA</div>
                      <div class="expense-value">4 hours</div>
                    </div>
                    <div class="popup-stat-box">
                      <div class="expense-label">Severity</div>
                      <div class="expense-value">${escapeHtml(item.risk)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="popup-stack">
                <div class="expense-panel">
                  <h4><span class="panel-ico">✎</span>Escalation Note</h4>
                  <div class="popup-kv-grid">
                    <div>
                      <div class="expense-label">Escalate to</div>
                      <select class="select" id="escalateOwner">
                        <option selected>Compliance Team</option>
                        <option>Internal Audit</option>
                        <option>Finance Lead</option>
                      </select>
                    </div>
                    <div>
                      <div class="expense-label">Priority</div>
                      <select class="select" id="escalatePriority">
                        <option>Medium</option>
                        <option selected>High</option>
                        <option>Critical</option>
                      </select>
                    </div>
                    <div class="full">
                      <div class="expense-label">Escalation Details</div>
                      <textarea class="popup-note-box" id="escalateMessage">Potential policy and documentation mismatch detected for ${escapeHtml(id)}. Please review the claim, receipt, and reimbursement trail immediately.</textarea>
                    </div>
                  </div>
                </div>

                <div class="expense-panel">
                  <h4><span class="panel-ico">▭</span>Next Steps</h4>
                  <ul class="popup-muted-list">
                    <li>Compliance receives the claim packet instantly.</li>
                    <li>Audit trail entry is generated after submission.</li>
                    <li>The requester is notified once the case is escalated.</li>
                  </ul>
                </div>
              </div>
            </div>
          `,
          actions: [
            { label: 'Cancel', variant: 'btn-outline', onClick: closeModal },
            { label: 'Escalate Now', variant: 'btn-primary', onClick: () => {
                const priority = document.getElementById('escalatePriority').value;
                syncSharedFinanceState();
                logActivity('Finance Officer', 'Escalated Expense', `${id} • ${priority}`);
                closeModal();
                showToast(`${id} escalated to compliance.`);
              }
            }
          ]
        });
      }

      function releasePayment(id) {
        const item = state.payments.find(p => p.id === id); if (!item) return;
        if (item.status !== 'pending') return showToast(`${id} is already sent to Bank Sandbox.`);
        window.FinStackStore.releasePaymentBatch(id);
        syncSharedFinanceState();
        renderPayments(); renderExpenses(); renderTransactions(); renderReconciliation(); updateMetrics();
        logActivity('Finance Officer', 'Released Payment Batch', id);
        showToast(`${id} sent to Bank Sandbox.`);
      }
      function viewPayment(id) {
        const item = state.payments.find(p => p.id === id); if (!item) return;
        openModal({
          title: 'Payment Batch',
          subtitle: id,
          body: `
            <div class="popup-stack">
              <div class="expense-panel">
                <h4><span class="panel-ico">₹</span>Payment Information</h4>
                <div class="popup-kv-grid">
                  <div><div class="expense-label">Batch ID</div><div class="expense-value">${escapeHtml(id)}</div></div>
                  <div><div class="expense-label">Count</div><div class="expense-value">${escapeHtml(String(item.count))}</div></div>
                  <div><div class="expense-label">Total Amount</div><div class="expense-value big">${formatINR(item.total)}</div></div>
                  <div><div class="expense-label">Status</div><div class="expense-value">${escapeHtml(capitalize(item.status))}</div></div>
                  <div class="full"><div class="expense-label">Scheduled Date</div><div class="expense-value">${escapeHtml(item.scheduled)}</div></div>
                </div>
              </div>
            </div>`,
          actions: [
            { label: 'Close', variant: 'btn-outline', onClick: closeModal },
            { label: 'Release', variant: 'btn-primary', onClick: () => { releasePayment(id); closeModal(); } }
          ]
        });
      }

      function openReport(id) {
        const report = state.reports.find(r => r.id === id); if (!report) return;
        const content = `${report.title}\n\n${report.description}\n\nGenerated at ${new Date().toLocaleString()}`;
        downloadText(report.file, content);
        logActivity('Finance Officer', 'Generated Report', report.title);
        showToast(`${report.title} downloaded.`);
      }
      function viewReportSummary(id) {
        const report = state.reports.find(r => r.id === id); if (!report) return;
        openModal({ title: report.title, body: `${detailMarkup({ Owner: report.owner, Type: report.type.toUpperCase(), 'Run count': report.runs, 'Last run': report.lastRun, Size: report.size, Status: report.scheduled ? 'Scheduled' : 'On demand' })}<div class="detail-card"><div class="label">Summary</div><div class="value">${escapeHtml(report.description)}</div></div>`, actions: [{ label: report.button, variant: 'btn-outline', onClick: () => { openReport(id); closeModal(); } }, { label: 'Preview', variant: 'btn-outline', onClick: () => { previewReport(id); closeModal(); } }, { label: 'Close', variant: 'btn-primary', onClick: closeModal }] });
      }
      function pushReportRun(report, action, status='Ready') {
        state.reportRuns.unshift({ time: nowLabel(), reportId: report.id, action, owner: report.owner, status });
        report.generatedToday = true;
        report.lastRun = nowLabel();
      }
      function previewReport(id) {
        const report = state.reports.find(r => r.id === id); if (!report) return;
        pushReportRun(report, 'Previewed', 'Ready');
        renderReports();
        openModal({ title: `Preview • ${report.title}`, body: `<div class="detail-card"><div class="label">Insight preview</div><div class="value">${escapeHtml(report.description)}

Top signal: ${report.type.toUpperCase()} workflows are showing elevated activity in the latest cycle.</div></div>`, actions: [{ label: 'Generate', variant: 'btn-primary', onClick: () => { openReport(id); closeModal(); } }, { label: 'Close', variant: 'btn-outline', onClick: closeModal }] });
      }
      function toggleReportPin(id) {
        const report = state.reports.find(r => r.id === id); if (!report) return;
        report.pinned = !report.pinned;
        renderReports();
        logActivity('Finance Officer', report.pinned ? 'Pinned Report' : 'Unpinned Report', report.title);
        showToast(`${report.title} ${report.pinned ? 'pinned' : 'unpinned'}.`);
      }
      function scheduleReport(id) {
        const report = state.reports.find(r => r.id === id); if (!report) return;
        openModal({ title: `Schedule • ${report.title}`, body: `<div class="form-grid"><input class="field" id="scheduleOwner" value="${escapeHtml(report.owner)}" /><input class="field" id="scheduleTime" value="Every weekday • 09:00" /><textarea class="text-area full" id="scheduleNotes">Send to finance leadership and archive latest copy.</textarea></div>`, actions: [{ label: 'Save Schedule', variant: 'btn-primary', onClick: () => { report.scheduled = true; pushReportRun(report, 'Scheduled', 'Queued'); renderReports(); logActivity('Finance Officer', 'Scheduled Report', report.title); closeModal(); showToast(`${report.title} scheduled.`); } }, { label: 'Cancel', variant: 'btn-outline', onClick: closeModal }] });
      }
      function cloneReport(id) {
        const report = state.reports.find(r => r.id === id); if (!report) return;
        const clone = { ...report, id: `RPT-${String(Math.floor(100 + Math.random()*900))}`, title: `${report.title} Copy`, pinned: false, scheduled: false, generatedToday: false, runs: 0, lastRun: 'Not yet', size: report.size };
        state.reports.unshift(clone);
        renderReports();
        logActivity('Finance Officer', 'Cloned Report', clone.title);
        showToast(`${report.title} cloned.`);
      }
      function openReportRun(index) {
        const run = state.reportRuns[index]; if (!run) return;
        const report = state.reports.find(r => r.id === run.reportId);
        openModal({ title: 'Report Run Details', body: detailMarkup({ Time: run.time, Report: report ? report.title : run.reportId, Action: run.action, Owner: run.owner, Status: run.status }), actions: [{ label: 'Close', variant: 'btn-primary', onClick: closeModal }] });
      }
      function compareReports() {
        const top = getFilteredReports().slice(0,2);
        if (top.length < 2) return showToast('Need at least two reports to compare.');
        openModal({ title: 'Compare Reports', body: `<div class="detail-grid">${top.map(report => `<div class="detail-card"><div class="label">${escapeHtml(report.title)}</div><div class="value">Runs: ${report.runs}<br>Priority: ${report.priority}<br>Freshness: ${report.freshness}<br>Owner: ${escapeHtml(report.owner)}</div></div>`).join('')}</div>`, actions: [{ label: 'Close', variant: 'btn-primary', onClick: closeModal }] });
        showToast('Top reports compared.');
      }
      function generateExecutivePack() {
        const content = getFilteredReports().map(r => `${r.title}\nOwner: ${r.owner}\nRuns: ${r.runs}\nStatus: ${r.scheduled ? 'Scheduled' : 'On demand'}\n`).join('\n');
        downloadText('executive-report-pack.txt', content);
        state.reports.forEach(r => { if (r.pinned) r.generatedToday = true; });
        state.reportRuns.unshift({ time: nowLabel(), reportId: 'EXEC-PACK', action: 'Generated Executive Pack', owner: 'Finance Officer', status: 'Delivered' });
        renderReports();
        logActivity('Finance Officer', 'Generated Executive Pack', 'Pinned reports');
        showToast('Executive pack downloaded.');
      }

      function openAudit(index) {
        const item = state.audit[index]; if (!item) return;
        openModal({
          title: 'Audit Entry',
          subtitle: item.time,
          body: `
            <div class="popup-stack">
              <div class="expense-panel">
                <h4><span class="panel-ico">☰</span>Audit Details</h4>
                <div class="popup-kv-grid">
                  <div><div class="expense-label">Time</div><div class="expense-value">${escapeHtml(item.time)}</div></div>
                  <div><div class="expense-label">User</div><div class="expense-value">${escapeHtml(item.user)}</div></div>
                  <div><div class="expense-label">Action</div><div class="expense-value">${escapeHtml(item.action)}</div></div>
                  <div><div class="expense-label">Entity</div><div class="expense-value">${escapeHtml(item.entity)}</div></div>
                </div>
              </div>
            </div>`,
          actions: [{ label: 'Close', variant: 'btn-primary', onClick: closeModal }]
        });
      }

      function detailMarkup(obj, sectionTitle = 'Information') {
        return `
          <div>
            <div class="modal-section-title">${escapeHtml(sectionTitle)}</div>
            <div class="detail-list">
              ${Object.entries(obj).map(([k, v]) => {
                const value = String(v);
                const tone = /approved|matched|paid/i.test(value) ? 'success' : /pending|queued|review/i.test(value) ? 'warning' : /flagged|rejected|failed|mismatch/i.test(value) ? 'danger' : '';
                return `<div class="detail-row"><div class="key">${escapeHtml(k)}</div><div class="val ${tone}">${escapeHtml(value)}</div></div>`;
              }).join('')}
            </div>
          </div>`;
      }

      function addExpenseModal() {
        openModal({
          title: 'Add Expense',
          body: `
            <div class="form-grid">
              <input class="field" id="newExpenseEmployee" placeholder="Employee name" value="New Employee" />
              <input class="field" id="newExpenseCategory" placeholder="Category" value="Travel" />
              <input class="field" id="newExpenseAmount" type="number" placeholder="Amount" value="5000" />
              <select class="select" id="newExpenseMethod"><option>Reimbursement</option><option>Corporate Card</option></select>
              <textarea class="text-area full" id="newExpenseNotes" placeholder="Notes">Business travel expense</textarea>
            </div>
          `,
          actions: [
            { label: 'Create Expense', variant: 'btn-primary', onClick: () => {
                const employee = document.getElementById('newExpenseEmployee').value.trim();
                const category = document.getElementById('newExpenseCategory').value.trim() || 'General';
                const amount = Number(document.getElementById('newExpenseAmount').value || 0);
                const method = document.getElementById('newExpenseMethod').value;
                const notes = document.getElementById('newExpenseNotes').value.trim();
                if (!employee || !amount) return showToast('Enter employee and amount.');
                const id = `EXP-${Math.floor(1000 + Math.random() * 9000)}`;
                state.expenses.unshift({ id, employee, category, amount, status: 'pending', method, submitted: new Date().toISOString().slice(0,10), notes });
                state.reviews.unshift({ id, by: employee, amount, manager: 'Approved', note: '' });
                renderExpenses(); renderReviews(); updateMetrics();
                logActivity('Finance Officer', 'Added Expense', id);
                closeModal(); showToast(`Expense ${id} added.`);
              }
            },
            { label: 'Cancel', variant: 'btn-outline', onClick: closeModal }
          ]
        });
      }
      function schedulePaymentModal() {
        openModal({
          title: 'Schedule Payment',
          body: `
            <div class="form-grid">
              <input class="field" id="scheduleBatchCount" type="number" value="5" placeholder="Count" />
              <input class="field" id="scheduleBatchTotal" type="number" value="45000" placeholder="Total amount" />
              <input class="field full" id="scheduleBatchDate" type="date" value="2026-03-30" />
            </div>
          `,
          actions: [
            { label: 'Schedule', variant: 'btn-primary', onClick: () => {
                const count = Number(document.getElementById('scheduleBatchCount').value || 0);
                const total = Number(document.getElementById('scheduleBatchTotal').value || 0);
                const scheduled = document.getElementById('scheduleBatchDate').value;
                const id = `PB-${Math.floor(231 + Math.random() * 50)}`;
                state.payments.unshift({ id, count, total, status: 'pending', scheduled });
                renderPayments();
                logActivity('Finance Officer', 'Scheduled Payment Batch', id);
                closeModal(); showToast(`Scheduled payment ${id}.`);
              }
            },
            { label: 'Cancel', variant: 'btn-outline', onClick: closeModal }
          ]
        });
      }

      function exportExpensesCSV() {
        const rows = [['ID','Employee','Category','Amount','Status'], ...state.expenses.map(e => [e.id, e.employee, e.category, e.amount, e.status])];
        downloadText('expenses.csv', rows.map(r => r.join(',')).join('\n'));
        showToast('Expenses exported.');
      }
      function exportTransactionsCSV() {
        const rows = [['Transaction ID','Bank','Amount','Date','Status'], ...state.transactions.map(t => [t.id, t.bank, t.amount, t.date, t.status])];
        downloadText('transactions.csv', rows.map(r => r.join(',')).join('\n'));
        showToast('Transactions downloaded.');
      }
      function exportAuditLogs() {
        const rows = [['Time','User','Action','Entity'], ...state.audit.map(a => [a.time, a.user, a.action, a.entity])];
        downloadText('audit-logs.csv', rows.map(r => r.join(',')).join('\n'));
        showToast('Audit logs exported.');
      }

      // inline handlers exposure
      Object.assign(window, {
        openActivity, resolveAlert, dismissAlert, viewExpense, reviewExpense, approveReview, rejectReview, flagReview, requestInfo,
        matchReconciliation, investigateMismatch, viewTransaction, simulateBankSuccess, simulateBankFailure, reconcileTransaction, viewFlagged, escalateFlagged,
        releasePayment, viewPayment, openReport, viewReportSummary, previewReport, toggleReportPin, scheduleReport, cloneReport,
        compareReports, generateExecutivePack, openReportRun, openAudit, markFinanceNotificationRead, deleteFinanceNotification
      });

      // nav
      navButtons.forEach(btn => btn.addEventListener('click', () => setPage(btn.dataset.target)));

      // top bar
      const notificationBtnEl = document.getElementById('notificationBtn');
      if (notificationBtnEl) {
        notificationBtnEl.setAttribute('aria-haspopup', 'menu');
        notificationBtnEl.setAttribute('aria-expanded', 'false');
      }
      const foNotifDropdown = ensureFinanceNotificationDropdown();
      let closeFinanceNotifMenu = () => {};
      let closeFinanceProfileMenu = () => {};
      if (notificationBtnEl && foNotifDropdown) {
        closeFinanceNotifMenu = () => {
          foNotifDropdown.classList.remove('open');
          notificationBtnEl.setAttribute('aria-expanded', 'false');
        };
        const toggleFinanceNotifMenu = () => {
          const shouldOpen = !foNotifDropdown.classList.contains('open');
          closeDrawers();
          closeFinanceProfileMenu();
          foNotifDropdown.classList.toggle('open', shouldOpen);
          notificationBtnEl.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
          refreshFinanceNotificationDropdown(closeFinanceNotifMenu);
        };
        notificationBtnEl.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleFinanceNotifMenu();
        });
        notificationBtnEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleFinanceNotifMenu();
          } else if (e.key === 'Escape') {
            closeFinanceNotifMenu();
          }
        });
        foNotifDropdown.addEventListener('click', (e) => { e.stopPropagation(); });
        document.addEventListener('click', closeFinanceNotifMenu);
      }

      const userMenuEl = document.getElementById('userMenuBtn');
      if (userMenuEl) {
        userMenuEl.setAttribute('role', 'button');
        userMenuEl.setAttribute('tabindex', '0');
        userMenuEl.setAttribute('aria-haspopup', 'menu');
        userMenuEl.setAttribute('aria-expanded', 'false');
      }
      const foDropdown = ensureFinanceProfileDropdown();
      if (userMenuEl) {
        if (foDropdown) {
          closeFinanceProfileMenu = () => {
            foDropdown.classList.remove('open');
            userMenuEl.setAttribute('aria-expanded', 'false');
          };
          const toggleFinanceProfileMenu = () => {
            const shouldOpen = !foDropdown.classList.contains('open');
            closeDrawers();
            closeFinanceNotifMenu();
            foDropdown.classList.toggle('open', shouldOpen);
            userMenuEl.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
          };
          userMenuEl.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFinanceProfileMenu();
          });
          userMenuEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleFinanceProfileMenu();
            } else if (e.key === 'Escape') {
              closeFinanceProfileMenu();
            }
          });
          document.addEventListener('click', closeFinanceProfileMenu);
          foDropdown.addEventListener('click', (e) => { e.stopPropagation(); });
          foDropdown.querySelectorAll('.pd-item').forEach(item => {
            item.addEventListener('click', (e) => {
              e.preventDefault();
              closeFinanceProfileMenu();
              const action = item.getAttribute('data-action');
              if (action === 'profile-settings' || action === 'preferences') {
                setPage('settings-page');
              } else if (action === 'logout') {
                sessionStorage.removeItem('finstackUserSession');
                window.location.href = '../../login.html';
              }
            });
          });
        } else if (profileDrawer) {
          userMenuEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (profileDrawer.classList.contains('show')) {
              closeDrawers();
              return;
            }
            openDrawer(profileDrawer);
          });
        }
      }

      /* Populate user info from session */
      try {
        var foSession = JSON.parse(sessionStorage.getItem('finstackUserSession'));
        if (foSession && foSession.fullName) {
          var foInitials = foSession.fullName.split(' ').map(n => n.charAt(0)).join('').slice(0,2).toUpperCase();
          document.getElementById('userAvatar').textContent = foInitials;
          document.getElementById('userNameTop').textContent = foSession.fullName;
          document.getElementById('userEmailTop').textContent = 'Finance Officer';
          if (document.getElementById('foDropdownName')) document.getElementById('foDropdownName').textContent = foSession.fullName;
          if (document.getElementById('foDropdownRole')) document.getElementById('foDropdownRole').textContent = 'Finance Officer';
        }
      } catch(e) {}

      document.querySelectorAll('[data-close-drawer]').forEach(btn => btn.addEventListener('click', closeDrawers));
      drawerBackdrop.addEventListener('click', closeDrawers);
      document.getElementById('closeModalBtn').addEventListener('click', closeModal);
      modalBackdrop.addEventListener('click', closeModal);
      document.getElementById('logoutBtn').addEventListener('click', () => {
        logActivity('Finance Officer', 'Logged Out', 'FinStack Workspace');
        showToast('Signing you out...');
        window.setTimeout(() => {
          sessionStorage.removeItem('finstackUserSession');
          window.location.href = '../../login.html?role=finance_officer';
        }, 300);
      });
      document.getElementById('globalSearch').addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        const q = e.target.value.trim().toLowerCase();
        if (!q) return showToast('Type something to search.');
        if (q.includes('expense')) setPage('finance-review-page');
        else if (q.includes('review')) setPage('finance-review-page');
        else if (q.includes('payment')) setPage('payments-page');
        else if (q.includes('report')) setPage('reports-page');
        else if (q.includes('setting') || q.includes('profile')) setPage('settings-page');
        else if (state.expenses.some(e => e.id.toLowerCase() === q)) { setPage('finance-review-page'); viewExpense(q.toUpperCase()); }
        else setPage('dashboard-page');
        showToast(`Search opened for "${q}".`);
      });

      // expenses page removed from navigation by request; data remains in workflow state.

      // finance review
      document.getElementById('reviewNextBtn').addEventListener('click', () => {
        if (!state.reviews.length) return showToast('Review queue is empty.');
        const item = state.reviews[0];
        openModal({ title: `Next Review • ${item.id}`, body: detailMarkup({ SubmittedBy: item.by, Amount: formatINR(item.amount), ManagerStatus: item.manager }), actions: [{ label: 'Approve', variant: 'btn-primary', onClick: () => { approveReview(item.id); closeModal(); } }, { label: 'Reject', variant: 'btn-outline', onClick: () => { rejectReview(item.id); closeModal(); } }] });
      });
      document.getElementById('reviewRefreshBtn').addEventListener('click', () => {
        syncSharedFinanceState();
        renderReviews(); updateMetrics(); logActivity('System', 'Refreshed Review Queue', 'Finance Review'); showToast('Finance review queue refreshed.');
      });

      // reconciliation
      document.getElementById('runReconciliationBtn').addEventListener('click', () => {
        syncSharedFinanceState();
        state.lastReconciliationRun = `Last run at ${nowLabel()}`;
        renderReconciliation(); updateMetrics(); logActivity('Finance Officer', 'Reconciliation Run', 'Manual reconciliation'); showToast('Reconciliation executed.');
      });
      document.getElementById('autoMatchBtn').addEventListener('click', () => {
        state.autoMatch = !state.autoMatch;
        syncSharedFinanceState();
        renderReconciliation(); updateMetrics(); logActivity('Finance Officer', state.autoMatch ? 'Enabled Auto Match' : 'Disabled Auto Match', 'Reconciliation'); showToast(`Auto match ${state.autoMatch ? 'enabled' : 'disabled'}.`);
      });

      // transactions
      document.getElementById('syncTransactionsBtn').addEventListener('click', () => {
        syncSharedFinanceState();
        renderTransactions();
        updateMetrics();
        showToast(state.transactions.length ? 'Transactions refreshed.' : 'No payment transactions found.');
      });
      document.getElementById('downloadTxnBtn').addEventListener('click', exportTransactionsCSV);

      // flagged
      document.getElementById('scanFraudBtn').addEventListener('click', () => {
        syncSharedFinanceState();
        renderFlagged();
        updateMetrics();
        showToast(state.flagged.length ? 'Fraud scan refreshed flagged expenses.' : 'No finance-flagged expenses found.');
      });
      document.getElementById('bulkEscalateBtn').addEventListener('click', () => {
        if (!state.flagged.length) return showToast('No flagged expenses to escalate.');
        state.flagged.forEach(item => logActivity('Finance Officer', 'Bulk Escalated Expense', item.id));
        showToast('All flagged expenses escalated.');
      });

      // payments
      document.getElementById('releasePaymentsBtn').addEventListener('click', () => {
        const pending = state.payments.find(p => p.status === 'pending');
        if (!pending) return showToast('No pending payment batches.');
        releasePayment(pending.id);
      });
      document.getElementById('schedulePaymentBtn').addEventListener('click', schedulePaymentModal);

      // reports
      document.getElementById('generateReportBtn').addEventListener('click', () => {
        logActivity('Finance Officer', 'Generated Report', 'Executive summary');
        showToast('Executive report generated.');
      });
      document.getElementById('downloadAllReportsBtn').addEventListener('click', () => {
        downloadText('all-reports.txt', state.reports.map(r => `${r.title}\n${r.description}`).join('\n\n'));
        showToast('All reports downloaded.');
      });

      // settings
      function readSwitch(id) { return document.getElementById(id).checked; }
      function applySettingsToForm() {
        document.getElementById('officerName').value = state.settings.officerName;
        document.getElementById('officerEmail').value = state.settings.officerEmail;
        document.getElementById('departmentSetting').value = state.settings.department;
        document.getElementById('employeeIdSetting').value = state.settings.employeeId;
        document.getElementById('phoneSetting').value = state.settings.phone;
        document.getElementById('locationSetting').value = state.settings.location;
        document.getElementById('organizationIdSetting').value = state.settings.organizationId;
        document.getElementById('managerEmployeeIdSetting').value = state.settings.managerEmployeeId;
        document.getElementById('timezoneSetting').value = state.settings.timezone;
        document.getElementById('currencySetting').value = state.settings.currency;
        document.getElementById('themeSetting').value = state.settings.theme;
        document.getElementById('notesSetting').value = state.settings.notes;
        document.getElementById('languageSetting').value = state.settings.language;
        document.getElementById('summaryTimeSetting').value = state.settings.summaryTime;
        document.getElementById('dateFormatSetting').value = state.settings.dateFormat;
        document.getElementById('landingPageSetting').value = state.settings.landingPage;
        document.getElementById('emailNotificationsSetting').checked = state.settings.emailNotifications;
        document.getElementById('highRiskAlertsSetting').checked = state.settings.highRiskAlerts;
        document.getElementById('weeklyDigestSetting').checked = state.settings.weeklyDigest;
        document.getElementById('soundAlertsSetting').checked = state.settings.soundAlerts;
        document.getElementById('twoFactorSetting').checked = state.settings.twoFactor;
        document.getElementById('loginAlertsSetting').checked = state.settings.loginAlerts;
        document.getElementById('riskConfirmSetting').checked = state.settings.riskConfirm;
        document.getElementById('sessionTimeoutEnabled').checked = state.settings.sessionTimeoutEnabled;
        document.getElementById('sessionTimeoutSetting').value = state.settings.sessionTimeout;
        document.getElementById('approvalConfirmSetting').value = state.settings.approvalConfirm;
        document.getElementById('sidebarDefaultCollapsed').checked = state.settings.sidebarDefaultCollapsed;
        document.getElementById('compactDensitySetting').checked = state.settings.compactDensity;
        syncSettingsProfile();
      }

      // Notifications page – Mark All Read
      document.getElementById('foMarkAllReadBtn').addEventListener('click', () => {
        if (window.FinStackStore) window.FinStackStore.markAllNotificationsRead();
        renderAlerts();
        showToast('All notifications marked as read.');
      });

      document.getElementById('saveSettingsBtn').addEventListener('click', () => {
        const fullName = document.getElementById('officerName').value.trim() || state.settings.officerName;
        const email = document.getElementById('officerEmail').value.trim() || state.settings.officerEmail;
        const department = document.getElementById('departmentSetting').value.trim() || state.settings.department;
        const phone = document.getElementById('phoneSetting').value.trim() || state.settings.phone;
        const location = document.getElementById('locationSetting').value.trim() || state.settings.location;
        const managerEmployeeId = document.getElementById('managerEmployeeIdSetting').value.trim();
        const financeUser = window.FinStackStore ? window.FinStackStore.getCurrentUser() : null;

        if (window.FinStackStore && financeUser) {
          const result = window.FinStackStore.updateUser(financeUser.employeeId, {
            fullName,
            email,
            department,
            phone,
            location,
            managerEmployeeId
          });
          if (result && result.success === false) {
            return showToast(result.error || 'Unable to save settings.');
          }
        }

        state.settings.officerName = fullName;
        state.settings.officerEmail = email;
        state.settings.department = department;
        state.settings.employeeId = document.getElementById('employeeIdSetting').value.trim() || state.settings.employeeId;
        state.settings.phone = phone;
        state.settings.location = location;
        state.settings.organizationId = document.getElementById('organizationIdSetting').value.trim() || state.settings.organizationId;
        state.settings.managerEmployeeId = managerEmployeeId;
        state.settings.timezone = document.getElementById('timezoneSetting').value;
        state.settings.currency = document.getElementById('currencySetting').value;
        state.settings.theme = document.getElementById('themeSetting').value;
        state.settings.notes = document.getElementById('notesSetting').value.trim();
        state.settings.language = document.getElementById('languageSetting').value;
        state.settings.summaryTime = document.getElementById('summaryTimeSetting').value;
        state.settings.dateFormat = document.getElementById('dateFormatSetting').value;
        state.settings.landingPage = document.getElementById('landingPageSetting').value;
        state.settings.emailNotifications = readSwitch('emailNotificationsSetting');
        state.settings.highRiskAlerts = readSwitch('highRiskAlertsSetting');
        state.settings.weeklyDigest = readSwitch('weeklyDigestSetting');
        state.settings.soundAlerts = readSwitch('soundAlertsSetting');
        state.settings.twoFactor = readSwitch('twoFactorSetting');
        state.settings.loginAlerts = readSwitch('loginAlertsSetting');
        state.settings.riskConfirm = readSwitch('riskConfirmSetting');
        state.settings.sessionTimeoutEnabled = readSwitch('sessionTimeoutEnabled');
        state.settings.sessionTimeout = document.getElementById('sessionTimeoutSetting').value;
        state.settings.approvalConfirm = document.getElementById('approvalConfirmSetting').value;
        state.settings.sidebarDefaultCollapsed = readSwitch('sidebarDefaultCollapsed');
        state.settings.compactDensity = readSwitch('compactDensitySetting');
        setSidebarCollapsed(state.settings.sidebarDefaultCollapsed);
        document.body.classList.toggle('compact-density', state.settings.compactDensity);
        syncSettingsProfile();
        updateMetrics();
        logActivity('Finance Officer', 'Saved Settings', `${state.settings.officerName} / ${state.settings.currency} / ${state.settings.theme}`);
        showToast('Settings saved successfully.');
      });
      document.getElementById('resetSettingsBtn').addEventListener('click', () => {
        state.settings = {
          officerName: 'Rajesh Kumar',
          officerEmail: 'rajesh.kumar@finstack.io',
          department: 'Finance Operations',
          employeeId: 'FIN-2001',
          phone: '+91 90000 33333',
          location: 'Chennai, India',
          organizationId: 'finstack-tech-01',
          managerEmployeeId: '',
          timezone: 'Asia/Kolkata',
          currency: 'INR',
          theme: 'Dark',
          notes: 'Enable dual verification for flagged reimbursements before release. Review duplicate claim thresholds every Friday.',
          language: 'English (US)',
          summaryTime: '09:00 AM',
          dateFormat: 'DD MMM, YYYY',
          landingPage: 'Dashboard',
          emailNotifications: true,
          highRiskAlerts: true,
          weeklyDigest: true,
          soundAlerts: false,
          twoFactor: true,
          loginAlerts: true,
          riskConfirm: true,
          sessionTimeoutEnabled: true,
          sessionTimeout: '30 minutes',
          approvalConfirm: 'High',
          sidebarDefaultCollapsed: false,
          compactDensity: false
        };
        const financeUser = window.FinStackStore ? window.FinStackStore.getCurrentUser() : null;
        if (window.FinStackStore && financeUser) {
          window.FinStackStore.updateUser(financeUser.employeeId, {
            fullName: state.settings.officerName,
            email: state.settings.officerEmail,
            department: state.settings.department,
            phone: state.settings.phone,
            location: state.settings.location,
            managerEmployeeId: state.settings.managerEmployeeId
          });
        }
        applySettingsToForm();
        setSidebarCollapsed(false);
        document.body.classList.remove('compact-density');
        syncSettingsProfile();
        showToast('Settings reset.');
      });
      document.getElementById('editProfileBtn').addEventListener('click', () => showToast('Profile fields are ready to edit.'));
      document.getElementById('updatePasswordBtn').addEventListener('click', () => {
        const current = document.getElementById('currentPassword').value;
        const next = document.getElementById('newPassword').value;
        const confirm = document.getElementById('confirmPassword').value;
        if (!current || !next || !confirm) return showToast('Fill all password fields first.');
        if (next.length < 8) return showToast('New password must be at least 8 characters.');
        if (next !== confirm) return showToast('New passwords do not match.');
        const financeUser = window.FinStackStore ? window.FinStackStore.getCurrentUser() : null;
        if (window.FinStackStore && financeUser) {
          const result = window.FinStackStore.changePassword(financeUser.employeeId, current, next);
          if (!result || result.success === false) {
            return showToast(result && result.error ? result.error : 'Unable to update password.');
          }
        }
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        logActivity('Finance Officer', 'Updated Password', 'Account security');
        showToast('Password updated successfully.');
      });
      document.querySelectorAll('[data-toggle-password]').forEach(btn => {
        btn.addEventListener('click', () => {
          const input = document.getElementById(btn.dataset.togglePassword);
          input.type = input.type === 'password' ? 'text' : 'password';
        });
      });
      document.getElementById('downloadPolicyBtn').addEventListener('click', () => {
        downloadText('finstack-policy-summary.txt', `FinStack Policy Summary

1. Expense approvals must comply with policy thresholds.
2. Flagged claims require secondary review.
3. Payment batches require audit traceability.`);
        showToast('Policy summary downloaded.');
      });
      document.getElementById('openPrivacyBtn').addEventListener('click', () => openModal({ title: 'Privacy Notice', subtitle: 'Account and workspace data policy', icon: '⚖', body: detailMarkup({ 'Data retention': 'Expense and audit data are retained according to company policy.', 'Access visibility': 'Only authorized finance and compliance users can review sensitive records.', 'Exports': 'User-requested exports are logged for audit readiness.' }) }));
      document.getElementById('exportMyDataBtn').addEventListener('click', () => {
        downloadText('my-finstack-settings.txt', JSON.stringify(state.settings, null, 2));
        showToast('Your settings data has been exported.');
      });
      document.querySelectorAll('.session-revoke-btn').forEach(btn => btn.addEventListener('click', () => showToast('Selected session revoked.')));

      // profile drawer quick actions
      document.getElementById('openSettingsFromProfile').addEventListener('click', () => { setPage('settings-page'); closeDrawers(); showToast('Settings opened.'); });
      sidebarToggleBtn.addEventListener('click', () => setSidebarCollapsed(!appRoot.classList.contains('sidebar-collapsed')));
      sidebarExpandBtn.addEventListener('click', () => setSidebarCollapsed(false));
      document.getElementById('simulatePresenceBtn').addEventListener('click', () => { showToast('Profile status set to available.'); });
      document.getElementById('quickReviewQueueBtn').addEventListener('click', () => { closeDrawers(); setPage('finance-review-page'); showToast('Finance review queue opened.'); });
      document.getElementById('quickReportBtn').addEventListener('click', () => { closeDrawers(); setPage('reports-page'); showToast('Reports opened.'); });

      // initial render
      window.FinStackStore.ready.then(() => {
        syncSharedFinanceState();
        renderActivities(); renderAlerts(); renderExpenses(); renderReviews(); renderReconciliation(); renderTransactions(); renderFlagged(); renderPayments(); renderReports(); renderAudit(); updateMetrics();
        applySettingsToForm();
        const savedSidebar = localStorage.getItem('finstackSidebarCollapsed');
        if (savedSidebar === '1' || state.settings.sidebarDefaultCollapsed) setSidebarCollapsed(true);
        syncFinanceShellIcons();
        setPage(document.body?.dataset?.page || 'dashboard-page');
      });
    
