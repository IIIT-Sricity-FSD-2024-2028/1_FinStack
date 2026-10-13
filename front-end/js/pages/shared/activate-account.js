(function () {
  'use strict';
  var params = new URLSearchParams(window.location.hash.slice(1));
  var token = params.get('token') || '';
  var employee = params.get('employeeId') || '';
  history.replaceState(null, '', window.location.pathname);
  var form = document.getElementById('activation-form');
  var message = document.getElementById('activation-message');
  var button = form.querySelector('button');
  document.getElementById('activation-employee').value = employee;
  if (!/^[a-f0-9]{64}$/.test(token) || !employee) { message.textContent = 'Activation link is invalid. Request a new link from your Configuration Manager.'; button.disabled = true; }
  var busy = false;
  form.addEventListener('submit', async function (event) {
    event.preventDefault(); if (busy) return;
    var password = document.getElementById('activation-password').value;
    if (password !== document.getElementById('activation-confirm').value) { message.textContent = 'Passwords must match.'; return; }
    busy = true; button.disabled = true; message.textContent = 'Setting your password…';
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 20000);
    try {
      var response = await fetch((window.FinStackApi?.baseUrl || 'http://localhost:3000') + '/api/v1/tenant/employee-activation', { signal:controller.signal, method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({employeeId:employee,token:token,password:password}), cache:'no-store' });
      var body = await response.json();
      if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'Activation failed.');
      token = ''; form.reset(); message.textContent = 'Your password is set. Sign in with your employee ID.';
    } catch (error) { message.textContent = error.message || 'Activation could not finish. Try again.'; button.disabled = false; }
    finally { clearTimeout(timeout); busy = false; }
  });
})();
