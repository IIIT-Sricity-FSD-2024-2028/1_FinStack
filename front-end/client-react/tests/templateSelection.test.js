import test from 'node:test'
import assert from 'node:assert/strict'
import { existingTemplate, applicableCategory, validPolicySelection } from '../src/features/config-manager/templateSelection.js'

test('renamed sourced records and case-normalized custom names are already configured', () => {
  assert.equal(existingTemplate([{id:'1',templateKey:'meals',name:'Company Food'}],{key:'meals',name:'Meals'}).id,'1')
  assert.equal(existingTemplate([{id:'2',name:' MEALS '}],{key:'meals',name:'Meals'}).id,'2')
})
test('policy matching requires active matching category and supports renamed sources', () => {
  const catalog={categories:[{key:'meals',name:'Meals'}]}, template={categoryKey:'meals'}
  assert.equal(applicableCategory([{id:'1',templateKey:'meals',name:'Food',status:'Active'}],template,catalog).id,'1')
  assert.equal(applicableCategory([{id:'1',templateKey:'meals',name:'Food',status:'Inactive'}],template,catalog),undefined)
  assert.equal(applicableCategory([{id:'1',templateKey:'travel',name:'Meals',status:'Active'}],template,catalog),undefined)
})
test('review requires explicit valid money, currency, receipt and approval configuration', () => {
  const valid={maxAmount:'100.25',currency:'USD',approvalLevels:2,receiptRequired:true}
  assert.equal(validPolicySelection(valid),true)
  for(const change of [{maxAmount:''},{maxAmount:'-1'},{maxAmount:'1.005'},{maxAmount:'1e3'},{currency:'IN'},{approvalLevels:3},{receiptRequired:undefined}]) assert.equal(Boolean(validPolicySelection({...valid,...change})),false)
  assert.equal(validPolicySelection({...valid,maxAmount:'0',approvalLevels:0}),false)
})
