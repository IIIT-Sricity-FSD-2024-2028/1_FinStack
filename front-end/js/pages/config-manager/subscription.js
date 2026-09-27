(function () {
  "use strict";

  var base =
    window.FinStackApi && window.FinStackApi.baseUrl
      ? window.FinStackApi.baseUrl
      : "http://localhost:3000";
  var plans = [];
  var currentSubscription = null;

  function errorMessage(payload) {
    var value = payload && (payload.message || payload.error);
    return Array.isArray(value) ? value.join(", ") : value || "Request failed.";
  }

  function request(path, options) {
    if (!window.FinStackTenantSession) {
      return Promise.reject(new Error("Tenant session handling is unavailable."));
    }
    return window.FinStackTenantSession.request(path, options);
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[char];
    });
  }

  function money(amount, currency) {
    var numeric = Number(amount);
    if (Number.isFinite(numeric)) {
      try {
        return new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: currency,
          maximumFractionDigits: 2,
        }).format(numeric);
      } catch (error) {
        // Use the server-supplied currency and amount if browser formatting is unavailable.
      }
    }
    return esc(currency) + " " + esc(amount);
  }

  function date(value) {
    if (!value) return "Not available";
    var parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? esc(value)
      : new Intl.DateTimeFormat("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).format(parsed);
  }

  function statusClass(status) {
    if (status === "ACTIVE" || status === "PAID" || status === "SUCCEEDED")
      return "badge-green";
    if (status === "TRIAL") return "badge-purple";
    if (
      status === "PENDING" ||
      status === "OVERDUE" ||
      status === "PENDING_PAYMENT" ||
      status === "EXPIRING" ||
      status === "GRACE_PERIOD"
    )
      return "badge-orange";
    if (
      status === "CANCELLED" ||
      status === "FAILED" ||
      status === "VOID" ||
      status === "REFUNDED"
    )
      return "badge-red";
    return "badge-cyan";
  }

  function badge(status) {
    return '<span class="badge ' + statusClass(status) + '">' + esc(status) + "</span>";
  }

  function showError(message) {
    var node = document.getElementById("subscription-error");
    if (node) {
      node.textContent = message;
      node.style.display = "block";
    }
  }

  function hideError() {
    var node = document.getElementById("subscription-error");
    if (node) node.style.display = "none";
  }

  function featureRow(feature, addOn, currency) {
    return (
      '<div class="feature-row' +
      (addOn ? " add-on" : "") +
      '"><div><strong>' +
      esc(feature.name) +
      "</strong>" +
      (addOn
        ? '<span class="feature-price">' +
          money(feature.addOnPrice, currency) +
          "</span>"
        : "") +
      "</div></div>"
    );
  }

  function renderHero(subscription, pendingInvoice) {
    var hero = document.getElementById("subscription-summary");
    var plan = subscription.plan;
    var featureCount = (plan.features || []).length;
    var paymentLabel = pendingInvoice
      ? subscription.status === "TRIAL"
        ? "Activate Plan · " + money(pendingInvoice.totalAmount, pendingInvoice.currency)
        : "Pay Invoice · " + money(pendingInvoice.totalAmount, pendingInvoice.currency)
      : "";

    hero.innerHTML =
      '<div class="subscription-hero-main"><div><div class="subscription-eyebrow">Current plan</div><div class="subscription-plan-title"><h2>' +
      esc(plan.name) +
      "</h2>" +
      badge(subscription.status) +
      '</div><div class="subscription-price">' +
      money(subscription.priceAtSubscription, subscription.currency) +
      '<span> / ' +
      esc(subscription.billingInterval.toLowerCase()) +
      "</span></div></div>" +
      '<div class="subscription-hero-actions">' +
      (pendingInvoice
        ? '<button class="btn btn-primary" id="hero-pay-button" type="button">' +
          paymentLabel +
          "</button>"
        : "") +
      '<button class="btn btn-secondary" id="change-btn" type="button">Change Plan</button></div></div>' +
      '<div class="subscription-stat-grid"><div><div class="subscription-stat-label">Current period</div><div class="subscription-stat-value">' +
      date(subscription.currentPeriodStart) +
      " to " +
      date(subscription.currentPeriodEnd) +
      '</div></div><div><div class="subscription-stat-label">Renewal date</div><div class="subscription-stat-value">' +
      date(subscription.currentPeriodEnd) +
      '</div></div><div><div class="subscription-stat-label">Plan capacity</div><div class="subscription-stat-value">' +
      esc(String(subscription.employeeCount || 1)) +
      " seats · " +
      esc(String(featureCount)) +
      ' enabled features</div></div></div>' +
      (subscription.status === "CANCELLED"
        ? ""
        : '<button class="btn btn-ghost subscription-cancel-button" id="cancel-btn" type="button">Cancel subscription</button>');

    var payButton = document.getElementById("hero-pay-button");
    if (payButton) {
      payButton.addEventListener("click", function () {
        startPayment(pendingInvoice);
      });
    }
    document.getElementById("change-btn").addEventListener("click", changePlan);
    var cancelButton = document.getElementById("cancel-btn");
    if (cancelButton) cancelButton.addEventListener("click", openCancelDialog);
  }

  function renderPricing(subscription) {
    var node = document.getElementById("pricing-breakdown");
    node.innerHTML =
      '<div class="pricing-card"><div class="subscription-label">Recurring pricing</div><h2>Pricing Breakdown</h2></div>' +
      '<div class="pricing-row"><span class="pricing-row-label">Base plan</span><span class="pricing-row-value">' +
      money(subscription.plan.basePrice, subscription.currency) +
      '</span></div><div class="pricing-row"><span class="pricing-row-label">Additional employees</span><span class="pricing-row-value">' +
      money(subscription.employeeAmount, subscription.currency) +
      '</span></div><div class="pricing-row"><span class="pricing-row-label">Feature add-ons</span><span class="pricing-row-value">' +
      money(subscription.featureAmount, subscription.currency) +
      '</span></div><div class="pricing-row pricing-total"><span class="pricing-row-label">Total recurring price</span><span class="pricing-row-value">' +
      money(subscription.priceAtSubscription, subscription.currency) +
      "</span></div>";
  }

  function renderSeats(subscription) {
    var included = subscription.plan.includedEmployeeCount || 0;
    var purchased = subscription.employeeCount || 1;
    var additional = Math.max(0, purchased - included);
    var node = document.getElementById("seat-summary");
    node.innerHTML =
      '<div class="seat-card"><div class="subscription-label">Plan capacity</div><h2>Employee Seats</h2></div>' +
      '<div class="seat-metric"><div class="subscription-stat-label">Purchased seats</div><div class="seat-metric-value">' +
      esc(String(purchased)) +
      '</div></div><div class="seat-metric"><div class="subscription-stat-label">Included seats</div><div class="seat-metric-value">' +
      esc(String(included)) +
      '</div></div><div class="seat-metric"><div class="subscription-stat-label">Additional billable seats</div><div class="seat-metric-value">' +
      esc(String(additional)) +
      '</div></div><div class="seat-metric"><div class="subscription-stat-label">Employee pricing component</div><div class="seat-metric-value">' +
      money(subscription.employeeAmount, subscription.currency) +
      "</div></div>";
  }

  function renderFeatures(subscription) {
    var plan = subscription.plan;
    var included = (plan.features || []).filter(function (feature) {
      return !feature.isAddOn;
    });
    var selected = subscription.selectedAddOns || [];
    var node = document.getElementById("feature-summary");
    node.innerHTML =
      '<div class="feature-card-heading"><div class="subscription-label">Plan capabilities</div><h2>Features</h2></div><div class="subscription-feature-lists"><div class="feature-list"><div class="feature-list-title">Included Features</div>' +
      (included.length
        ? included
            .map(function (feature) {
              return featureRow(feature, false, subscription.currency);
            })
            .join("")
        : '<p class="text-muted">No included features listed.</p>') +
      '</div><div class="feature-list"><div class="feature-list-title">Selected Paid Add-ons</div>' +
      (selected.length
        ? selected
            .map(function (feature) {
              return featureRow({ name: feature.name, description: feature.description || feature.key, addOnPrice: feature.amount }, true, subscription.currency);
            })
            .join("")
        : '<p class="text-muted">No paid add-ons are selected for this subscription.</p>') +
      "</div></div>";
  }

  function renderCurrentInvoice(invoice) {
    var section = document.getElementById("current-invoice-section");
    if (!invoice) {
      section.style.display = "none";
      section.innerHTML = "";
      return;
    }
    section.style.display = "block";
    section.innerHTML =
      '<div class="current-invoice-content"><div><div class="subscription-label">Current invoice</div><h2>' +
      esc(invoice.invoiceNumber) +
      "</h2><div class=\"invoice-meta\"><span><span class=\"invoice-meta-label\">Amount</span><span class=\"invoice-meta-value\">" +
      money(invoice.totalAmount, invoice.currency) +
      "</span></span><span><span class=\"invoice-meta-label\">Due</span><span class=\"invoice-meta-value\">" +
      date(invoice.dueDate) +
      "</span></span>" +
      badge(invoice.status) +
      '</div></div><div class="current-invoice-actions"><button class="btn btn-primary" id="invoice-pay-button" type="button">Pay ' +
      money(invoice.totalAmount, invoice.currency) +
      "</button></div></div>";
    document
      .getElementById("invoice-pay-button")
      .addEventListener("click", function () {
        startPayment(invoice);
      });
  }

  function renderInvoices(invoices, pendingInvoice) {
    var node = document.getElementById("invoice-list");
    node.innerHTML = invoices.items.length
      ? '<table class="data-table"><thead><tr><th>Invoice</th><th>Billing period</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>' +
        invoices.items
          .map(function (invoice) {
            return (
              "<tr><td>" +
              esc(invoice.invoiceNumber) +
              "</td><td>" +
              date(invoice.billingPeriodStart || invoice.issueDate) +
              "</td><td>" +
              money(invoice.totalAmount, invoice.currency) +
              "</td><td>" +
              badge(invoice.status) +
              "</td><td>" +
              (pendingInvoice && pendingInvoice.id === invoice.id
                ? '<button class="btn btn-secondary btn-sm" type="button" data-pay-invoice="' +
                  esc(invoice.id) +
                  '">Pay</button>'
                : "") +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table>"
      : '<div class="empty-state">No invoices yet.</div>';
    node.querySelectorAll("[data-pay-invoice]").forEach(function (button) {
      button.addEventListener("click", function () {
        startPayment(
          invoices.items.filter(function (invoice) {
            return invoice.id === button.dataset.payInvoice;
          })[0],
        );
      });
    });
  }

  function renderPayments(payments) {
    var node = document.getElementById("payment-list");
    node.innerHTML = payments.items.length
      ? '<table class="data-table"><thead><tr><th>Provider / Reference</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>' +
        payments.items
          .map(function (payment) {
            return (
              "<tr><td>" +
              esc(payment.provider) +
              (payment.providerReference
                ? '<div class="text-muted" style="font-size:0.75rem;margin-top:3px">' +
                  esc(payment.providerReference) +
                  "</div>"
                : "") +
              "</td><td>" +
              money(payment.amount, payment.currency) +
              "</td><td>" +
              badge(payment.status) +
              "</td><td>" +
              date(payment.paidAt || payment.failedAt || payment.createdAt) +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table>"
      : '<div class="empty-state">No payments yet.</div>';
  }

  function render(subscription, invoices, payments) {
    currentSubscription = subscription;
    var pendingInvoice = invoices.items.filter(function (invoice) {
      return invoice.status === "PENDING" || invoice.status === "OVERDUE";
    })[0];
    renderHero(subscription, pendingInvoice);
    renderPricing(subscription);
    renderSeats(subscription);
    renderFeatures(subscription);
    renderCurrentInvoice(pendingInvoice);
    renderInvoices(invoices, pendingInvoice);
    renderPayments(payments);
  }

  function startPayment(invoice) {
    if (!invoice) return;
    if (!window.Razorpay) {
      showError("Payment checkout is unavailable.");
      return;
    }
    request("/api/v1/tenant/billing/invoices/" + invoice.id + "/payment-orders", {
      method: "POST",
    })
      .then(function (order) {
        var checkout = new window.Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          order_id: order.orderId,
          name: "FinStack",
          description: "FinStack subscription payment",
          handler: function (response) {
            request("/api/v1/tenant/billing/razorpay/verify", {
              method: "POST",
              body: {
                invoiceId: invoice.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            })
              .then(load)
              .catch(function (error) {
                if (error && error.code === "TENANT_SESSION_EXPIRED") return;
                showError(error.message);
              });
          },
        });
        checkout.open();
      })
      .catch(function (error) {
        if (error && error.code === "TENANT_SESSION_EXPIRED") return;
        showError(error.message);
      });
  }

  function closeChangePlan() {
    document.getElementById("change-plan-modal").style.display = "none";
  }

  function changePlan() {
    var modal = document.getElementById("change-plan-modal");
    var options = document.getElementById("plan-options");
    var confirmButton = document.getElementById("confirm-plan-change");
    var selectedId = null;
    var selectedEmployeeCount = currentSubscription
      ? currentSubscription.employeeCount || 1
      : 1;
    var selectedFeatureIds = [];
    if (!modal || !options || !confirmButton) return;

    modal.style.display = "flex";
    confirmButton.disabled = true;
    confirmButton.textContent = "Continue";
    options.innerHTML = '<div class="loading-state">Loading active plans...</div>';
    fetch(base + "/api/v1/tenant/onboarding/plans")
      .then(function (response) {
        return response.text().then(function (text) {
          var payload = text ? JSON.parse(text) : null;
          if (!response.ok) throw new Error(errorMessage(payload));
          return payload && payload.data ? payload.data : payload;
        });
      })
      .then(function (payload) {
        plans = payload.items || [];
        options.innerHTML =
          '<div class="plan-selection-grid">' +
          (plans.length
            ? plans
                .map(function (plan) {
                  var isCurrent = currentSubscription.plan.id === plan.id;
                  var keyFeatures = (plan.features || [])
                    .filter(function (feature) {
                      return !feature.isAddOn;
                    })
                    .slice(0, 3)
                    .map(function (feature) {
                      return esc(feature.name);
                    })
                    .join(" · ");
                  return (
                    '<button type="button" class="plan-option' +
                    (isCurrent ? " is-current" : "") +
                    '" data-plan-id="' +
                    esc(plan.id) +
                    '"><div class="plan-card-header"><strong>' +
                    esc(plan.name) +
                    "</strong>" +
                    (isCurrent ? '<span class="badge badge-cyan">Current Plan</span>' : "") +
                    '</div><div class="plan-card-price">' +
                    money(plan.basePrice, plan.currency) +
                    "<span>/ " +
                    esc(plan.billingInterval.toLowerCase()) +
                    '</span></div><span class="plan-card-meta">Includes ' +
                    esc(String(plan.includedEmployeeCount)) +
                    " seats · " +
                    money(plan.additionalEmployeePrice, plan.currency) +
                    " per additional seat</span><span class=\"plan-card-features\">" +
                    (keyFeatures || "No included features listed.") +
                    "</span></button>"
                  );
                })
                .join("")
            : '<div class="empty-state">No active plans are available.</div>') +
          "</div>";

        options.querySelectorAll(".plan-option").forEach(function (button) {
          button.addEventListener("click", function () {
            options.querySelectorAll(".plan-option").forEach(function (item) {
              item.classList.remove("selected");
            });
            button.classList.add("selected");
            selectedId = button.dataset.planId;
            selectedFeatureIds = [];
            confirmButton.disabled = !selectedId;
            confirmButton.textContent = "Confirm Change";
            renderPlanConfiguration(
              plans.filter(function (plan) {
                return plan.id === selectedId;
              })[0],
            );
          });
        });
      })
      .catch(function (error) {
        options.innerHTML =
          '<div class="empty-state">' + esc(error.message) + "</div>";
      });

    confirmButton.onclick = function () {
      if (!selectedId) return;
      confirmButton.disabled = true;
      request("/api/v1/tenant/subscription/plan-changes", {
        method: "POST",
        body: {
          planId: selectedId,
          employeeCount: selectedEmployeeCount,
          featureIds: selectedFeatureIds,
        },
      })
        .then(function (result) {
          closeChangePlan();
          if (result && result.invoice) {
            startPayment(result.invoice);
          } else {
            load();
          }
        })
        .catch(function (error) {
          if (error && error.code === "TENANT_SESSION_EXPIRED") return;
          confirmButton.disabled = false;
          showError(error.message);
        });
    };

    function renderPlanConfiguration(plan) {
      var existing = document.getElementById("plan-configuration");
      if (existing) existing.remove();
      if (!plan) return;

      var configuration = document.createElement("section");
      configuration.className = "plan-configuration";
      configuration.id = "plan-configuration";
      configuration.innerHTML =
        '<div class="plan-configuration-grid"><div><label class="form-label" for="plan-employee-count">Employee seats</label><input class="form-input" id="plan-employee-count" type="number" min="1" value="' +
        esc(String(selectedEmployeeCount)) +
        '"></div><div><div class="form-label">Optional paid add-ons</div><div id="plan-addon-options" class="plan-addon-list"></div></div></div><div id="plan-quote-preview" class="plan-quote"><div class="text-muted">Calculating server quote...</div></div>';
      options.appendChild(configuration);

      var addOnContainer = document.getElementById("plan-addon-options");
      var addOns = (plan.features || []).filter(function (feature) {
        return feature.isAddOn;
      });
      addOnContainer.innerHTML = addOns.length
        ? addOns
            .map(function (feature) {
              return (
                '<label class="plan-addon-option"><input type="checkbox" value="' +
                esc(feature.id) +
                '"><span><strong>' +
                esc(feature.name) +
                "</strong><span>" +
                esc(feature.description || feature.key) +
                " · " +
                money(feature.addOnPrice, plan.currency) +
                "</span></span></label>"
              );
            })
            .join("")
        : '<p class="text-muted">No paid add-ons are available for this plan.</p>';

      function refreshQuote() {
        var employeeInput = document.getElementById("plan-employee-count");
        selectedEmployeeCount = Math.max(1, Number(employeeInput.value) || 1);
        selectedFeatureIds = Array.prototype.map.call(
          addOnContainer.querySelectorAll('input[type="checkbox"]:checked'),
          function (input) {
            return input.value;
          },
        );
        request("/api/v1/tenant/onboarding/quotes", {
          method: "POST",
          body: {
            planId: selectedId,
            employeeCount: selectedEmployeeCount,
            featureIds: selectedFeatureIds,
          },
        })
          .then(function (quote) {
            document.getElementById("plan-quote-preview").innerHTML =
              '<div class="plan-quote-row"><span>Base plan</span><span>' +
              money(quote.baseAmount, quote.currency) +
              '</span></div><div class="plan-quote-row"><span>Additional employees</span><span>' +
              money(quote.employeeAmount, quote.currency) +
              '</span></div><div class="plan-quote-row"><span>Feature add-ons</span><span>' +
              money(quote.featureAmount, quote.currency) +
              '</span></div><div class="plan-quote-row plan-quote-total"><span>Total recurring price</span><span>' +
              money(quote.totalAmount, quote.currency) +
              " / " +
              esc(quote.billingInterval.toLowerCase()) +
              "</span></div>";
          })
          .catch(function (error) {
            if (error && error.code === "TENANT_SESSION_EXPIRED") return;
            showError(error.message);
          });
      }

      document
        .getElementById("plan-employee-count")
        .addEventListener("change", refreshQuote);
      addOnContainer.addEventListener("change", refreshQuote);
      refreshQuote();
    }
  }

  function openCancelDialog() {
    document.getElementById("cancel-subscription-modal").style.display = "flex";
  }

  function closeCancelDialog() {
    document.getElementById("cancel-subscription-modal").style.display = "none";
  }

  function cancelSubscription() {
    var button = document.getElementById("confirm-cancel-subscription");
    button.disabled = true;
    request("/api/v1/tenant/subscription/cancellations", {
      method: "POST",
      body: { reason: "Cancelled by Configuration Manager" },
    })
      .then(function () {
        closeCancelDialog();
        return load();
      })
      .catch(function (error) {
        if (error && error.code === "TENANT_SESSION_EXPIRED") return;
        button.disabled = false;
        showError(error.message);
      });
  }

  function load() {
    if (!window.FinStackTenantSession || !window.FinStackTenantSession.isTenantAuthenticated()) {
      window.location.href = "../../login.html?role=configuration_manager";
      return Promise.resolve();
    }
    hideError();
    return Promise.all([
      request("/api/v1/tenant/subscription"),
      request("/api/v1/tenant/subscription/invoices"),
      request("/api/v1/tenant/subscription/payments"),
    ])
      .then(function (result) {
        render(result[0], result[1], result[2]);
      })
      .catch(function (error) {
        if (error && error.code === "TENANT_SESSION_EXPIRED") return;
        showError(error.message);
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (typeof initLayout === "function") {
      initLayout("Subscription");
      if (typeof initSidebar === "function") initSidebar();
      if (typeof initTopNav === "function") initTopNav();
    }
    document
      .getElementById("close-plan-modal")
      .addEventListener("click", closeChangePlan);
    document
      .getElementById("cancel-plan-modal")
      .addEventListener("click", closeChangePlan);
    document
      .getElementById("dismiss-cancel-modal")
      .addEventListener("click", closeCancelDialog);
    document
      .getElementById("confirm-cancel-subscription")
      .addEventListener("click", cancelSubscription);
    load();
  });
})();
