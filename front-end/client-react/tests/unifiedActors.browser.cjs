/* Five real SPA tabs, real Redux adapters and BroadcastChannel refresh.
 * All HTTP responses are fictional and intercepted; no backend/database is used.
 * Uses the same FINSTACK_* browser settings as the existing regression suites.
 */
const assert = require('node:assert/strict')
const { test } = require('node:test')
const { chromium } = require(process.env.FINSTACK_PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.FINSTACK_ACTOR_BASE_URL || 'http://127.0.0.1:5594'

test('five actor tabs share entity updates and complete the expense handoff while another tenant stays isolated', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.FINSTACK_CHROMIUM_PATH ? { executablePath: process.env.FINSTACK_CHROMIUM_PATH } : {}) })
  const context = await browser.newContext()
  const calls = [], errors = [], pages = {}, violations = []
  let expense = null
  const category = { id: 'travel', name: 'Travel', description: 'Fixture', status: 'Active', limit: 5000, currency: 'INR', requiresReceipt: false, color: '#7C3AED' }
  const actors = [
    ['config', 'CONFIGURATION_MANAGER', '/configuration/expense-categories'],
    ['submitter', 'EXPENSE_SUBMITTER', '/expenses'],
    ['manager', 'MANAGER', '/manager/expenses'],
    ['finance', 'FINANCE_OFFICER', '/finance/queue'],
    ['compliance', 'COMPLIANCE_OFFICER', '/compliance/queue'],
    ['other', 'EXPENSE_SUBMITTER', '/expenses'],
  ]
  const pageData = items => ({ items, total: items.length, totalPages: 1, page: 1, pageSize: 25, unreadCount: 0 })
  try {
    for (const [key, role, path] of actors) {
      const page = await context.newPage()
      pages[key] = page
      page.setDefaultTimeout(12000)
      const organizationId = key === 'other' ? 'org-b' : 'org-a'
      const user = { id: key, organizationId, employeeId: key.toUpperCase(), firstName: key, lastName: 'QA', role, status: 'ACTIVE', email: `${key}@fictional.test` }
      const session = { accessToken: `fictional-${key}`, organizationId, user }
      await page.addInitScript(session => {
        sessionStorage.setItem('finstackTenantAccessToken', session.accessToken)
        sessionStorage.setItem('finstackTenantUser', JSON.stringify(session.user))
      }, session)
      page.on('pageerror', error => errors.push(`${key}: ${error.message}`))
      page.on('console', message => { if (message.type() === 'error' && /non-serializable|uncaught|maximum update depth/i.test(message.text())) errors.push(`${key}: ${message.text()}`) })
      await page.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url()), method = req.method(), path = url.pathname
        if (url.origin !== base) return route.abort()
        if (!path.startsWith('/api/')) return route.continue()
        calls.push({ key, path, method })
        const json = (data, status = 200) => route.fulfill({ status, json: status < 400 ? { data } : { error: { message: data } } })
        if (req.headers().authorization !== `Bearer fictional-${key}`) { violations.push('wrong bearer identity'); return json('Forbidden', 403) }
        const ownExpense = expense && organizationId === 'org-a' ? expense : null
        if (path.endsWith('/auth/me')) return json({ user, organizationId })
        if (path.endsWith('/settings/preferences')) return json({ theme: 'dark', pageSize: 25, autoRefresh: false, desktopNotifications: false })
        if (path.endsWith('/configuration/categories')) {
          if (role !== 'CONFIGURATION_MANAGER') { violations.push('configuration access'); return json('Forbidden', 403) }
          return json([category])
        }
        if (path.endsWith('/configuration/categories/travel') && method === 'PATCH') {
          if (role !== 'CONFIGURATION_MANAGER') { violations.push('category write'); return json('Forbidden', 403) }
          Object.assign(category, req.postDataJSON()); return json(category)
        }
        if (path.endsWith('/configuration/templates')) return json({ version: 'v1', defaultCurrency: 'INR', categories: [], policies: [] })
        if (path.endsWith('/categories')) return json([{ ...category, ...(key === 'other' ? { name: 'Other Tenant Category' } : {}) }])
        if (path.endsWith('/policies')) return json([])
        if (path.endsWith('/notifications/unread-count')) return json({ count: 0 })
        if (path.endsWith('/notifications/page')) return json(pageData([]))
        if (path.endsWith('/notifications')) return json([])
        if (path.endsWith('/configuration/audit-logs')) return json(pageData([]))
        if (path.endsWith('/manager/finance-officers')) return json([{ id: 'finance', employeeId: 'FINANCE', fullName: 'finance QA', firstName: 'finance', lastName: 'QA' }])
        if (path.endsWith('/mine')) return json(ownExpense ? [ownExpense] : [])
        if (path.endsWith('/manager/queue')) return json(ownExpense?.workflowStatus === 'manager_review' ? [ownExpense] : [])
        if (path.endsWith('/manager/history')) return json(ownExpense && ownExpense.workflowStatus !== 'manager_review' ? [ownExpense] : [])
        if (path.endsWith('/finance/workspace')) return json({ expenses: ownExpense ? [ownExpense] : [], transactions: [] })
        if (path.endsWith('/finance/queue')) return json(ownExpense?.workflowStatus === 'finance_review' ? [ownExpense] : [])
        if (path.endsWith('/compliance/queue')) return json(ownExpense?.workflowStatus === 'compliance_review' ? [ownExpense] : [])
        if (path === '/api/v1/tenant/expenses' && method === 'POST') {
          if (role !== 'EXPENSE_SUBMITTER' || key === 'other') { violations.push('expense creation'); return json('Forbidden', 403) }
          expense = { id: 'EXP-FLOW', organizationId, employeeId: 'SUBMITTER', employee: { fullName: 'submitter QA' }, managerEmployeeId: 'MANAGER',
            amount: '12.50', currency: 'INR', categoryId: 'travel', category: category.name, merchant: 'Cross-actor Merchant', date: '2026-11-25',
            createdAt: '2026-11-25T08:00:00Z', workflowStatus: 'manager_review', riskScore: 20, history: [], notes: 'Fictional flow' }
          return json(expense)
        }
        if (path.endsWith('/manager/approve')) {
          if (role !== 'MANAGER' || expense?.workflowStatus !== 'manager_review') { violations.push('manager handoff'); return json('Invalid handoff', 409) }
          assert.equal(req.postDataJSON().financeOfficerId, 'finance')
          expense = { ...expense, workflowStatus: 'finance_review', managerDecision: 'Approved', assignedFinanceOfficerId: 'finance' }
          return json(expense)
        }
        if (path.endsWith('/finance/flag')) {
          if (role !== 'FINANCE_OFFICER' || expense?.workflowStatus !== 'finance_review') { violations.push('finance handoff'); return json('Invalid handoff', 409) }
          expense = { ...expense, workflowStatus: 'compliance_review', financeDecision: 'Flagged' }
          return json(expense)
        }
        if (path.endsWith('/compliance/approve')) {
          if (role !== 'COMPLIANCE_OFFICER' || expense?.workflowStatus !== 'compliance_review') { violations.push('compliance handoff'); return json('Invalid handoff', 409) }
          expense = { ...expense, workflowStatus: 'finance_review', complianceDecision: 'Approved' }
          return json(expense)
        }
        return json('Unconfigured intercepted route: ' + path, 404)
      })
      await page.goto(base + path)
      await page.waitForLoadState('networkidle')
      // Resolve the module imported by the real entry, including Vite's HMR
      // timestamp. Importing an unversioned URL can create a test-only instance.
      await page.evaluate(async () => {
        const main = await (await fetch('/client-react/src/main.jsx')).text()
        const url = main.match(/import \{ store, installReduxRuntime \} from "([^"]+)"/)[1]
        window.__integrationStore = (await import(url)).store
        window.__tenantRefreshSignals = 0
        window.addEventListener('finstack:live-refresh', () => { window.__tenantRefreshSignals++ })
      })
      assert.equal(await page.getByText('This page could not be displayed', { exact: true }).count(), 0, key)
    }
    const otherReads = () => calls.filter(call => call.key === 'other').length
    const isolatedReads = otherReads()
    await pages.config.evaluate(async () => {
      const store = window.__integrationStore
      const { createConfigCommands } = await import('/client-react/src/features/config-manager/useConfigResource.js')
      await createConfigCommands(store.dispatch, store.getState().sessionBoundary.scope).categories.update('travel', { name: 'Updated Travel' })
    })
    await pages.submitter.getByRole('option', { name: 'Updated Travel', exact: true }).waitFor({ state: 'attached' })
    await pages.finance.getByRole('option', { name: 'Updated Travel', exact: true }).waitFor({ state: 'attached' })
    assert.equal(otherReads(), isolatedReads, 'Other tenant must ignore the cross-tab signal')
    await pages.submitter.evaluate(async () => {
      const store = window.__integrationStore
      const { createExpense } = await import('/client-react/src/features/submitter/store/submitterActions.js')
      await store.dispatch(createExpense({ amount: '12.50', merchant: 'Cross-actor Merchant', categoryId: 'travel', date: '2026-11-25', currency: 'INR' }, null))
    })
    await pages.manager.getByText('Cross-actor Merchant', { exact: true }).waitFor()
    const managerReads = calls.filter(call => call.key === 'manager' && call.path.endsWith('/manager/queue')).length
    // Use the actual confirmation flow for the Manager handoff.
    await pages.manager.getByRole('link', { name: 'Review', exact: true }).click()
    await pages.manager.getByLabel(/Finance Officer/i).selectOption('finance')
    await pages.manager.getByRole('button', { name: 'Approve', exact: true }).click()
    await pages.manager.getByRole('dialog').getByRole('button', { name: /Confirm|Approve/i }).click()
    await pages.finance.getByText('Cross-actor Merchant', { exact: true }).first().waitFor()
    assert.ok(calls.filter(call => call.key === 'manager' && call.path.endsWith('/manager/queue')).length <= managerReads + 2, 'Decision should not duplicate tag-owned reads')
    await pages.finance.evaluate(async () => {
      const store = window.__integrationStore
      const { financeApiSlice } = await import('/client-react/src/features/finance/financeApiSlice.js')
      await store.dispatch(financeApiSlice.endpoints.financeFlagExpense.initiate({ expenseId: 'EXP-FLOW', note: 'Please review' })).unwrap()
    })
    await pages.compliance.getByText('EXP-FLOW', { exact: true }).first().waitFor()
    await pages.compliance.evaluate(async () => {
      const store = window.__integrationStore
      const { decideExpense } = await import('/client-react/src/features/compliance/store/complianceSlice.js')
      await store.dispatch(decideExpense({ expenseId: 'EXP-FLOW', type: 'approve', note: 'Reviewed' }))
    })
    await pages.finance.getByText('Cross-actor Merchant', { exact: true }).first().waitFor()
    await pages.submitter.waitForFunction(async () => {
      const store = window.__integrationStore
      return store.getState().submitter.expenses.items[0]?.workflowStatus === 'finance_review'
    })
    assert.equal(await pages.other.evaluate(() => window.__tenantRefreshSignals), 0, 'Other tenant must receive no change signal, independently of legitimate polling')
    assert.equal(await pages.other.getByText('Cross-actor Merchant', { exact: true }).count(), 0)
    for (const [key, page] of Object.entries(pages)) {
      assert.equal(await page.evaluate(async () => { const store = window.__integrationStore; return JSON.stringify(store.getState()).includes('fictional-') }), false, key + ' must not cache tokens')
    }
    assert.deepEqual(violations, [])
    assert.deepEqual(errors, [])
    console.log('All five live actor views synchronized over BroadcastChannel: category update, expense submission, confirmed Manager approval, Finance flag, Compliance approval, return to Finance; second tenant ignored every signal. HTTP was intercepted; no database accessed.')
  } catch (error) {
    console.error({ errors, violations, recentCalls: calls.slice(-12), managerBody: pages.manager ? (await pages.manager.locator('body').innerText()).slice(-2500) : '' })
    throw error
  } finally { await context.close(); await browser.close() }
})
