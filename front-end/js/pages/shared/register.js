document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("reg-form");
  var planSelect = document.getElementById("reg-plan-id");
  var errorBox = document.getElementById("reg-error");
  var errorText = document.getElementById("reg-error-text");
  var registrationCard = document.getElementById("registration-card");
  var successCard = document.getElementById("success-card");
  var formView = document.getElementById("form-view");
  var employeeCountInput = document.getElementById("reg-employee-count");
  var pricePreview = document.getElementById("reg-price-preview");
  var addOnOptions = document.getElementById("reg-addon-options");
  var plans = [];
  var quoteTimer = null;

  var base =
    window.FinStackApi && window.FinStackApi.baseUrl
      ? window.FinStackApi.baseUrl
      : "http://localhost:3000";

  function showError(message) {
    if (errorBox && errorText) {
      errorText.textContent = message;
      errorBox.style.display = "block";
    }
  }

  function hideError() {
    if (errorBox) {
      errorBox.style.display = "none";
    }
  }

  function read(response) {
    return response.text().then(function (text) {
      var payload = text ? JSON.parse(text) : null;

      if (!response.ok) {
        var msg = payload && (payload.message || payload.error);

        throw new Error(
          Array.isArray(msg)
            ? msg.join(", ")
            : msg || "Request failed.",
        );
      }

      return payload && payload.data ? payload.data : payload;
    });
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function refreshQuote() {
    var planId = planSelect && planSelect.value;
    var employeeCount =
      employeeCountInput && Number(employeeCountInput.value);

    if (
      !planId ||
      !Number.isInteger(employeeCount) ||
      employeeCount < 1 ||
      !pricePreview
    ) {
      return;
    }

    var featureIds = Array.prototype.map.call(
      document.querySelectorAll(".reg-addon:checked"),
      function (input) {
        return input.value;
      },
    );

    fetch(base + "/api/v1/tenant/onboarding/quotes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        planId: planId,
        employeeCount: employeeCount,
        featureIds: featureIds,
      }),
    })
      .then(read)
      .then(function (quote) {
        pricePreview.style.display = "block";

        pricePreview.innerHTML =
          "<strong>Server-calculated recurring quote</strong>" +
          "<div style='margin-top:8px;display:grid;gap:4px'>" +
          "<div>Base plan <span style='float:right'>" + quote.currency + " " + quote.baseAmount + "</span></div>" +
          "<div>Additional employees <span style='float:right'>" + quote.currency + " " + quote.employeeAmount + "</span></div>" +
          "<div>Paid add-ons <span style='float:right'>" + quote.currency + " " + quote.featureAmount + "</span></div>" +
          "<div style='margin-top:5px;padding-top:5px;border-top:1px solid var(--border-default)'><strong>Total <span style='float:right'>" + quote.currency + " " + quote.totalAmount + " / " + quote.billingInterval.toLowerCase() + "</span></strong></div></div>" +
          "<div style='font-size:.75rem;margin-top:8px;color:var(--text-secondary)'>Included seats: " + quote.includedEmployees + "; requested: " + quote.employeeCount + "; additional billable: " + quote.additionalEmployees + "</div>";
      })
      .catch(function () {
        pricePreview.style.display = "none";
      });
  }

  function scheduleQuote() {
    window.clearTimeout(quoteTimer);
    quoteTimer = window.setTimeout(refreshQuote, 250);
  }

  window.toggleRegPw = function (id) {
    var input = document.getElementById(id);

    if (input) {
      input.type =
        input.type === "password" ? "text" : "password";
    }
  };

  fetch(base + "/api/v1/tenant/onboarding/plans")
    .then(read)
    .then(function (data) {
      if (!planSelect) {
        return;
      }

      planSelect.innerHTML =
        '<option value="">Select a plan</option>';

      plans = data.items || [];

      plans.forEach(function (plan) {
        var option = document.createElement("option");

        option.value = plan.id;

        option.textContent =
          plan.name +
          " - " +
          plan.currency +
          " " +
          plan.basePrice +
          " / " +
          String(plan.billingInterval).toLowerCase();

        planSelect.appendChild(option);
      });

      if (!plans.length) {
        planSelect.innerHTML =
          '<option value="">No active plans available</option>';
      }

      planSelect.addEventListener("change", function () {
        var plan = plans.filter(function (item) {
          return item.id === planSelect.value;
        })[0];

        var addOns = plan
          ? plan.features.filter(function (feature) {
              return feature.isAddOn;
            })
          : [];
        var included = plan
          ? plan.features.filter(function (feature) { return !feature.isAddOn; })
          : [];

        if (addOnOptions) {
          addOnOptions.style.display = (addOns.length || included.length)
            ? "block"
            : "none";

          addOnOptions.innerHTML =
            (included.length ? "<label class='form-label'>Included features</label><div style='font-size:.75rem;color:var(--text-secondary);margin:6px 0 12px'>" + included.map(function (feature) { return feature.name; }).join(" · ") + "</div>" : "") +
            (addOns.length
            ? "<label class='form-label'>Optional paid add-ons</label>" +
              addOns
                .map(function (feature) {
                  return (
                    "<label style='display:block;margin:8px 0;color:var(--text-secondary)'>" +
                    "<input class='reg-addon' type='checkbox' value='" +
                    feature.id +
                    "'> " +
                    feature.name +
                    " (" +
                    plan.currency +
                    " " +
                    feature.addOnPrice +
                    ")" +
                "</label>"
                  );
                })
                .join("")
            : "");

          Array.prototype.forEach.call(
            document.querySelectorAll(".reg-addon"),
            function (input) {
              input.addEventListener(
                "change",
                scheduleQuote,
              );
            },
          );
        }

        refreshQuote();
      });

      if (employeeCountInput) {
        employeeCountInput.addEventListener(
          "input",
          scheduleQuote,
        );
      }
    })
    .catch(function (error) {
      if (planSelect) {
        planSelect.innerHTML =
          '<option value="">Unable to load plans</option>';
      }

      showError(error.message);
    });

  if (!form) {
    return;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    hideError();

    var orgName = document
      .getElementById("reg-org-name")
      .value.trim();

    var orgEmail = document
      .getElementById("reg-org-email")
      .value.trim();

    var slug = document
      .getElementById("org-id-input")
      .value.trim()
      .toLowerCase();

    var nameParts = document
      .getElementById("reg-admin-name")
      .value.trim()
      .split(/\s+/);

    var email = document
      .getElementById("reg-admin-email")
      .value.trim();

    var password =
      document.getElementById("reg-password").value;

    var confirm =
      document.getElementById("reg-confirm-password").value;

    var planId = planSelect
      ? planSelect.value
      : "";

    var featureIds = Array.prototype.map.call(
      document.querySelectorAll(".reg-addon:checked"),
      function (input) {
        return input.value;
      },
    );

    var employeeCount = employeeCountInput
      ? Number(employeeCountInput.value)
      : 0;

    if (orgName.length < 2) {
      return showError(
        "Organization name must be at least 2 characters.",
      );
    }

    if (!validEmail(orgEmail) || !validEmail(email)) {
      return showError(
        "Please enter valid organization and administrator emails.",
      );
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return showError(
        "Organization ID must use lowercase letters, numbers, and hyphens.",
      );
    }

    if (!planId) {
      return showError(
        "Please select an active plan.",
      );
    }

    if (
      !Number.isInteger(employeeCount) ||
      employeeCount < 1
    ) {
      return showError(
        "Enter a positive whole number of employees.",
      );
    }

    if (password.length < 8 || password !== confirm) {
      return showError(
        password.length < 8
          ? "Password must be at least 8 characters."
          : "Passwords do not match.",
      );
    }

    var submit = form.querySelector(
      'button[type="submit"]',
    );

    if (submit) {
      submit.disabled = true;
    }

    fetch(
      base +
        "/api/v1/tenant/registrations/organizations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: orgName,
          slug: slug,
          primaryEmail: orgEmail,
          firstName: nameParts[0],
          lastName:
            nameParts.slice(1).join(" ") ||
            nameParts[0],
          email: email,
          password: password,
          planId: planId,
          employeeCount: employeeCount,
          featureIds: featureIds,
        }),
      },
    )
      .then(read)
      .then(function (result) {
        if (formView) {
          formView.style.display = "none";
        }

        if (registrationCard) {
          registrationCard.style.display = "none";
        }

        if (successCard) {
          successCard.style.display = "block";
        }

        var nameEl =
          document.getElementById(
            "success-org-name",
          );

        var emailEl =
          document.getElementById(
            "success-org-email",
          );

        var idEl =
          document.getElementById(
            "success-org-id",
          );

        var empEl =
          document.getElementById(
            "success-admin-emp-id",
          );

        var planEl =
          document.getElementById(
            "success-plan",
          );

        var statusEl =
          document.getElementById(
            "success-subscription-status",
          );

        if (nameEl) {
          nameEl.textContent = orgName;
        }

        if (emailEl) {
          emailEl.textContent = orgEmail;
        }

        if (idEl) {
          idEl.textContent =
            result.organizationSlug || result.organizationId;
        }

        if (empEl) {
          empEl.textContent =
            result.user.employeeId;
        }

        if (planEl) {
          planEl.textContent =
            result.subscription.plan.name;
        }

        if (statusEl) {
          statusEl.textContent =
            result.subscription.status;
        }
      })
      .catch(function (error) {
        showError(
          error.message ||
            "Registration failed.",
        );

        if (submit) {
          submit.disabled = false;
        }
      });
  });
});
