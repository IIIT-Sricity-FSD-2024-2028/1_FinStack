(function () {
  var routes = {
    landing: 'index.html',
    login: 'login.html',
    register: 'views/shared/register.html',
    forgotPassword: 'views/shared/forgot-password.html',
    resetPassword: 'views/shared/reset-password.html',
    accountRequest: 'views/shared/account-request.html',
    configManager: 'views/config-manager/dashboard.html',
    manager: 'views/manager/dashboard.html',
    finance: 'views/finance/dashboard.html',
    compliance: 'views/compliance/dashboard.html',
    submitter: 'views/submitter/dashboard.html'
  };

  window.FinStackRoutes = routes;
  window.navigateToRoute = function (name) {
    if (routes[name]) {
      window.location.href = routes[name];
    }
  };
})();
