const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
module.exports = async function ({page,base,apiBase,output}) {
  const requests=[],errors=[];
  const capture=r=>{if(r.url().startsWith(apiBase))requests.push(new URL(r.url()).pathname);};
  const onError=e=>errors.push(e.message);
  page.on('request',capture);page.on('pageerror',onError);
  const results=[];
  try {
    const pricing=page.waitForResponse(r=>r.url()===apiBase+'/api/v1/tenant/onboarding/plans');
    await page.goto(base+'/index.html');assert.equal((await pricing).status(),200);
    await page.locator('.landing-pricing-card').first().waitFor();
    await page.getByRole('link',{name:'Contact and support guidance',exact:true}).click();
    await page.getByRole('heading',{name:'Contact and access guidance',exact:true}).waitFor();
    await page.getByRole('link',{name:'Client login',exact:true}).click();
    await page.getByRole('link',{name:/Forgot/}).click();
    await page.getByRole('heading',{name:'Online password recovery is unavailable',exact:true}).waitFor();
    results.push('Home contact navigation and login Forgot Password link reach honest supported guidance.');
    for(const width of [375,768,1280]) {
      await page.setViewportSize({width,height:900});
      for(const name of ['account-request','forgot-password','reset-password','help']) {
        const before=requests.length;
        await page.goto(base+'/views/shared/'+name+'.html');
        assert.equal(await page.locator('form,input,select').count(),0);
        assert.equal(requests.length,before,'Guidance must not query identities or simulate a submission.');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
        for(const href of await page.locator('a[href]').evaluateAll(links=>links.map(a=>a.href))) {
          const response=await page.request.get(href);assert.equal(response.status(),200,href);
        }
        await page.screenshot({path:path.join(output,'shared-'+name+'-'+width+'.png'),fullPage:true});
      }
      await page.goto(base+'/views/shared/register.html');
      assert.equal(await page.locator('fieldset').count(),4);
      assert.equal(await page.locator('#reg-show-password').count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await page.locator('#reg-password-toggle').focus();await page.keyboard.press('Space');
      assert.equal(await page.locator('#reg-password-toggle').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('#reg-confirm-password').getAttribute('type'),'password');
      await page.keyboard.press('Space');
      await page.screenshot({path:path.join(output,'shared-register-'+width+'.png'),fullPage:true});
    }
    const protectedQueue=await page.request.get(apiBase+'/api/v1/platform/support/tickets');
    assert.equal(protectedQueue.status(),401);
    results.push('Four guidance pages and grouped registration pass 375/768/1280 overflow, link and keyboard checks; guidance sends zero API requests. Anonymous platform support access returns 401.');
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(output,'shared-onboarding-browser-results.json'),JSON.stringify({results,errors},null,2));
  } finally {page.off('request',capture);page.off('pageerror',onError);await page.setViewportSize({width:1280,height:900});}
};
