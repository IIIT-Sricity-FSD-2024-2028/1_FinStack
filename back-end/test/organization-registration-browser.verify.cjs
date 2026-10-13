const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { fork, spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { chromium } = require(process.env.FINSTACK_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..'), backend = path.join(root, 'back-end'), frontend = path.join(root, 'front-end');
require(path.join(backend, 'node_modules/dotenv')).config({path:path.join(backend,'.env'),quiet:true});
const testUrl = new URL(process.env.DATABASE_URL || '');
if(process.env.FINSTACK_CONFIGURATION_E2E !== '1' || !testUrl.searchParams.get('schema')?.startsWith('finstack_config_verify_')) throw Error('Use an explicitly disposable verification schema.');
const {PrismaClient} = require(path.join(backend,'node_modules/@prisma/client'));
const prisma = new PrismaClient({datasourceUrl:testUrl.toString()});
const argon2 = require(path.join(backend,'node_modules/argon2'));
const suffix = randomUUID().replaceAll('-',''), password = 'Browser-review-password!7';
const apiBase='http://127.0.0.1:3301', base='http://127.0.0.1:5580', adminBase='http://127.0.0.1:5173';
const output=path.join(backend,'.tmp'), results=[], pageErrors=[], organizations=[], permissionIds=[], consoleErrors=[], networkFailures=[];
let api, vite, server, browser, plan, staff, role;
const env={...process.env,NODE_ENV:'test',CORS_ORIGINS:base+','+adminBase,TENANT_JWT_ACCESS_SECRET:randomUUID()+randomUUID(),VITE_API_PROXY_TARGET:apiBase};
async function startApi(){api=fork(path.join(__dirname,'configuration-backend-harness.cjs'),[],{cwd:backend,env,stdio:['ignore','ignore','inherit','ipc']});await new Promise((resolve,reject)=>{api.once('message',resolve);api.once('exit',code=>reject(Error('Backend failed '+code)));});}
async function stopApi(){if(api?.connected)await new Promise(resolve=>{api.once('exit',resolve);api.send('stop');});}
async function fill(page, tag){
  const domain='browser-'+tag+'-'+suffix+'.org';
  await page.getByLabel('Legal organization name',{exact:true}).fill('Société Browser '+tag+' 株式会社');
  await page.getByLabel('Registration country',{exact:true}).selectOption('IN');
  await page.getByLabel('Government-issued registration identifier',{exact:true}).fill('BROWSER-'+tag+'-'+suffix);
  await page.getByLabel('Official organization email',{exact:true}).fill('office@'+domain);
  await page.getByLabel('Authorized contact first name',{exact:true}).fill('Alex');
  await page.getByLabel('Authorized contact last name',{exact:true}).fill('Lee');
  await page.getByLabel('Authorized contact title',{exact:true}).fill('Director');
  await page.getByLabel('Authorized contact email',{exact:true}).fill('alex@'+domain);
  await page.getByLabel('Password',{exact:true}).fill(password);await page.getByLabel('Confirm password',{exact:true}).fill(password);
  await page.getByLabel('Number of employees',{exact:true}).fill('3');await page.getByLabel('Plan',{exact:true}).selectOption(plan.id);
  return domain;
}
async function review(admin,id,decision){
  await admin.goto(adminBase+'/organizations/'+id);
  await admin.getByRole('heading',{name:'Organization registration review',exact:true}).waitFor();
  await admin.getByLabel('Decision',{exact:true}).selectOption(decision);
  await admin.getByLabel('Evidence checked and decision reason',{exact:true}).fill('Browser review: checked supplied identity and independent evidence; domain control remains unverified.');
  admin.once('dialog',dialog=>dialog.accept());
  const response=admin.waitForResponse(r=>r.url().endsWith('/registration-reviews') && r.request().method()==='POST');
  await admin.getByRole('button',{name:'Save review decision',exact:true}).click();assert.equal((await response).status(),201);
  await admin.getByText(decision,{exact:true}).waitFor();
}
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  plan=await prisma.plan.create({data:{key:'browser-review-'+suffix,name:'Disposable browser review '+suffix,billingInterval:'MONTHLY',basePrice:10,currency:'INR'}});
  role=await prisma.platformRole.create({data:{key:'browser-review-'+suffix,name:'Browser reviewer '+suffix}});
  for(const key of ['platform.organization.create','platform.organization.view','platform.organization.update','platform.organization.reactivate']){
    const p=await prisma.permission.upsert({where:{key},create:{key,description:key},update:{}});permissionIds.push(p.id);
    await prisma.platformRolePermission.create({data:{roleId:role.id,permissionId:p.id}});
  }
  staff=await prisma.platformStaff.create({data:{firstName:'Browser',lastName:'Reviewer',email:suffix+'@browser-review.org',passwordHash:await argon2.hash(password),roles:{create:{roleId:role.id}}}});
  await startApi();
  server=http.createServer((req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,base).pathname),target=path.resolve(frontend,'.'+pathname);if(!target.startsWith(frontend+path.sep)){res.writeHead(403).end();return;}
    let content=fs.readFileSync(target);const ext=path.extname(target);if(ext==='.html')content=Buffer.from(content.toString().replace('<head>',`<head><script>window.FINSTACK_API_BASE_URL="${apiBase}"</script>`));
    res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[ext]||'application/octet-stream'}).end(content);
  }catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(5580,'127.0.0.1',resolve));
  vite=spawn(process.execPath,[path.join(frontend,'admin/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5173','--strictPort'],{cwd:path.join(frontend,'admin'),env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  await new Promise((resolve,reject)=>{vite.stdout.on('data',data=>{if(data.toString().includes('5173'))resolve();});vite.once('exit',code=>reject(Error('Admin frontend failed '+code)));});
  browser=await chromium.launch({executablePath:process.env.FINSTACK_BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();page.on('pageerror',e=>pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});page.on('requestfailed',r=>networkFailures.push({url:new URL(r.url()).pathname,error:r.failure()?.errorText}));
  const traffic=[];page.on('request',r=>{if(r.url().startsWith(apiBase))traffic.push(r);});
  await require('./shared-onboarding-browser.check.cjs')({page,base,apiBase,output});
  await page.goto(base+'/views/shared/register.html');await page.locator('#reg-plan-id option').filter({hasText:plan.name}).waitFor({state:'attached'});
  assert.equal(await page.locator('#reg-submit').isDisabled(),true);
  await page.locator('#reg-org-name').focus();await page.locator('#reg-country').focus();assert.match(await page.locator('#reg-org-name-error').textContent(),/legal organization name/);
  await page.locator('#reg-registration-id').fill('<fake>');await page.locator('#reg-org-email').focus();assert.match(await page.locator('#reg-registration-id-error').textContent(),/issued identifier/);
  assert.equal(traffic.filter(r=>r.url().endsWith('/registrations/organizations')).length,0);
  results.push('Required and malformed fields show inline errors; invalid forms send no registration request.');
  await fill(page,'approved');assert.equal(await page.locator('#reg-submit').isEnabled(),true);
  await page.locator('#reg-password-toggle').click();assert.equal(await page.locator('#reg-password').getAttribute('type'),'text');assert.equal(await page.locator('#reg-confirm-password').getAttribute('type'),'password');await page.locator('#reg-password-toggle').click();await page.locator('#reg-confirm-password-toggle').click();assert.equal(await page.locator('#reg-confirm-password').getAttribute('type'),'text');assert.equal(await page.locator('#reg-password').getAttribute('type'),'password');await page.locator('#reg-confirm-password-toggle').click();
  await page.screenshot({path:path.join(output,'organization-registration-desktop.png'),fullPage:true});
  await page.route('**/registrations/organizations',route=>route.abort('failed'));await page.locator('#reg-submit').click();await page.locator('#reg-error').filter({hasText:'temporarily unavailable'}).waitFor();await page.unroute('**/registrations/organizations');
  let release;const held=new Promise(resolve=>{release=resolve;});let captured;const ready=new Promise(resolve=>{captured=resolve;});
  await page.route('**/registrations/organizations',async route=>{const response=await route.fetch();assert.equal(response.status(),201);const body=await response.json();organizations.push(body.data.organizationId);captured(body.data);await held;await route.fulfill({response});});
  await page.locator('#reg-password').press('Enter');const result=await ready;
  assert.equal(await page.locator('#reg-submit').isDisabled(),true);assert.equal(await page.locator('#reg-form').getAttribute('aria-busy'),'true');
  await page.locator('#reg-password').press('Enter');assert.equal(traffic.filter(r=>r.url().endsWith('/registrations/organizations')).length,2); // failed network + one real submission
  release();await page.locator('#success-card').waitFor();await page.unroute('**/registrations/organizations');
  assert.match(await page.locator('#success-message').textContent(),/no verification email was sent/i);
  assert.equal(await page.evaluate(()=>window.FinStackAuth?.getSession?.()?.accessToken||null),null);
  const pending=await prisma.organization.findUniqueOrThrow({where:{id:result.organizationId}});assert.equal(pending.registrationStatus,'PENDING_ORGANIZATION_REVIEW');assert.equal(pending.domainVerifiedAt,null);
  const receiptPlansBefore=traffic.filter(r=>r.url().endsWith('/tenant/onboarding/plans')).length;
  await page.reload();await page.locator('#success-card').waitFor();assert.equal(traffic.filter(r=>r.url().endsWith('/tenant/onboarding/plans')).length,receiptPlansBefore);assert.equal(await page.locator('#success-admin-emp-id').textContent(),result.employeeId);assert.equal(await page.evaluate(()=>sessionStorage.getItem('finstack.registration.employee-id')),result.employeeId);const receiptDownload=page.waitForEvent('download');await page.locator('#reg-save-receipt').click();const receipt=await receiptDownload;assert.match(fs.readFileSync(await receipt.path(),'utf8'),new RegExp(result.employeeId));assert.equal(fs.readFileSync(await receipt.path(),'utf8').includes(password),false);assert.equal((await prisma.organization.findUniqueOrThrow({where:{id:result.organizationId}})).registrationStatus,'PENDING_ORGANIZATION_REVIEW');
  results.push('Network failure recovers safely; Enter submits once while busy; real PostgreSQL submission remains pending and unverified after refresh, with no JWT or fake email claim.');
  await page.goto(base+'/login.html');await page.getByLabel('Employee ID',{exact:true}).fill(result.employeeId);await page.getByLabel('Password',{exact:true}).fill(password);await page.locator('#login-submit').click();await page.getByText('Employee ID or password is incorrect.',{exact:true}).waitFor();
  const adminContext=await browser.newContext({viewport:{width:1280,height:900}}),admin=await adminContext.newPage();admin.on('pageerror',e=>pageErrors.push(e.message));
  await admin.goto(adminBase+'/login');await admin.getByLabel('Work email',{exact:true}).fill(staff.email);await admin.getByLabel('Password',{exact:true}).fill(password);await admin.getByRole('button',{name:'Sign in',exact:true}).click();await admin.waitForURL(url=>!url.pathname.endsWith('/login'));
  await admin.goto(adminBase+'/organizations/new');
  await admin.getByRole('heading',{name:'New organization',exact:true}).waitFor();
  const trustedDomain='trusted-browser-'+suffix+'.org';
  await admin.getByLabel('Organization name',{exact:true}).fill('Trusted Admin browser organization');
  await admin.getByLabel('Primary email',{exact:true}).fill('office@'+trustedDomain);
  const adminCreate=admin.waitForResponse(r=>r.url().endsWith('/api/v1/platform/organizations')&&r.request().method()==='POST');
  await admin.getByRole('button',{name:'Create organization',exact:true}).click();
  const adminCreated=await adminCreate;assert.equal(adminCreated.status(),201);const trusted=(await adminCreated.json()).data;organizations.push(trusted.id);
  await admin.waitForURL('**/organizations/'+trusted.id);
  assert.equal((await prisma.organization.findUniqueOrThrow({where:{id:trusted.id}})).registrationStatus,'LEGACY_APPROVED');
  assert.equal(await prisma.platformAuditLog.count({where:{resourceId:trusted.id,actorStaffId:staff.id,action:'organization.provisioned'}}),1);
  await admin.goto(adminBase+'/organizations/new');await admin.getByRole('heading',{name:'New organization',exact:true}).waitFor();
  await admin.getByLabel('Organization name',{exact:true}).fill('Different name, same official domain');await admin.getByLabel('Primary email',{exact:true}).fill('other@'+trustedDomain);
  await admin.getByRole('button',{name:'Create organization',exact:true}).click();await admin.getByRole('alert').filter({hasText:'identity details already exists'}).waitFor();
  results.push('Trusted Admin creation works through the existing React form, records its actor audit and needs no second review; duplicate official-domain creation is rejected in the UI.');
  await admin.goto(adminBase+'/organizations/'+result.organizationId);await admin.getByRole('heading',{name:'Organization registration review',exact:true}).waitFor();
  assert.match(await admin.locator('body').innerText(),/Ownership unverified/);assert.equal(await admin.getByRole('button',{name:'Save review decision',exact:true}).isDisabled(),true);
  await admin.screenshot({path:path.join(output,'organization-review-desktop.png'),fullPage:true});
  await review(admin,result.organizationId,'APPROVED');assert.equal((await prisma.organization.findUniqueOrThrow({where:{id:result.organizationId}})).reviewedByStaffId,staff.id);
  await admin.reload();await admin.getByText('APPROVED',{exact:true}).waitFor();
  await stopApi();await startApi();
  await page.locator('#login-submit').click();await page.waitForURL('**/views/config-manager/dashboard.html');await page.reload();
  results.push('Actual Admin React login and controlled review form approve access; reviewer/audit data persists through refresh and backend process restart; tenant login then reaches its authorized dashboard.');
  await require('./config-manager-acceptance-browser.check.cjs')({page,prisma,organizationId:result.organizationId,base,apiBase,output,employeeId:result.employeeId,password,tokenSecret:env.TENANT_JWT_ACCESS_SECRET});
  results.push('The same publicly registered, Admin-approved organization completed the Configuration Manager acceptance navigation, fresh-state, responsive and persistent category/policy checks.');
  const beforeRequestUsers=await prisma.tenantUser.count({where:{organizationId:result.organizationId}});
  assert.equal(await page.evaluate(()=>{
    const store=window.FinStackStore;
    return store.getAccountRequests().length===0 && ['submitAccountRequest','approveAccountRequest','rejectAccountRequest'].every(method=>store[method]({requestedRole:'configuration_manager',password:'must-not-be-stored'}).success===false);
  }),true);
  assert.equal(await prisma.tenantUser.count({where:{organizationId:result.organizationId}}),beforeRequestUsers);
  await page.goto(base+'/views/shared/register.html');await page.locator('#success-card').waitFor();
  assert.equal(await page.locator('#success-admin-emp-id').textContent(),result.employeeId);
  await page.locator('#reg-start-another').click();assert.equal(await page.locator('#reg-form').isVisible(),true);
  assert.equal(await page.locator('#reg-password').inputValue(),'');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('finstack.registration.employee-id')),null);
  results.push('Employee ID receipt survives navigation and downloads without credentials; explicit new registration clears it. Legacy account request/approve/reject entry points fail closed and create no users.');

  const mobile=await browser.newContext({viewport:{width:375,height:812},isMobile:true,deviceScaleFactor:1}),mobilePage=await mobile.newPage();mobilePage.on('pageerror',e=>pageErrors.push(e.message));
  await mobilePage.goto(base+'/views/shared/register.html');await mobilePage.locator('#reg-plan-id option').filter({hasText:plan.name}).waitFor({state:'attached'});await fill(mobilePage,'rejected');
  assert.equal(await mobilePage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await mobilePage.screenshot({path:path.join(output,'organization-registration-mobile.png'),fullPage:true});
  const submitted=mobilePage.waitForResponse(r=>r.url().endsWith('/registrations/organizations')&&r.request().method()==='POST');await mobilePage.locator('#reg-submit').click();const rejectedResult=(await (await submitted).json()).data;organizations.push(rejectedResult.organizationId);await mobilePage.locator('#success-card').waitFor();
  await review(admin,rejectedResult.organizationId,'REJECTED');
  const rejected=await prisma.organization.findUniqueOrThrow({where:{id:rejectedResult.organizationId}});assert.equal(rejected.registrationStatus,'REJECTED');assert.equal(rejected.status,'CANCELLED');
  await mobilePage.goto(base+'/login.html');await mobilePage.getByLabel('Employee ID',{exact:true}).fill(rejectedResult.employeeId);await mobilePage.getByLabel('Password',{exact:true}).fill(password);await mobilePage.locator('#login-submit').click();await mobilePage.getByText('Employee ID or password is incorrect.',{exact:true}).waitFor();
  await admin.setViewportSize({width:375,height:812});await admin.goto(adminBase+'/organizations/'+rejectedResult.organizationId);await admin.getByText('REJECTED',{exact:true}).waitFor();assert.equal(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await admin.screenshot({path:path.join(output,'organization-review-mobile.png'),fullPage:true});
  results.push('Mobile registration has no horizontal overflow; actual Admin rejection persists and prevents tenant login. Desktop/mobile public and Admin layouts inspected.');
  assert.deepEqual(networkFailures.filter(r=>r.error!=='net::ERR_ABORTED' && !(r.url==='/api/v1/tenant/registrations/organizations' && r.error==='net::ERR_FAILED')),[]);
  assert.deepEqual(consoleErrors.filter(message=>!message.includes('401 (Unauthorized)') && !message.includes('net::ERR_FAILED')),[]);
  assert.deepEqual(pageErrors,[]);fs.writeFileSync(path.join(output,'organization-registration-browser-results.json'),JSON.stringify({schema:testUrl.searchParams.get('schema'),results,pageErrors,consoleErrors,networkFailures},null,2));console.log(JSON.stringify({results,pageErrors,consoleErrors,networkFailures},null,2));
})().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(async()=>{
  await browser?.close();await stopApi();if(vite&&!vite.killed){vite.kill();await new Promise(resolve=>vite.once('exit',resolve));}if(server)await new Promise(resolve=>server.close(resolve));
  if(organizations.length){const subs=await prisma.organizationSubscription.findMany({where:{organizationId:{in:organizations}},select:{id:true}}),invoices=await prisma.invoice.findMany({where:{organizationId:{in:organizations}},select:{id:true}});
    await prisma.expensePolicy.deleteMany({where:{organizationId:{in:organizations}}});await prisma.expenseCategory.deleteMany({where:{organizationId:{in:organizations}}});
    await prisma.invoice.deleteMany({where:{organizationId:{in:organizations}}});await prisma.organizationSubscription.deleteMany({where:{organizationId:{in:organizations}}});await prisma.organization.deleteMany({where:{id:{in:organizations}}});await prisma.platformAuditLog.deleteMany({where:{resourceId:{in:[...organizations,...subs.map(x=>x.id),...invoices.map(x=>x.id)]}}});}
  if(staff)await prisma.platformStaff.delete({where:{id:staff.id}});if(role)await prisma.platformRole.delete({where:{id:role.id}});
  await prisma.permission.deleteMany({where:{id:{in:permissionIds},roleAssignments:{none:{}}}});if(plan)await prisma.plan.delete({where:{id:plan.id}});await prisma.$disconnect();
});
