(function () {
  "use strict";

  function createElement(tag, className, text) {
    var element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = text;

    return element;
  }

  function apiBaseUrl() {
    return window.FinStackApi && window.FinStackApi.baseUrl
      ? window.FinStackApi.baseUrl
      : "http://localhost:3000";
  }

  function readResponse(response) {
    return response.text().then(function (text) {
      var payload = text ? JSON.parse(text) : null;

      if (!response.ok) {
        throw new Error("Active plans could not be loaded.");
      }

      return payload && Object.prototype.hasOwnProperty.call(payload, "data")
        ? payload.data
        : payload;
    });
  }

  function formatMoney(amount, currency) {
    var numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount)) {
      return currency + " " + amount;
    }

    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(numericAmount);
    } catch (error) {
      return currency + " " + amount;
    }
  }

  function intervalLabel(interval) {
    return String(interval || "").toLowerCase() || "billing period";
  }

  function appendFeatureGroup(card, title, features, currency, showPrice) {
    if (!features.length) return;

    var group = createElement("div", "landing-pricing-feature-group");
    var heading = createElement("p", "landing-pricing-feature-heading", title);
    var list = createElement("ul", "landing-pricing-feature-list");

    features.forEach(function (feature) {
      var label = feature.name || feature.key;

      if (showPrice) {
        label += " (" + formatMoney(feature.addOnPrice, currency) + ")";
      } else if (feature.value !== null && feature.value !== undefined) {
        label += ": " + (feature.value === true ? "Enabled" : String(feature.value));
      }

      list.appendChild(createElement("li", "", label));
    });

    group.appendChild(heading);
    group.appendChild(list);
    card.appendChild(group);
  }

  function renderPlan(plan) {
    var card = createElement("article", "landing-pricing-card");
    var header = createElement("div", "landing-pricing-card-header");
    var title = createElement("h3", "", plan.name || plan.key || "FinStack plan");
    var description = createElement("p", "", plan.description || "Active FinStack plan.");
    var price = createElement("div", "landing-pricing-price");
    var metadata = createElement("dl", "landing-pricing-meta");
    var includedFeatures = (plan.features || []).filter(function (feature) {
      return !feature.isAddOn;
    });
    var addOns = (plan.features || []).filter(function (feature) {
      return feature.isAddOn;
    });
    var trialDays = Number(plan.trialDays);
    var action = createElement(
      "a",
      "landing-hero-btn landing-hero-btn-primary",
      trialDays > 0 ? "Start Free Trial" : "Get Started",
    );

    action.href = "views/shared/register.html";
    price.appendChild(createElement("strong", "", formatMoney(plan.basePrice, plan.currency)));
    price.appendChild(createElement("span", "", "/ " + intervalLabel(plan.billingInterval)));
    header.appendChild(title);
    header.appendChild(description);
    card.appendChild(header);
    card.appendChild(price);

    [
      ["Included employees", String(plan.includedEmployeeCount) + " seats"],
      ["Additional employee", formatMoney(plan.additionalEmployeePrice, plan.currency) + " / employee"],
    ].forEach(function (item) {
      var row = createElement("div");
      var term = createElement("dt", "", item[0]);
      var definition = createElement("dd", "", item[1]);

      row.appendChild(term);
      row.appendChild(definition);
      metadata.appendChild(row);
    });

    card.appendChild(metadata);
    appendFeatureGroup(card, "Included features", includedFeatures, plan.currency, false);
    appendFeatureGroup(card, "Optional paid add-ons", addOns, plan.currency, true);

    if (trialDays > 0) {
      card.appendChild(createElement("p", "landing-pricing-trial", trialDays + "-day trial available"));
    }

    card.appendChild(action);
    return card;
  }

  function loadPlans() {
    var status = document.getElementById("pricing-status");
    var grid = document.getElementById("pricing-plan-grid");

    if (!status || !grid) return;

    fetch(apiBaseUrl() + "/api/v1/tenant/onboarding/plans")
      .then(readResponse)
      .then(function (data) {
        var plans = data && Array.isArray(data.items) ? data.items : [];

        grid.replaceChildren();
        status.classList.remove("is-error");

        if (!plans.length) {
          status.textContent = "No active plans are available at the moment.";
          return;
        }

        plans.forEach(function (plan) {
          grid.appendChild(renderPlan(plan));
        });

        status.textContent = "";
      })
      .catch(function () {
        grid.replaceChildren();
        status.classList.add("is-error");
        status.textContent = "Pricing is temporarily unavailable. Please try again later.";
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadPlans);
  } else {
    loadPlans();
  }
})();
