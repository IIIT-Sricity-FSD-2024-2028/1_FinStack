const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const backend=path.resolve(__dirname,'..');
const state=JSON.parse(fs.readFileSync(path.join(backend,'.tmp/manual-qa/environment.json'),'utf8'));
require('../dist/src/common/config/manual-qa').manualQaSettings(state.env);
const {PrismaClient}=require('@prisma/client');
const ordinary=require('dotenv').parse(fs.readFileSync(path.join(backend,'.env')));
const verification=JSON.parse(fs.readFileSync(path.join(backend,'.tmp/manual-qa-verification/state.json')));
const normalUrl=new URL(ordinary.DATABASE_URL);normalUrl.searchParams.set('schema',verification.schema);
assert(verification.schema.startsWith('finstack_config_verify_'));
const db=new PrismaClient({datasourceUrl:state.env.DATABASE_URL}),publicDb=new PrismaClient({datasourceUrl:ordinary.DATABASE_URL});
const output=path.join(backend,'.tmp/manual-qa-verification');
const {chromium}=require(process.env.FINSTACK_PLAYWRIGHT_MODULE||'C:/Users/nikhi/AppData/Local/ms-playwright-go/1.57.0/package');
const api='http://127.0.0.1:3401',base='http://127.0.0.1:5581',adminBase='http://127.0.0.1:5174';
const suffix=crypto.randomUUID().slice(0,8),password=crypto.randomBytes(24).toString('base64url')+'!Q7';
const children=[],logs=[],checks=[],pageErrors=[];let browser,qa,normal;
function launch(action){const fd=fs.openSync(path.join(output,'manual-'+action+'.log'),'w');logs.push(fd);const child=cp.fork(path.join(backend,'scripts/manual-qa.cjs'),[action],{cwd:backend,stdio:['ignore',fd,fd,'ipc'],env:{...process.env}});children.push(child);return child;}
async function ready(child,message){await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Startup timeout: '+message)),20000);child.on('message',m=>{if(m===message){clearTimeout(timer);resolve();}});child.once('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code));});});}
async function waitHttp(url){for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('HTTP startup timeout '+url);}
async function counts(){const result={};for(const model of ['organization','tenantUser','expenseCategory','expensePolicy','tenantAuditLog','tenantNotification','platformStaff','platformRole','permission','plan','platformAuditLog'])result[model]=await publicDb[model].count();return result;}
async function stop(child,message){if(!child||child.exitCode!==null)return;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(Error('Shutdown timeout'));},20000);child.once('exit',()=>{clearTimeout(timer);resolve();});if(message&&child.connected)child.send(message);else child.kill();});}
(async()=>{
  const before=await counts();
  qa=launch('backend');await ready(qa,'manual-qa-ready');
  launch('client');launch('admin');await Promise.all([waitHttp(base+'/index.html'),waitHttp(adminBase+'/login')]);
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();page.on('pageerror',e=>pageErrors.push(e.message));
  assert.equal((await (await page.request.get(api+'/api/v1/tenant/onboarding/environment')).json()).data.manualQa,true);
  assert.equal((await page.request.get(api+'/api/v1/tenant/onboarding/environment',{headers:{Host:'remote.example.org'}})).status(),403);
  assert.equal((await page.request.get(api+'/api/v1/tenant/onboarding/environment',{headers:{Origin:'https://remote.example.org'}})).status(),403);
  await page.goto(base+'/views/shared/register.html');await page.locator('#reg-manual-qa').waitFor();await page.locator('#reg-plan-id option').filter({hasText:'Local QA plan (fictional)'}).waitFor({state:'attached'});
  const plan=await db.plan.findUniqueOrThrow({where:{key:'manual-qa-plan'}});
  for(const [id,value]of Object.entries({'reg-org-name':'Fictional manual QA '+suffix,'reg-exemption':'Local QA only: fictional entity without any real government registration.','reg-org-email':'office@manual-'+suffix+'.test','reg-first-name':'Alex','reg-last-name':'Tester','reg-contact-title':'Local QA contact','reg-admin-email':'alex@manual-'+suffix+'.test','reg-password':password,'reg-confirm-password':password,'reg-employee-count':'3'}))await page.locator('#'+id).fill(value);
  await page.locator('#reg-country').selectOption('IN');await page.locator('#reg-plan-id').selectOption(plan.id);
  await page.locator('#reg-admin-email').fill('alex@another.test');await page.locator('#reg-password').focus();assert.equal(await page.locator('#reg-submit').isDisabled(),true);
  await page.locator('#reg-admin-email').fill('alex@manual-'+suffix+'.test');assert.equal(await page.locator('#reg-submit').isEnabled(),true);
  await page.setViewportSize({width:375,height:812});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(output,'qa-registration-mobile.png'),fullPage:true});
  const submitted=page.waitForResponse(r=>r.url().endsWith('/registrations/organizations')&&r.request().method()==='POST');await page.locator('#reg-submit').click();const response=await submitted;assert.equal(response.status(),201);const payload=response.request().postDataJSON(),result=(await response.json()).data;await page.locator('#success-card').waitFor();
  const organization=await db.organization.findUniqueOrThrow({where:{id:result.organizationId}});assert.equal(organization.registrationStatus,'PENDING_ORGANIZATION_REVIEW');assert.equal(organization.domainVerifiedAt,null);
  assert.equal((await page.request.post(api+'/api/v1/tenant/registrations/organizations',{data:payload})).status(),409);
  assert.equal((await page.request.post(api+'/api/v1/tenant/registrations/organizations',{data:{...payload,primaryEmail:'office@fictional.example',email:'alex@fictional.example'}})).status(),400);
  assert.equal((await page.request.post(api+'/api/v1/tenant/registrations/organizations',{data:{...payload,name:'',role:'CONFIGURATION_MANAGER'}})).status(),400);
  checks.push('Actual QA browser accepts fictional .test registration; contact-domain validation, duplicate 409 and reserved .example/invalid-field 400 remain real. No domain verification is asserted.');
  await page.goto(base+'/login.html');await page.locator('#employee-id').fill(result.employeeId);await page.locator('#password-input').fill(password);await page.locator('#login-submit').click();await page.getByText('Employee ID or password is incorrect.',{exact:true}).waitFor();
  const admin=await context.newPage();admin.on('pageerror',e=>pageErrors.push(e.message));await admin.goto(adminBase+'/login');await admin.getByLabel('Work email',{exact:true}).fill(state.reviewer.email);await admin.getByLabel('Password',{exact:true}).fill(state.reviewer.password);await admin.getByRole('button',{name:'Sign in',exact:true}).click();await admin.waitForURL(u=>!u.pathname.endsWith('/login'));
  await admin.goto(adminBase+'/organizations/'+result.organizationId);await admin.getByRole('heading',{name:'Organization registration review',exact:true}).waitFor();await admin.getByLabel('Decision',{exact:true}).selectOption('APPROVED');await admin.getByLabel('Evidence checked and decision reason',{exact:true}).fill('Local QA only. Fictional scenario; no legal identity or domain ownership verified. Approve isolated tenant access for manual testing.');admin.once('dialog',d=>d.accept());const reviewed=admin.waitForResponse(r=>r.url().endsWith('/registration-reviews')&&r.request().method()==='POST');await admin.getByRole('button',{name:'Save review decision',exact:true}).click();assert.equal((await reviewed).status(),201);
  await page.locator('#login-submit').click();await page.waitForURL('**/views/config-manager/dashboard.html');
  await page.goto(base+'/views/config-manager/expense-categories.html');await page.getByRole('button',{name:'Add Category',exact:true}).click();await page.locator('#category-name').fill('Manual QA category '+suffix);await page.getByRole('button',{name:'Save Category',exact:true}).click();await page.getByText('Manual QA category '+suffix,{exact:true}).waitFor();
  assert.equal(await db.expenseCategory.count({where:{organizationId:result.organizationId,name:'Manual QA category '+suffix}}),1);assert.equal(await db.tenantAuditLog.count({where:{organizationId:result.organizationId,eventCode:'category.created'}}),1);
  await stop(qa,'manual-qa-stop');qa=launch('backend');await ready(qa,'manual-qa-ready');await page.reload();await page.getByText('Manual QA category '+suffix,{exact:true}).waitFor();
  checks.push('Actual Admin reviewer approval, pending-login denial, Employee-ID login and Config Manager category/audit persistence pass, including full QA backend restart.');
  normal=cp.fork(path.join(__dirname,'configuration-backend-harness.cjs'),[],{cwd:backend,env:{...process.env,...ordinary,DATABASE_URL:normalUrl.toString(),NODE_ENV:'test',FINSTACK_MANUAL_QA:'',FINSTACK_MANUAL_QA_BIND_HOST:''},stdio:['ignore','ignore','inherit','ipc']});await ready(normal,'ready');
  const strict=await page.request.post('http://127.0.0.1:3301/api/v1/tenant/registrations/organizations',{data:payload});assert.equal(strict.status(),400);assert.match(JSON.stringify(await strict.json()),/publicly usable organization domain/);assert.equal((await (await page.request.get('http://127.0.0.1:3301/api/v1/tenant/onboarding/environment')).json()).data.manualQa,false);
  const strictPage=await context.newPage();strictPage.on('pageerror',e=>pageErrors.push(e.message));await strictPage.route('**/api/v1/tenant/onboarding/environment',route=>route.continue({url:route.request().url().replace('3401','3301')}));await strictPage.goto(base+'/views/shared/register.html');await strictPage.locator('#reg-plan-id option:not([value=""])').first().waitFor({state:'attached'});await strictPage.locator('#reg-org-email').fill('office@normal-path.test');await strictPage.locator('#reg-org-email').blur();await strictPage.getByText('Use a publicly usable organization domain, rather than a personal or reserved example domain.',{exact:true}).waitFor();assert.equal(await strictPage.locator('#reg-submit').isDisabled(),true);await strictPage.close();
  await stop(normal,'stop');
  assert.deepEqual(await counts(),before);assert.deepEqual(pageErrors,[]);
  checks.push('Normal real backend rejects the same .test payload, advertises QA disabled, and the actual registration page displays its strict .test error with submission disabled. Public-schema counts are unchanged across 11 model types; no JavaScript page errors.');
  fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({schema:state.schema,organizationId:result.organizationId,checks,publicBefore:before,publicAfter:await counts(),pageErrors},null,2));console.log(JSON.stringify({checks,pageErrors}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(async()=>{
  await browser?.close();await stop(normal,'stop').catch(()=>{});await stop(qa,'manual-qa-stop').catch(()=>{});for(const child of children)if(child.exitCode===null)await stop(child).catch(()=>{});for(const fd of logs)fs.closeSync(fd);await db.$disconnect();await publicDb.$disconnect();
});
