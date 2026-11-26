/* Real SPA regression with intercepted APIs; no backend/database access.
 * Run against npm run dev on port 5582 with FINSTACK_PLAYWRIGHT_MODULE and,
 * if necessary, FINSTACK_CHROMIUM_PATH pointing to an installed browser.
 */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { chromium } = require(process.env.FINSTACK_PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.FINSTACK_ACTOR_BASE_URL || 'http://127.0.0.1:5582'
const prefs = { theme: 'dark', compactMode: false, animations: true, language: 'en-US', dateFormat: 'DD/MM/YYYY', timezone: 'Asia/Kolkata', numberLocale: 'en-US', desktopNotifications: false, defaultView: 'dashboard', pageSize: 25, autoRefresh: false }

test('Configuration Manager Redux preserves employee workflows and all configuration routes', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.FINSTACK_CHROMIUM_PATH ? { executablePath: process.env.FINSTACK_CHROMIUM_PATH } : {}) })
  const context = await browser.newContext()
  const page = await context.newPage()
  const errors = [], calls = []
  const user = { id: 'cfg', organizationId: 'org-test', employeeId: 'CFG-TEST', firstName: 'Config', lastName: 'Manager', email: 'cfg@fixture.test', role: 'CONFIGURATION_MANAGER', status: 'ACTIVE' }
  let employees = Array.from({ length: 28 }, (_, i) => ({ id: `e${i}`, employeeId: `EMP-${i}`, firstName: i === 0 ? 'Alpha' : 'Beta', lastName: String(i), fullName: `${i === 0 ? 'Alpha' : 'Beta'} ${i}`, email: `user${i}@fixture.test`, department: 'General', role: 'EXPENSE_SUBMITTER', status: 'ACTIVE', manager: null, managerId: null, directReportCount: 0, ancestors: [] }))
  const manager = { ...employees[1], id: 'manager', role: 'MANAGER', firstName: 'Pat', lastName: 'Manager', fullName: 'Pat Manager', employeeId: 'MGR-1' }
  let failEmployees = false, importJob = null
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()) })
  await page.addInitScript(user => {
    sessionStorage.setItem('finstackTenantAccessToken', 'fixture-token')
    sessionStorage.setItem('finstackTenantUser', JSON.stringify(user))
  }, user)
  const paged = (items, query) => {
    const current = Number(query.get('page') || 1), size = Number(query.get('pageSize') || 25)
    return { items: items.slice((current - 1) * size, current * size), total: items.length, page: current, pageSize: size, totalPages: Math.ceil(items.length / size), hasNextPage: current * size < items.length, hasPreviousPage: current > 1 }
  }
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method()
    if (url.origin !== base) return route.abort()
    if (!path.startsWith('/api/')) return route.continue()
    calls.push({ path, method, query: url.searchParams.toString(), body: (req.headers()['content-type'] || '').includes('application/json') ? req.postDataJSON() : null, authorization: req.headers().authorization })
    const json = (data, status = 200) => route.fulfill({ status, json: status < 400 ? { data } : { error: { message: data } } })
    if (path.endsWith('/auth/me')) return json({ user, organizationId: user.organizationId })
    if (path.endsWith('/settings/preferences')) return json(prefs)
    if (path.endsWith('/configuration/roles')) return json({ items: ['CONFIGURATION_MANAGER', 'EXPENSE_SUBMITTER', 'MANAGER'].map(key => ({ key, name: key, capabilities: ['Read'], userCount: 1 })) })
    if (path.endsWith('/configuration/employees')) {
      if (failEmployees) return json('Unavailable fixture', 503)
      const search = url.searchParams.get('search') || ''
      let items = url.searchParams.get('role') === 'MANAGER' ? [manager] : employees
      items = items.filter(item => item.fullName.toLowerCase().includes(search.toLowerCase()) && (!url.searchParams.get('status') || item.status === url.searchParams.get('status')))
      // Let a superseded search resolve after the current search.
      if (search === 'Alpha') await new Promise(resolve => setTimeout(resolve, 650))
      return json(paged(items, url.searchParams))
    }
    if (path.endsWith('/configuration/users') && method === 'POST') {
      const body = req.postDataJSON(), created = { ...body, id: 'new', employeeId: 'EMP-NEW', fullName: `${body.firstName} ${body.lastName}`, status: 'ACTIVE', manager: body.managerId ? manager : null, managerId: body.managerId || null, directReportCount: 0, ancestors: [] }
      employees = [created, ...employees]
      return json(created)
    }
    if (/\/configuration\/users\/[^/]+(?:\/status|\/reporting)?$/.test(path)) {
      const id = path.split('/users/')[1].split('/')[0], body = req.postDataJSON()
      employees = employees.map(item => item.id !== id ? item : { ...item, ...body, fullName: body.firstName ? `${body.firstName} ${body.lastName}` : item.fullName, ...(path.endsWith('/reporting') ? { manager: body.managerId ? manager : null } : {}) })
      return json(employees.find(item => item.id === id))
    }
    if (path.endsWith('/hierarchy')) return json({ total: employees.length, active: employees.length, unassigned: employees.length, inactiveManagers: 0, departments: [{ name: 'General', total: employees.length }], departmentTotalPages: 1 })
    if (path.endsWith('/hierarchy/branches')) return json(paged(url.searchParams.get('view') === 'CANDIDATES' ? [manager] : employees, url.searchParams))
    if (path.includes('/hierarchy/employees/')) return json(employees.find(item => item.id === path.split('/').pop()))
    if (path.endsWith('/configuration/categories') || path.endsWith('/configuration/policies')) return json([])
    if (path.endsWith('/configuration/templates')) return json({ version: 'v1', defaultCurrency: 'INR', categories: [], policies: [] })
    if (path.endsWith('/configuration/audit-logs')) return json({ ...paged([], url.searchParams), total: 0 })
    if (path.endsWith('/configuration/employee-imports')) {
      if (method === 'POST') importJob = { id: 'job-1', status: 'READY', createdAt: '2026-11-01T00:00:00Z', totalCount: 1, validCount: 1, invalidCount: 0, processedCount: 0, successfulCount: 0, failedCount: 0 };
      return json(method === 'POST' ? importJob : importJob ? [importJob] : [])
    }
    if (path.endsWith('/employee-imports/job-1/rows')) return json([])
    if (path.endsWith('/employee-imports/job-1/confirm')) { importJob = { ...importJob, status: 'QUEUED' }; return json(importJob) }
    if (path.endsWith('/employee-imports/job-1')) {
      if (importJob.status === 'QUEUED') {
        importJob = { ...importJob, status: 'COMPLETED', processedCount: 1, successfulCount: 1 }
        employees = [{ ...employees[0], id: 'imported', employeeId: 'EMP-IMPORT', firstName: 'Imported', lastName: 'Worker', fullName: 'Imported Worker', credentialSetupRequired: true }, ...employees]
      }
      return json(importJob)
    }
    if (path.endsWith('/notifications/page')) return json({ ...paged([], url.searchParams), unreadCount: 0 })
    if (path.endsWith('/settings/organization')) return json({ id: 'org-test', name: 'Fixture Org', primaryEmail: 'cfg@fixture.test', defaultCurrency: 'INR', timezone: 'Asia/Kolkata', registrationIdentifier: 'FIX', taxId: '', address: '', companySize: 'SMALL', fiscalYearStart: 'APRIL', defaultPaymentMethod: 'BANK_TRANSFER' })
    if (path.endsWith('/settings/profile')) return json({ ...user, phone: '', location: '', department: 'General', avatarColor: '#7C3AED' })
    if (path.endsWith('/subscription')) return json({ organization: { name: 'Fixture Org' }, plan: { id: 'p1', name: 'Fixture Plan', includedEmployeeCount: 50, features: [], basePrice: '100' }, employeeCount: 50, status: 'ACTIVE', priceAtSubscription: '100', employeeAmount: '0', featureAmount: '0', currency: 'INR', billingInterval: 'MONTHLY', selectedAddOns: [], currentPeriodStart: '2026-11-01', currentPeriodEnd: '2026-12-01' })
    if (path.endsWith('/subscription/invoices') || path.endsWith('/subscription/payments')) return json({ items: [] })
    return json('Unconfigured fixture ' + path, 404)
  })
  const employeeCalls = () => calls.filter(call => call.path.endsWith('/configuration/employees') && !call.query.includes('role=MANAGER'))
  const navigate = async path => { await page.goto(base + path); await page.locator('.configuration-workspace').waitFor(); await page.waitForLoadState('networkidle') }
  try {
    await navigate('/configuration/manage-users')
    await page.getByRole('button', { name: 'Edit Alpha 0', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.getByText('Page 2 of 2', { exact: true }).waitFor()
    await page.getByLabel('Filter by role', { exact: true }).selectOption('EXPENSE_SUBMITTER')
    await page.getByText('Page 1 of 2', { exact: true }).waitFor()
    const count = employeeCalls().length
    await page.getByLabel('Search users', { exact: true }).fill('Alpha')
    await page.waitForTimeout(120)
    assert.equal(employeeCalls().length, count, 'Search is debounced')
    await page.waitForTimeout(230)
    await page.getByLabel('Search users', { exact: true }).fill('Beta')
    await page.getByRole('button', { name: 'Edit Beta 1', exact: true }).waitFor()
    await page.waitForTimeout(750)
    assert.equal(await page.getByRole('button', { name: 'Edit Alpha 0', exact: true }).count(), 0, 'Late search must not replace current results')
    await page.getByLabel('Search users', { exact: true }).fill('')
    await page.getByRole('button', { name: 'Edit Alpha 0', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Add User', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('First Name', { exact: true }).fill('  ')
    await dialog.getByLabel('Last Name', { exact: true }).fill('User')
    await dialog.getByLabel('Email Address', { exact: true }).fill('new@fixture.test')
    await dialog.getByLabel('Temporary Password', { exact: true }).fill('fixture-password')
    await dialog.getByRole('button', { name: 'Add User', exact: true }).click()
    await dialog.locator('#employee-error-firstName').waitFor()
    await dialog.getByLabel('First Name', { exact: true }).fill('New')
    await dialog.getByLabel('Assign Manager', { exact: true }).selectOption('manager')
    await dialog.getByRole('button', { name: 'Add User', exact: true }).click()
    await page.getByText('EMP-NEW', { exact: true }).first().waitFor()
    await page.getByRole('button', { name: 'Edit New User', exact: true }).click()
    await dialog.getByLabel('First Name', { exact: true }).fill('Changed')
    await dialog.getByRole('button', { name: 'Save Changes', exact: true }).click()
    await page.getByRole('button', { name: 'Disable Changed User', exact: true }).click()
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    assert.equal(calls.filter(call => call.path.endsWith('/new/status')).length, 0)
    await page.getByRole('button', { name: 'Disable Changed User', exact: true }).click()
    await dialog.getByRole('button', { name: 'Disable employee', exact: true }).click()
    await page.getByRole('button', { name: 'Enable Changed User', exact: true }).waitFor()
    assert.equal(calls.find(call => call.path.endsWith('/new/status')).body.status, 'INACTIVE')
    await page.evaluate(prefs => { localStorage.setItem('finstack-preferences:org-test:cfg', JSON.stringify({ ...prefs, pageSize: 50 })); window.dispatchEvent(new Event('finstack:preferences')) }, prefs)
    await page.getByText('Page 1 of 1', { exact: true }).waitFor()
    assert.ok(employeeCalls().some(call => call.query.includes('pageSize=50')))
    await page.getByRole('button', { name: 'Bulk Import', exact: true }).click()
    await page.getByText('No import jobs yet.', { exact: true }).waitFor()
    await page.locator('#employee-import-file').setInputFiles({ name: 'employees.csv', mimeType: 'text/csv', buffer: Buffer.from('firstName,lastName,email\nImported,Worker,import@fixture.test') })
    await page.getByRole('button', { name: 'Validate CSV', exact: true }).click()
    await page.getByLabel(/I reviewed the rows/).check()
    await page.getByRole('button', { name: 'Confirm import', exact: true }).click()
    await page.getByText('Import completed', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Edit Imported Worker', exact: true }).waitFor()
    // All additional Configuration Manager routes render with the same auth/store.
    for (const path of ['dashboard', 'roles-access', 'expense-categories', 'expense-policies', 'audit-logs', 'notifications', 'organization-settings', 'profile-settings', 'preferences', 'subscription', 'user-hierarchy']) {
      await navigate('/configuration/' + path)
      assert.equal(await page.getByText('This page could not be displayed', { exact: true }).count(), 0, path + JSON.stringify(errors))
    }
    // Hierarchy writes keep the existing expected-manager concurrency payload.
    await page.locator('.hierarchy-person-details').filter({ hasText: 'Alpha 0' }).click()
    await page.getByRole('button', { name: 'Change manager', exact: true }).click()
    await page.getByLabel('Reporting manager', { exact: true }).selectOption('manager')
    await page.getByRole('button', { name: 'Save manager', exact: true }).click()
    await page.getByText('Reporting manager saved.', { exact: true }).waitFor()
    assert.deepEqual(calls.find(call => call.path.endsWith('/e0/reporting')).body, { managerId: 'manager', expectedManagerId: null })
    // Initial loading/error/retry states retain the existing UI contract.
    failEmployees = true
    await navigate('/configuration/manage-users')
    await page.getByText('Users could not be loaded.', { exact: true }).waitFor()
    failEmployees = false
    await page.getByRole('button', { name: 'Try Again', exact: true }).click()
    await page.getByRole('button', { name: 'Edit Alpha 0', exact: true }).waitFor()
    assert.deepEqual(errors, [])
    assert.ok(calls.every(call => call.authorization === 'Bearer fixture-token'))
    console.log('Employee CRUD, validation, manager selection, debounce/stale search, pagination/filter resets, preferences, confirmation/status, imports, hierarchy, error/retry and 11 additional route checks passed with mocked APIs.')
  } catch (error) { console.error({ errors, body: (await page.locator("body").innerText()).slice(-5000), calls: calls.slice(-14) }); throw error } finally { await context.close(); await browser.close() }
})
