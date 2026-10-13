import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { employeeImports, safeCsvCell } from '../src/adapters/employeeImports.js'

const originalWindow=globalThis.window, originalFetch=globalThis.fetch
afterEach(()=>{globalThis.window=originalWindow;globalThis.fetch=originalFetch})
test('upload sends one multipart request with existing JWT and stable retry key',async()=>{
  const calls=[]
  globalThis.window={FinStackApi:{baseUrl:'https://api.example.test'},FinStackTenantSession:{getTenantSession:()=>({accessToken:'test-token'})}}
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,status:201,json:async()=>({data:{id:'job-1'}})}}
  const file=new Blob(['employeeId,firstName,lastName,email\n'])
  assert.deepEqual(await employeeImports.upload(file,'same-key'),{id:'job-1'})
  assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.example.test/api/v1/tenant/configuration/employee-imports')
  assert.equal(calls[0].options.headers.Authorization,'Bearer test-token');assert.equal(calls[0].options.headers['idempotency-key'],'same-key')
  assert.equal(calls[0].options.headers['Content-Type'],undefined);assert.equal(calls[0].options.body.get('file').size,file.size)
  assert.equal(calls[0].options.cache,'no-store')
})
test('upload refuses absent session without a request',async()=>{
  globalThis.window={};globalThis.fetch=()=>{throw Error('Unexpected network request')}
  await assert.rejects(employeeImports.upload(new Blob(),'key'),/Sign in again/)
})
test('expired upload session delegates to existing unauthorized handler',async()=>{
  let expired=0
  globalThis.window={FinStackApi:{baseUrl:'https://api.example.test'},FinStackTenantSession:{getTenantSession:()=>({accessToken:'expired'}),handleUnauthorized:()=>expired++}}
  globalThis.fetch=async()=>({status:401,ok:false})
  await assert.rejects(employeeImports.upload(new Blob(),'key'),/session expired/);assert.equal(expired,1)
})
test('job operations reuse tenant runtime and only import routes',async()=>{
  const calls=[]
  globalThis.window={FinStackTenantSession:{request:async(path,options)=>{calls.push({path,options});return {id:'job'}}}}
  await employeeImports.list();await employeeImports.get('job');await employeeImports.rows('job',2);await employeeImports.confirm('job')
  assert.deepEqual(calls.map(c=>c.path),['/api/v1/tenant/configuration/employee-imports','/api/v1/tenant/configuration/employee-imports/job','/api/v1/tenant/configuration/employee-imports/job/rows?page=2','/api/v1/tenant/configuration/employee-imports/job/confirm'])
  assert.equal(calls[3].options.method,'POST')
})
test('download cells escape quotes and neutralize spreadsheet formulas',()=>{
  for(const value of ['=formula',' +formula','@formula','-formula','\tformula'])assert(safeCsvCell(value).startsWith('"\''))
  assert.equal(safeCsvCell('a"b'),'"a""b"')
})
