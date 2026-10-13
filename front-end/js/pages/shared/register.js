/* Public registration remains a legacy page; Admin review uses the existing React app. */
(function () {
  "use strict";
  var countryCodes = ['AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ', 'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW', 'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW'];
  function domain(email) { try { return new URL("https://" + email.split("@")[1]).hostname.toLowerCase(); } catch (_) { return ""; } }
  function errors(v, allowTestDomains) {
    var out = {}, emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    ["name", "firstName", "lastName", "authorizedContactTitle"].forEach(function (key) {
      if (!v[key].trim()) out[key] = "This field is required.";
      else if (v[key].trim().length > ({name:180,firstName:100,lastName:100,authorizedContactTitle:120})[key]) out[key] = "This value is too long.";
      else if (/[\p{Cc}\p{Cf}<>]/u.test(v[key])) out[key] = "Remove control characters or markup.";
    });
    if (v.name.trim().length < 2) out.name = "Enter the legal organization name (at least 2 characters).";
    if (v.authorizedContactTitle.trim().length < 2) out.authorizedContactTitle = "Enter your contact title (at least 2 characters).";
    if (countryCodes.indexOf(v.registrationCountry) < 0) out.registrationCountry = "Select the registration country.";
    var id = v.registrationIdentifier.normalize("NFKC").trim(), exemption = v.registrationExemptionReason.trim();
    if (Boolean(id) === Boolean(exemption)) out.registrationIdentifier = "Provide a registration identifier or explain why none applies, but not both.";
    if (id && !/^[\p{L}\p{N}][\p{L}\p{N} ._\/()&:-]{0,159}$/u.test(id)) out.registrationIdentifier = "Use the issued identifier with letters, numbers and ordinary identifier punctuation.";
    if (exemption && (exemption.length < 10 || exemption.length > 500 || /[\p{Cc}\p{Cf}<>]/u.test(exemption))) out.registrationExemptionReason = "Explain why no identifier applies in 10-500 characters.";
    if (v.primaryEmail.length > 320 || !emailPattern.test(v.primaryEmail)) out.primaryEmail = "Enter a valid official organization email.";
    var official = domain(v.primaryEmail);
    if (/^(gmail.com|googlemail.com|yahoo.com|outlook.com|hotmail.com|live.com|icloud.com|aol.com|proton.me|protonmail.com)$/.test(official) || (/(?:^|\.)(test|example|invalid|localhost)$/.test(official) && !(allowTestDomains === true && official.endsWith(".test")))) out.primaryEmail = "Use a publicly usable organization domain, rather than a personal or reserved example domain.";
    if (v.email.length > 320 || !emailPattern.test(v.email)) out.email = "Enter a valid authorized contact email.";
    else if (domain(v.email) !== official) out.email = "Use the same organization domain as the official email.";
    if (v.password.length < 8 || v.password.length > 200) out.password = "Use 8â€“200 characters for this new password.";
    if (!v.confirmPassword || v.password !== v.confirmPassword) out.confirmPassword = "Passwords must match.";
    if (!v.planId) out.planId = "Select an active plan.";
    if (!Number.isInteger(v.employeeCount) || v.employeeCount < 1 || v.employeeCount > 1000000) out.employeeCount = "Enter a whole number from 1 to 1,000,000.";
    return out;
  }
  window.FinStackRegistrationValidation = { errors: errors };
  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("reg-form"); if (!form) return;
    var fields = { name:"reg-org-name", registrationCountry:"reg-country", registrationIdentifier:"reg-registration-id", registrationExemptionReason:"reg-exemption", primaryEmail:"reg-org-email", firstName:"reg-first-name", lastName:"reg-last-name", authorizedContactTitle:"reg-contact-title", email:"reg-admin-email", password:"reg-password", confirmPassword:"reg-confirm-password", employeeCount:"reg-employee-count", planId:"reg-plan-id" };
    var qaDomainsEnabled = false;
    var touched = {}, busy = false, plans = [], quoteTimer, quoteController, lastQuote = "";
    var submit = document.getElementById("reg-submit"), country = document.getElementById("reg-country"), planSelect = document.getElementById("reg-plan-id"), errorBox = document.getElementById("reg-error");
    var base = window.FinStackApi && window.FinStackApi.baseUrl || "http://localhost:3000";
    var names = new Intl.DisplayNames(["en"], { type:"region" });
    countryCodes.map(function (code) { return { code:code, name:names.of(code) }; }).sort(function (a,b) { return a.name.localeCompare(b.name); }).forEach(function (item) { country.add(new Option(item.name + " (" + item.code + ")", item.code)); });
    function values() { var v = {}; Object.keys(fields).forEach(function (key) { var value = document.getElementById(fields[key]).value; v[key] = key === "employeeCount" ? Number(value) : key === "password" || key === "confirmPassword" ? value : value.trim(); }); return v; }
    function validate(all) { var errs = errors(values(), qaDomainsEnabled); Object.keys(fields).forEach(function (key) { var input = document.getElementById(fields[key]), message = (all || touched[key]) && errs[key] || ""; document.getElementById(fields[key]+"-error").textContent = message; input.setAttribute("aria-invalid", String(Boolean(message))); }); submit.disabled = busy || Object.keys(errs).length > 0; return errs; }
    Object.keys(fields).forEach(function (key) { var input = document.getElementById(fields[key]); input.addEventListener("input", function () { validate(false); }); input.addEventListener("blur", function () { touched[key] = true; validate(false); }); });
    function showError(text) { errorBox.textContent = text; errorBox.hidden = false; }
    async function read(response) { var payload = await response.json(); if (!response.ok) { var err = new Error(response.status >= 500 ? "Registration service temporarily unavailable. Please try again." : response.status === 429 ? "Too many attempts. Please wait before trying again." : payload.error && payload.error.message || "Registration could not be submitted."); throw err; } return payload.data || payload; }
    fetch(base+"/api/v1/tenant/onboarding/environment").then(read).then(function (data) {
      qaDomainsEnabled=data.manualQa === true && ["127.0.0.1","localhost","[::1]"].indexOf(window.location.hostname) >= 0;
      if (qaDomainsEnabled) {
        var notice=document.createElement("p"); notice.id="reg-manual-qa"; notice.setAttribute("role","status");
        notice.textContent="LOCAL MANUAL QA: isolated database; fictional .test mailboxes are accepted. No email delivery, legal identity or domain ownership is verified. Use a truthful QA explanation instead of claiming a real government identifier.";
        form.before(notice);
      }
      validate(false);
    }).catch(function () { qaDomainsEnabled=false; validate(false); });
    function addOns() { return Array.from(document.querySelectorAll(".reg-addon:checked")).map(function (node) { return node.value; }); }
    async function quote() {
      var v = values(); if (!v.planId || !Number.isInteger(v.employeeCount) || v.employeeCount < 1 || v.employeeCount > 1000000) return;
      var body = JSON.stringify({planId:v.planId,employeeCount:v.employeeCount,featureIds:addOns()}); if (body === lastQuote) return;
      lastQuote = body; if (quoteController) quoteController.abort(); quoteController = new AbortController();
      try { var q = await fetch(base+"/api/v1/tenant/onboarding/quotes",{method:"POST",headers:{"Content-Type":"application/json"},body:body,signal:quoteController.signal}).then(read); document.getElementById("reg-price-preview").textContent = "Server-calculated recurring quote: " + q.currency + " " + q.totalAmount + " / " + q.billingInterval.toLowerCase() + ". Approval and commercial activation are separate."; }
      catch (err) { if (err.name !== "AbortError") { lastQuote = ""; document.getElementById("reg-price-preview").textContent = "Quote unavailable. Check your connection or try another plan."; } }
    }
    function scheduleQuote() { clearTimeout(quoteTimer); quoteTimer = setTimeout(quote,300); }
    document.getElementById("reg-employee-count").addEventListener("input",scheduleQuote);
    planSelect.addEventListener("change",function () {
      var plan = plans.find(function (p) { return p.id === planSelect.value; }), box = document.getElementById("reg-addon-options"); box.replaceChildren();
      if (plan) (plan.features || []).filter(function (f) { return f.isAddOn; }).forEach(function (f) { var label = document.createElement("label"), input = document.createElement("input"); input.type="checkbox"; input.className="reg-addon"; input.value=f.id; input.addEventListener("change",scheduleQuote); label.append(input,document.createTextNode(" "+f.name+" ("+plan.currency+" "+f.addOnPrice+")")); box.append(label); });
      validate(false); scheduleQuote();
    });
    function loadPlans() {
    fetch(base+"/api/v1/tenant/onboarding/plans").then(read).then(function (data) { plans=data.items || []; planSelect.replaceChildren(new Option("Select an active plan","")); plans.forEach(function (p) { planSelect.add(new Option(p.name+" â€” "+p.currency+" "+p.basePrice,p.id)); }); validate(false); }).catch(function () { planSelect.replaceChildren(new Option("Plans unavailable","")); showError("Registration service temporarily unavailable. Refresh to retry."); });
    }
    ["reg-password","reg-confirm-password"].forEach(function (id) {
      document.getElementById(id+"-toggle").addEventListener("click",function (event) {
        var input=document.getElementById(id), show=input.type === "password";
        input.type=show?"text":"password";
        event.currentTarget.setAttribute("aria-pressed",String(show));
        event.currentTarget.setAttribute("aria-label",(show?"Hide ":"Show ")+(id === "reg-password"?"password":"confirm password"));
      });
    });
    country.addEventListener("change",function () {
      document.getElementById("reg-registration-id-help").textContent="Enter the legal entity identifier as issued"+(country.value?" in "+names.of(country.value):" in the selected country")+". Formats depend on the entity and registry; authenticity requires manual review. Do not enter personal identity numbers.";
    });
    var receiptKey="finstack.registration.employee-id";
    function showReceipt(employeeId, message) {
      form.hidden=true;
      document.getElementById("success-message").textContent=message || "Saved submission receipt. Current review status is not queried here.";
      document.getElementById("success-admin-emp-id").textContent=employeeId;
      document.getElementById("success-status").textContent="At submission: pending organization review; domain ownership unverified. This receipt is not approval.";
      document.getElementById("success-card").hidden=false;
    }
    var hasReceipt=false;
    try { var saved=sessionStorage.getItem(receiptKey); if (/^CFG-[A-F0-9]{8}$/.test(saved || "")) { showReceipt(saved); hasReceipt=true; } } catch (_) { /* Saving or downloading the receipt remains available. */ }
    if (!hasReceipt) loadPlans();
    document.getElementById("reg-save-receipt").addEventListener("click",function () {
      var text="FinStack organization registration receipt\nEmployee ID: "+document.getElementById("success-admin-emp-id").textContent+"\nUse this ID and your chosen password after Admin approval. This receipt does not prove approval.\n";
      var url=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"})), link=document.createElement("a");
      link.href=url; link.download="finstack-employee-id.txt"; link.click(); setTimeout(function () { URL.revokeObjectURL(url); },1000);
    });
    document.getElementById("reg-start-another").addEventListener("click",function () {
      try { sessionStorage.removeItem(receiptKey); } catch (_) { /* Storage may be unavailable. */ }
      if (!plans.length) loadPlans();
      clearTimeout(quoteTimer); if (quoteController) quoteController.abort();
      form.reset(); ["reg-password","reg-confirm-password"].forEach(function (id) { document.getElementById(id).type="password"; var toggle=document.getElementById(id+"-toggle"); toggle.setAttribute("aria-pressed","false"); toggle.setAttribute("aria-label","Show "+(id === "reg-password"?"password":"confirm password")); }); touched={}; form.hidden=false; document.getElementById("success-card").hidden=true;
      errorBox.hidden=true; document.getElementById("reg-addon-options").replaceChildren(); document.getElementById("reg-price-preview").textContent=""; lastQuote="";
      validate(false); country.focus();
    });
    form.addEventListener("submit",async function (event) {
      event.preventDefault(); if (busy) return; if (Object.keys(validate(true)).length) { form.querySelector('[aria-invalid="true"]').focus(); return; }
      var v=values(); delete v.confirmPassword; v.featureIds=addOns(); busy=true; errorBox.hidden=true; form.setAttribute("aria-busy","true"); submit.textContent="Submittingâ€¦"; validate(false);
      var controller=new AbortController(), timeout=setTimeout(function () { controller.abort(); },20000);
      try { var result=await fetch(base+"/api/v1/tenant/registrations/organizations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(v),signal:controller.signal}).then(read);
        document.getElementById("reg-password").value=""; document.getElementById("reg-confirm-password").value=""; form.hidden=true;
        try { sessionStorage.setItem(receiptKey,result.employeeId); } catch (_) { /* The visible receipt can still be saved. */ }
        showReceipt(result.employeeId,result.message); document.getElementById("success-card").focus();
      } catch (err) { showError(err instanceof TypeError || err.name === "AbortError" ? "Registration service temporarily unavailable. If submission timed out, it may have been saved. Do not assume it failed or repeatedly resubmit. Online receipt recovery is unavailable." : err.message); }
      finally { clearTimeout(timeout); busy=false; form.setAttribute("aria-busy","false"); submit.textContent="Submit for review"; validate(false); }
    });
    validate(false);
  });
})();
