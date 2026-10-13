import test from 'node:test'
import assert from 'node:assert/strict'
import { auditQuery } from '../src/adapters/tenantAudit.js'
test('audit filters preserve pagination, literal search and exact event code without empty values',()=>{
 const query=new URLSearchParams(auditQuery({page:2,pageSize:25,search:'% employee',eventCode:'employee.updated',from:'',outcome:null}))
 assert.equal(query.get('search'),'% employee')
 assert.equal(query.get('eventCode'),'employee.updated')
 assert.equal(query.get('page'),'2')
 assert.equal(query.has('from'),false)
 assert.equal(query.has('outcome'),false)
})
