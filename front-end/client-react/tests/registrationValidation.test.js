import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import vm from 'node:vm'
const source = await readFile(new URL('../../js/pages/shared/register.js', import.meta.url), 'utf8')
const window = {}
vm.runInNewContext(source, { window, URL, document: { addEventListener() {} } })
const errors = window.FinStackRegistrationValidation.errors
const valid = { name:'Société Example 株式会社', registrationCountry:'IN', registrationIdentifier:'REG-123/2026', registrationExemptionReason:'', primaryEmail:'office@company.org', email:'alex@company.org', firstName:'Alex',lastName:'Lee', authorizedContactTitle:'Director',password:'existing-new-password', confirmPassword:'existing-new-password',employeeCount:3, planId:'plan-id' }
test('registration accepts international names and issued identifier punctuation', () => { assert.equal(Object.keys(errors(valid)).length, 0) })
test('registration validates required identity and contact fields before requesting registration', () => {
  for (const field of ['name','firstName','lastName','authorizedContactTitle','registrationCountry','planId','password']) assert.ok(errors({...valid,[field]:''})[field])
  assert.ok(errors({...valid,registrationIdentifier:'<script>'}).registrationIdentifier)
  assert.ok(errors({...valid,registrationCountry:'ZZ'}).registrationCountry)
  assert.ok(errors({...valid,email:'person@another.org'}).email)
  assert.ok(errors({...valid,employeeCount:1.5}).employeeCount)
  assert.ok(errors({...valid,confirmPassword:'different'}).confirmPassword)
})
test('registration rejects reserved/personal domains and does not treat syntax as verification', () => {
  for (const primaryEmail of ['fake@example.test','name@gmail.com']) assert.ok(errors({...valid,primaryEmail}).primaryEmail)
  assert.equal(Object.keys(errors({...valid,registrationIdentifier:'',registrationExemptionReason:'Unincorporated entity without a company identifier.'})).length,0)
  assert.ok(errors({...valid,registrationIdentifier:'',registrationExemptionReason:'none'}).registrationExemptionReason)
})

 test('registration enforces backend field bounds even when HTML limits are bypassed', () => {
  for (const [field,max] of Object.entries({name:180,firstName:100,lastName:100,authorizedContactTitle:120})) {
    assert.ok(errors({...valid,[field]:'A'.repeat(max+1)})[field])
    assert.equal(errors({...valid,[field]:'A'.repeat(max)})[field],undefined)
  }
  assert.ok(errors({...valid,registrationIdentifier:'',registrationExemptionReason:'A'.repeat(501)}).registrationExemptionReason)
  assert.ok(errors({...valid,primaryEmail:'a'.repeat(321)+'@company.org'}).primaryEmail)
 })

test('manual QA allows only .test when explicitly supplied; default and other reserved domains stay strict', () => {
  const fictional={...valid,primaryEmail:'office@fictional.test',email:'alex@fictional.test'}
  assert.ok(errors(fictional).primaryEmail)
  assert.equal(Object.keys(errors(fictional,true)).length,0)
  for (const suffix of ['example','invalid','localhost']) assert.ok(errors({...fictional,primaryEmail:'office@fictional.'+suffix,email:'alex@fictional.'+suffix},true).primaryEmail)
})
