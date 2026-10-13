// Reused legal-identity/domain validation from the current registration UI.
export const countryCodes = [
  "AD",
  "AE",
  "AF",
  "AG",
  "AI",
  "AL",
  "AM",
  "AO",
  "AQ",
  "AR",
  "AS",
  "AT",
  "AU",
  "AW",
  "AX",
  "AZ",
  "BA",
  "BB",
  "BD",
  "BE",
  "BF",
  "BG",
  "BH",
  "BI",
  "BJ",
  "BL",
  "BM",
  "BN",
  "BO",
  "BQ",
  "BR",
  "BS",
  "BT",
  "BV",
  "BW",
  "BY",
  "BZ",
  "CA",
  "CC",
  "CD",
  "CF",
  "CG",
  "CH",
  "CI",
  "CK",
  "CL",
  "CM",
  "CN",
  "CO",
  "CR",
  "CU",
  "CV",
  "CW",
  "CX",
  "CY",
  "CZ",
  "DE",
  "DJ",
  "DK",
  "DM",
  "DO",
  "DZ",
  "EC",
  "EE",
  "EG",
  "EH",
  "ER",
  "ES",
  "ET",
  "FI",
  "FJ",
  "FK",
  "FM",
  "FO",
  "FR",
  "GA",
  "GB",
  "GD",
  "GE",
  "GF",
  "GG",
  "GH",
  "GI",
  "GL",
  "GM",
  "GN",
  "GP",
  "GQ",
  "GR",
  "GS",
  "GT",
  "GU",
  "GW",
  "GY",
  "HK",
  "HM",
  "HN",
  "HR",
  "HT",
  "HU",
  "ID",
  "IE",
  "IL",
  "IM",
  "IN",
  "IO",
  "IQ",
  "IR",
  "IS",
  "IT",
  "JE",
  "JM",
  "JO",
  "JP",
  "KE",
  "KG",
  "KH",
  "KI",
  "KM",
  "KN",
  "KP",
  "KR",
  "KW",
  "KY",
  "KZ",
  "LA",
  "LB",
  "LC",
  "LI",
  "LK",
  "LR",
  "LS",
  "LT",
  "LU",
  "LV",
  "LY",
  "MA",
  "MC",
  "MD",
  "ME",
  "MF",
  "MG",
  "MH",
  "MK",
  "ML",
  "MM",
  "MN",
  "MO",
  "MP",
  "MQ",
  "MR",
  "MS",
  "MT",
  "MU",
  "MV",
  "MW",
  "MX",
  "MY",
  "MZ",
  "NA",
  "NC",
  "NE",
  "NF",
  "NG",
  "NI",
  "NL",
  "NO",
  "NP",
  "NR",
  "NU",
  "NZ",
  "OM",
  "PA",
  "PE",
  "PF",
  "PG",
  "PH",
  "PK",
  "PL",
  "PM",
  "PN",
  "PR",
  "PS",
  "PT",
  "PW",
  "PY",
  "QA",
  "RE",
  "RO",
  "RS",
  "RU",
  "RW",
  "SA",
  "SB",
  "SC",
  "SD",
  "SE",
  "SG",
  "SH",
  "SI",
  "SJ",
  "SK",
  "SL",
  "SM",
  "SN",
  "SO",
  "SR",
  "SS",
  "ST",
  "SV",
  "SX",
  "SY",
  "SZ",
  "TC",
  "TD",
  "TF",
  "TG",
  "TH",
  "TJ",
  "TK",
  "TL",
  "TM",
  "TN",
  "TO",
  "TR",
  "TT",
  "TV",
  "TW",
  "TZ",
  "UA",
  "UG",
  "UM",
  "US",
  "UY",
  "UZ",
  "VA",
  "VC",
  "VE",
  "VG",
  "VI",
  "VN",
  "VU",
  "WF",
  "WS",
  "YE",
  "YT",
  "ZA",
  "ZM",
  "ZW",
];
function domain(email) {
  try {
    return new URL("https://" + email.split("@")[1]).hostname.toLowerCase();
  } catch (_) {
    return "";
  }
}
export function registrationErrors(v, allowTestDomains) {
  var out = {},
    emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  ["name", "firstName", "lastName", "authorizedContactTitle"].forEach(
    function (key) {
      if (!v[key].trim()) out[key] = "This field is required.";
      else if (
        v[key].trim().length >
        {
          name: 180,
          firstName: 100,
          lastName: 100,
          authorizedContactTitle: 120,
        }[key]
      )
        out[key] = "This value is too long.";
      else if (/[\p{Cc}\p{Cf}<>]/u.test(v[key]))
        out[key] = "Remove control characters or markup.";
    },
  );
  if (v.name.trim().length < 2)
    out.name = "Enter the legal organization name (at least 2 characters).";
  if (v.authorizedContactTitle.trim().length < 2)
    out.authorizedContactTitle =
      "Enter your contact title (at least 2 characters).";
  if (countryCodes.indexOf(v.registrationCountry) < 0)
    out.registrationCountry = "Select the registration country.";
  var id = v.registrationIdentifier.normalize("NFKC").trim(),
    exemption = v.registrationExemptionReason.trim();
  if (Boolean(id) === Boolean(exemption))
    out.registrationIdentifier =
      "Provide a registration identifier or explain why none applies, but not both.";
  if (id && !/^[\p{L}\p{N}][\p{L}\p{N} ._\/()&:-]{0,159}$/u.test(id))
    out.registrationIdentifier =
      "Use the issued identifier with letters, numbers and ordinary identifier punctuation.";
  if (
    exemption &&
    (exemption.length < 10 ||
      exemption.length > 500 ||
      /[\p{Cc}\p{Cf}<>]/u.test(exemption))
  )
    out.registrationExemptionReason =
      "Explain why no identifier applies in 10-500 characters.";
  if (v.primaryEmail.length > 320 || !emailPattern.test(v.primaryEmail))
    out.primaryEmail = "Enter a valid official organization email.";
  var official = domain(v.primaryEmail);
  if (
    /^(gmail.com|googlemail.com|yahoo.com|outlook.com|hotmail.com|live.com|icloud.com|aol.com|proton.me|protonmail.com)$/.test(
      official,
    ) ||
    (/(?:^|\.)(test|example|invalid|localhost)$/.test(official) &&
      !(allowTestDomains === true && official.endsWith(".test")))
  )
    out.primaryEmail =
      "Use a publicly usable organization domain, rather than a personal or reserved example domain.";
  if (v.email.length > 320 || !emailPattern.test(v.email))
    out.email = "Enter a valid authorized contact email.";
  else if (domain(v.email) !== official)
    out.email = "Use the same organization domain as the official email.";
  if (v.password.length < 8 || v.password.length > 200)
    out.password = "Use 8â€“200 characters for this new password.";
  if (!v.confirmPassword || v.password !== v.confirmPassword)
    out.confirmPassword = "Passwords must match.";
  if (!v.planId) out.planId = "Select an active plan.";
  if (
    !Number.isInteger(v.employeeCount) ||
    v.employeeCount < 1 ||
    v.employeeCount > 1000000
  )
    out.employeeCount = "Enter a whole number from 1 to 1,000,000.";
  return out;
}
