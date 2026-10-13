const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function verify({page,prisma,organizationId,base,apiBase,output,phase}){
 // Genuine authenticated disposable mutations provide enough events for server pagination.
 if(phase==='before-restart') await page.evaluate(async apiBase=>{
   const token=sessionStorage.getItem('finstackTenantAccessToken');
   for(let i=0;i<27;i++){const response=await fetch(apiBase+'/api/v1/tenant/expenses/configuration/categories',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({name:'Z audit pagination '+i})});if(!response.ok)throw new Error('Audit pagination fixture mutation failed '+response.status);}
 },apiBase);
 const requests=[],samples=[],pending=[],errors=[];
 const onRequest=req=>{if(req.url().startsWith(apiBase)) requests.push({method:req.method(),path:new URL(req.url()).pathname})};
 const onResponse=res=>{if(!res.url().includes('/configuration/audit-logs'))return;pending.push((async()=>{const body=await res.body().catch(()=>null);samples.push({path:new URL(res.url()).pathname,status:res.status(),bytes:body?.length??null,ms:res.request().timing().responseEnd})})())};
 const onError=e=>errors.push(e.message);page.on('request',onRequest);page.on('response',onResponse);page.on('pageerror',onError);
 try{
  await page.goto(base+'/views/config-manager/audit-logs.html');await page.getByRole('heading',{name:'Audit Logs',exact:true}).waitFor();
  await page.getByRole('cell',{name:'category.created',exact:true}).first().waitFor();await page.waitForLoadState('networkidle');
  const dbEvents=await prisma.tenantAuditLog.findMany({where:{organizationId},orderBy:[{occurredAt:'desc'},{id:'desc'}]});assert(dbEvents.length>=2);
  const pageOneIds=await page.getByRole('button',{name:/View event/}).evaluateAll(buttons=>buttons.map(b=>b.getAttribute('aria-label')));
  await page.getByRole('button',{name:'Next',exact:true}).click();await page.waitForFunction(first=>document.querySelector('tbody button')?.getAttribute('aria-label')!==first,pageOneIds[0]);
  assert.notEqual(await page.getByRole('button',{name:/View event/}).first().getAttribute('aria-label'),pageOneIds[0]);
  await page.getByRole('button',{name:'Previous',exact:true}).click();await page.getByRole('button',{name:pageOneIds[0],exact:true}).waitFor();
  await page.getByRole('button',{name:/View event/}).first().click();await page.getByRole('dialog',{name:'Audit event details'}).waitFor();await page.getByText('Event UUID: '+dbEvents[0].id,{exact:true}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
  await page.getByLabel('Filter by resource').selectOption('category');await page.getByRole('cell',{name:'category.created',exact:true}).first().waitFor();
  await page.getByLabel('Filter by event code').fill('category.created');await page.waitForLoadState('networkidle');
  await page.getByPlaceholder('Search logs...').fill('absent-audit-event');await page.getByText('No logs match the current filters.').waitFor();
  await page.getByPlaceholder('Search logs...').fill('');await page.getByRole('cell',{name:'category.created',exact:true}).first().waitFor();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export Logs',exact:true}).click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/\.csv$/);
  const csv=fs.readFileSync(await download.path(),'utf8');assert(csv.startsWith('id,occurredAt,'));assert(csv.includes('category.created'));assert(!csv.includes('policy.created'));
  for(const width of [375,768,1280]){await page.setViewportSize({width,height:900});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth,undefined,{timeout:4000});await page.screenshot({path:path.join(output,'audit-'+phase+'-'+width+'.png'),fullPage:true});}
  await page.setViewportSize({width:1280,height:900});await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.getByRole('cell',{name:'category.created',exact:true}).first().waitFor();
  await Promise.all(pending);assert.deepEqual(errors,[]);assert(!requests.some(r=>/configuration\/(users|employees|hierarchy)|expenses\/configuration\/(categories|policies)/.test(r.path)));
  const sizes=await prisma.$queryRaw`SELECT count(*)::int AS events, round(avg(pg_column_size(a)))::int AS average_row_bytes, max(pg_column_size(a))::int AS maximum_row_bytes FROM "TenantAuditLog" a WHERE "organizationId"=${organizationId}::uuid`;
  const plan=await prisma.$queryRaw`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id,"actorName","eventCode","targetId","occurredAt" FROM "TenantAuditLog" WHERE "organizationId"=${organizationId}::uuid ORDER BY "occurredAt" DESC,id DESC LIMIT 25`;
  fs.writeFileSync(path.join(output,'audit-'+phase+'-results.json'),JSON.stringify({phase,events:dbEvents.length,eventIds:dbEvents.map(e=>e.id),checks:['real UI mutation events match PostgreSQL','scoped detail fetch','literal search and exact resource/event filters','genuine filtered CSV','refresh','375/768/1280 responsive','no unrelated resource requests','no page errors'],samples,requests,errors,storage:sizes[0],pageQueryPlan:plan},null,2));
 }finally{await Promise.allSettled(pending);page.off('request',onRequest);page.off('response',onResponse);page.off('pageerror',onError);}
};
