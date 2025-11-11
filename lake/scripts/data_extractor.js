const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// --- Start of original owner_data.js content ---

function normSpace(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function extractPropertyId($) {
  // Prefer explicit table row label "Parcel ID:"
  let id = null;
  $("tr").each((_, tr) => {
    if (id) return;
    const tds = $(tr).find("td");
    if (tds.length >= 2) {
      const label = normSpace($(tds[0]).text());
      if (/^parcel\s*id\s*:$/i.test(label) || /^parcel\s*id\b/i.test(label)) {
        const candidate = normSpace($(tds[1]).text());
        if (candidate) id = candidate;
      }
    }
  });
  // Fallbacks if not found exactly
  if (!id) {
    const el = $('*:contains("Parcel ID")')
      .filter((_, e) => /parcel\s*id/i.test($(e).text()))
      .first();
    if (el && el.length) {
      // Try next sibling text
      const sib = el.next();
      const candidate = normSpace(sib.text());
      if (candidate) id = candidate;
    }
  }
  // --- NEW: Specific extraction for Parcel Number from your HTML ---
  if (!id) {
    const parcelNumberCell = $('td.property_field:contains("Parcel Number:")').next('td.property_item');
    if (parcelNumberCell.length) {
      id = normSpace(parcelNumberCell.text());
    }
  }
  // --- END NEW ---

  if (!id) return "unknown_id";
  // Clean ID
  id = id.replace(/[^A-Za-z0-9_-]+/g, "");
  return id || "unknown_id";
}

// --- UPDATED HELPER FUNCTION ---
const LEGAL_DESIGNATIONS_REGEX = new RegExp(
  "\\b(?:LIFE\\s*EST(?:ATE)?|EST(?:ATE)?|TRUST(?:EE)?|TR(?:USTEE)?|TTEE|REVOCABLE|IRREVOCABLE|EXECUTOR|EXR|ADMINISTRATOR|ADMR|PERSONAL\\s*REPRESENTATIVE|PR|HEIR|HEIRS|DECEASED|DEC'D|DEC|ET\\s*AL|ETAL|JTWROS|TENANTS?\\s*IN\\s*COMMON|TIC|TENANCY\\s*BY\\s*THE\\s*ENTIRETY|TBE|JOINT\\s*TENANTS?|JT|SURVIVOR|SURVIVORS?|AS\\s*TENANTS?\\s*IN\\s*COMMON|AS\\s*JOINT\\s*TENANTS?|AS\\s*COMMUNITY\\s*PROPERTY|AS\\s*SOLE\\s*AND\\s*SEPARATE\\s*PROPERTY|AS\\s*HUSBAND\\s*AND\\s*WIFE|AS\\s*COMMUNITY\\s*PROPERTY\\s*WITH\\s*RIGHT\\s*OF\\s*SURVIVORSHIP|A\\s*SINGLE\\s*MAN|A\\s*SINGLE\\s*WOMAN|A\\s*MARRIED\\s*MAN|A\\s*MARRIED\\s*WOMAN|A\\s*WIDOW|A\\s*WIDOWER|A\\s*PARTNERSHIP|A\\s*CORPORATION|A\\s*LIMITED\\s*LIABILITY\\s*COMPANY|A\\s*TRUST|A\\s*TRUSTEE|A\\s*FIDUCIARY|A\\s*BENEFICIARY|A\\s*GRANTOR|A\\s*GRANTEE|A\\s*DONOR|A\\s*DONEE|A\\s*SETTLOR|A\\s*SETTLEE|A\\s*DEVISEE|A\\s*LEGATEE|A\\s*ASSIGNEE|A\\s*ASSIGNOR|A\\s*MORTGAGEE|A\\s*MORTGAGOR|A\\s*LIENOR|A\\s*LIENEE|A\\s*GRANTOR\\s*TRUST|A\\s*NON-GRANTOR\\s*TRUST|A\\s*QUALIFIED\\s*PERSONAL\\s*RESIDENCE\\s*TRUST|QPRT|A\\s*CHARITABLE\\s*REMAINDER\\s*TRUST|CRT|A\\s*CHARITABLE\\s*LEAD\\s*TRUST|CLT|A\\s*SPECIAL\\s*NEEDS\\s*TRUST|SNT|A\\s*SUPPLEMENTAL\\s*NEEDS\\s*TRUST|SNT|A\\s*BLIND\\s*TRUST|A\\s*SPENDTHRIFT\\s*TRUST|A\\s*GENERATION-SKIPPING\\s*TRUST|GST|A\\s*LAND\\s*TRUST|A\\s*BUSINESS\\s*TRUST|A\\s*REAL\\s*ESTATE\\s*INVESTMENT\\s*TRUST|REIT|A\\s*FAMILY\\s*LIMITED\\s*PARTNERSHIP|FLP|A\\s*LIMITED\\s*LIABILITY\\s*PARTNERSHIP|LLP|A\\s*PROFESSIONAL\\s*CORPORATION|PC|A\\s*PROFESSIONAL\\s*LIMITED\\s*LIABILITY\\s*COMPANY|PLLC|A\\s*NON-PROFIT\\s*CORPORATION|A\\s*RELIGIOUS\\s*CORPORATION|A\\s*EDUCATIONAL\\s*CORPORATION|A\\s*CHARITABLE\\s*CORPORATION|A\\s*PUBLIC\\s*BENEFIT\\s*CORPORATION|A\\s*PRIVATE\\s*FOUNDATION|A\\s*PUBLIC\\s*CHARITY|A\\s*GOVERNMENTAL\\s*ENTITY|A\\s*MUNICIPALITY|A\\s*COUNTY|A\\s*STATE|THE\\s*UNITED\\s*STATES\\s*OF\\s*AMERICA|THE\\s*STATE\\s*OF|THE\\s*COUNTY\\s*OF|THE\\s*CITY\\s*OF|THE\\s*TOWN\\s*OF|THE\\s*VILLAGE\\s*OF|THE\\s*SCHOOL\\s*DISTRICT\\s*OF|THE\\s*WATER\\s*DISTRICT\\s*OF|THE\\s*SEWER\\s*DISTRICT\\s*OF|THE\\s*FIRE\\s*DISTRICT\\s*OF|THE\\s*HOSPITAL\\s*DISTRICT\\s*OF|THE\\s*PORT\\s*AUTHORITY\\s*OF|THE\\s*HOUSING\\s*AUTHORITY\\s*OF|THE\\s*REDEVELOPMENT\\s*AGENCY\\s*OF|THE\\s*COMMUNITY\\s*REDEVELOPMENT\\s*AGENCY\\s*OF|THE\\s*SUCCESSOR\\s*AGENCY\\s*TO\\s*THE\\s*REDEVELOPMENT\\s*AGENCY\\s*OF|THE\\s*JOINT\\s*POWERS\\s*AUTHORITY\\s*OF|THE\\s*JOINT\\s*POWERS\\s*AGENCY\\s*OF|THE\\s*JOINT\\s*POWERS\\s*BOARD\\s*OF|THE\\s*JOINT\\s*POWERS\\s*COMMISSION\\s*OF|THE\\s*JOINT\\s*POWERS\\s*ENTITY\\s*OF|THE\\s*JOINT\\s*POWERS\\s*ORGANIZATION\\s*OF|THE\\s*JOINT\\s*POWERS\\s*UNIT\\s*OF|THE\\s*JOINT\\s*POWERS\\s*VENTURE\\s*OF|THE\\s*JOINT\\s*POWERS\\s*AGREEMENT\\s*OF|THE\\s*JOINT\\s*POWERS\\s*AUTHORITY\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*AGENCY\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*BOARD\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*COMMISSION\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*ENTITY\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*ORGANIZATION\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*UNIT\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*VENTURE\\s*FOR|THE\\s*JOINT\\s*POWERS\\s*AGREEMENT\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*STATE\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*COUNTY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*CITY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*TOWN\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*VILLAGE\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*SCHOOL\\s*DISTRICT\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*WATER\\s*DISTRICT\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*SEWER\\s*DISTRICT\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*FIRE\\s*DISTRICT\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*HOSPITAL\\s*DISTRICT\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*PORT\\s*AUTHORITY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*HOUSING\\s*AUTHORITY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*REDEVELOPMENT\\s*AGENCY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*COMMUNITY\\s*REDEVELOPMENT\\s*AGENCY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*SUCCESSOR\\s*AGENCY\\s*TO\\s*THE\\s*REDEVELOPMENT\\s*AGENCY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*AUTHORITY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*AGENCY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*BOARD\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*COMMISSION\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*ENTITY\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*ORGANIZATION\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*UNIT\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*VENTURE\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*AGREEMENT\\s*OF|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*AUTHORITY\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*AGENCY\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*BOARD\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*COMMISSION\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*ENTITY\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*ORGANIZATION\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*UNIT\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*VENTURE\\s*FOR|THE\\s*PEOPLE\\s*OF\\s*THE\\s*JOINT\\s*POWERS\\s*AGREEMENT\\s*FOR|\\bFBO\\b|\\bIRA\\b\\s*#?\\s*\\d+\\b|\\bSEP\\s*IRA\\b|\\bROTH\\s*IRA\\b|\\b401K\\b|\\b403B\\b|\\bKEOGH\\b|\\bPENSION\\s*PLAN\\b|\\bPROFIT\\s*SHARING\\s*PLAN\\b|\\bRETIREMENT\\s*PLAN\\b)\\b",
  "gi"
);

function stripLegalDesignations(name) {
  let cleanedName = name;
  const removedDesignations = [];
  let match;

  // Create a local, mutable copy of the regex to reset lastIndex
  const localRegex = new RegExp(LEGAL_DESIGNATIONS_REGEX.source, "gi");

  // Use a loop to remove all occurrences and capture them
  while ((match = localRegex.exec(cleanedName)) !== null) {
    removedDesignations.push(match[0].trim());
    cleanedName = cleanedName.replace(match[0], " ").trim();
    localRegex.lastIndex = 0; // Reset for next iteration on the potentially modified string
  }

  // Remove any remaining commas or extra spaces after removal
  cleanedName = cleanedName.replace(/,+/g, " ").replace(/\s{2,}/g, " ").trim();

  return {
    cleanedName: cleanedName,
    removedDesignations: removedDesignations.length > 0 ? removedDesignations : null,
  };
}

function isCompanyName(name) {
  const n = (name || "").toLowerCase();

  // Explicit checks for common trust/estate patterns
  if (/\btrustee\s+for\b/i.test(n)) return true;
  if (/\btrust\b/i.test(n) && /\btrustee\b/i.test(n)) return true;
  if (/\b\w+\s+trust\s*$/i.test(n)) return true;
  if (/\bestate\s+of\b/i.test(n)) return true; // e.g., "Estate of John Doe"
  // Added specific check for FBO (For the Benefit Of) as it often indicates a trust or account
  if (/\bfbo\b/i.test(n)) return true;
  // Added specific check for IRA as it's an account type, not a person's name
  if (/\bira\b/i.test(n)) return true;


  const kws = [
    "inc",
    "inc.",
    "llc",
    "l.l.c",
    "ltd",
    "foundation",
    "alliance",
    "solutions",
    "corp",
    "corp.",
    "co",
    "co.",
    "services",
    "trust", // Keep trust as a general keyword
    "trustee", // Keep trustee as a general keyword
    "tr",
    "ttee",
    "revocable",
    "irrevocable",
    "estate", // Keep estate as a general keyword
    "associates",
    "partners",
    "lp",
    "pllc",
    "pc",
    "company",
    "holdings",
    "group",
    "management",
    "properties",
    "realty",
    "capital",
    "church", // Added common non-profit/organizational terms
    "ministries",
    "association",
    "club",
    "society",
    "institute",
    "center",
    "community",
    "development",
    "fund",
    "bank",
    "credit union",
    "federal",
    "state",
    "county",
    "city",
    "town",
    "district",
    "authority",
    "board",
    "commission",
    "agency",
    "hospital",
    "medical",
    "school",
    "university",
    "college",
    "library",
    "museum",
    "park",
    "conservancy"
  ];
  return kws.some((kw) => new RegExp(`(^|\\b)${kw}(\\b|\\.|$)`, "i").test(n));
}

const ALLOWED_PREFIXES = [
  "Mr.",
  "Mrs.",
  "Ms.",
  "Miss",
  "Mx.",
  "Dr.",
  "Prof.",
  "Rev.",
  "Fr.",
  "Sr.",
  "Br.",
  "Capt.",
  "Col.",
  "Maj.",
  "Lt.",
  "Sgt.",
  "Hon.",
  "Judge",
  "Rabbi",
  "Imam",
  "Sheikh",
  "Sir",
  "Dame",
];

const ALLOWED_SUFFIXES = [
  "Jr.",
  "Sr.",
  "II",
  "III",
  "IV",
  "PhD",
  "MD",
  "Esq.",
  "JD",
  "LLM",
  "MBA",
  "RN",
  "DDS",
  "DVM",
  "CFA",
  "CPA",
  "PE",
  "PMP",
  "Emeritus",
  "Ret.",
];

const prefixLookup = new Map(
  ALLOWED_PREFIXES.map((p) => [p.replace(/\./g, "").toLowerCase(), p]),
);
const suffixLookup = new Map(
  ALLOWED_SUFFIXES.map((s) => [s.replace(/\./g, "").toLowerCase(), s]),
);

function normalizeTokenForLookup(token) {
  return token.replace(/\./g, "").toLowerCase();
}

function toIsoDate(s) {
  if (!s) return null;
  const str = s.trim();
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  m = str.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}-01`;
  const months = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];
  const rxMonth = new RegExp(
    `^(${months.join("|")})\\s+(?:([0-9]{1,2}),\\s*)?([0-9]{4})$`,
    "i",
  );
  m = str.match(rxMonth);
  if (m) {
    const idx = months.findIndex((x) => x === m[1].toLowerCase()) + 1;
    const mm = String(idx).padStart(2, "0");
    const dd = m[2] ? String(parseInt(m[2], 10)).padStart(2, "0") : "01";
    return `${m[3]}-${mm}-${dd}`;
  }
  return null;
}

function splitOwnerCandidates(text) {
  const cleaned = (text || "")
    .replace(/\u00A0/g, " ")
    .replace(/[|;]+/g, "\n")
    .replace(/\s*\n+\s*/g, "\n")
    .trim();
  const parts = cleaned.split(/\n+/).filter(Boolean);
  const out = [];
  parts.forEach((p) => {
    p.split(/\s+(?:and|AND|And)\s+|\s*&\s*/).forEach((x) => {
      const z = normSpace(x);
      if (z) out.push(z);
    });
  });
  return out;
}

function extractInterestInfo(raw) {
  if (!raw) return null;
  const interestRegex =
    /(\d+)\s*\/\s*(\d+)\s*(?:IN(?:T|TEREST)?\.?)?/i;
  const match = raw.match(interestRegex);
  if (!match) return null;
  const numerator = parseInt(match[1], 10);
  const denominator = parseInt(match[2], 10);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0)
    return null;
  const fraction = numerator / denominator;
  const fractionString = `${numerator}/${denominator}`;
  const cleaned = normSpace(raw.replace(match[0], " "));
  return {
    numerator,
    denominator,
    fraction,
    fractionString,
    cleaned,
  };
}

function parsePersonName(raw, contextHint) {
  const original = normSpace(raw);
  if (!original) return null;

  // --- NEW: Strip legal designations before parsing person name ---
  const { cleanedName: nameWithoutDesignations, removedDesignations } = stripLegalDesignations(original);
  const workingName = normSpace(nameWithoutDesignations);
  if (!workingName) return null; // If only designations were present

  const tryApplyPrefixSuffix = (tokens) => {
    let prefix = null;
    let suffix = null;
    if (tokens.length >= 1) {
      const firstToken = tokens[0];
      const pref = prefixLookup.get(normalizeTokenForLookup(firstToken));
      if (pref) {
        prefix = pref;
        tokens = tokens.slice(1);
      }
    }
    if (tokens.length >= 1) {
      const lastToken = tokens[tokens.length - 1];
      const suff = suffixLookup.get(normalizeTokenForLookup(lastToken));
      if (suff) {
        suffix = suff;
        tokens = tokens.slice(0, -1);
      }
    }
    return { tokens, prefix, suffix };
  };

  if (/,/.test(workingName)) {
    const [last, rest] = workingName.split(",");
    const tokens = normSpace(rest || "")
      .split(/\s+/)
      .filter(Boolean);
    let processed = tryApplyPrefixSuffix(tokens);
    const first = processed.tokens[0] || "";
    const middle = processed.tokens.slice(1).join(" ") || null;
    if (first && last)
      return {
        type: "person",
        first_name: first,
        last_name: normSpace(last),
        middle_name: middle,
        prefix_name: processed.prefix || null,
        suffix_name: processed.suffix || null,
        // Store removed designations if any, for debugging or further processing
        _removed_designations: removedDesignations,
      };
    return null;
  }
  const cleaned = workingName
    .replace(/[.,]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;
  const isUpper = cleaned === cleaned.toUpperCase();
  const inOwnerContext = contextHint && /owner/i.test(contextHint);
  if (isUpper && inOwnerContext) {
    let processed = tryApplyPrefixSuffix(tokens);
    if (processed.tokens.length < 2) processed = { ...processed, tokens };
    const last = processed.tokens[0];
    const first = processed.tokens[1] || "";
    const middle = processed.tokens.slice(2).join(" ") || null;
    if (first && last)
      return {
        type: "person",
        first_name: first,
        last_name: last,
        middle_name: middle,
        prefix_name: processed.prefix || null,
        suffix_name: processed.suffix || null,
        _removed_designations: removedDesignations,
      };
  }
  let processed = tryApplyPrefixSuffix(tokens);
  if (processed.tokens.length < 2) {
    processed = { ...processed, tokens };
  }
  const first = processed.tokens[0];
  const last = processed.tokens[processed.tokens.length - 1];
  const middle = processed.tokens.slice(1, -1).join(" ") || null;
  if (first && last)
    return {
      type: "person",
      first_name: first,
      last_name: last,
      middle_name: middle,
      prefix_name: processed.prefix || null,
      suffix_name: processed.suffix || null,
      _removed_designations: removedDesignations,
    };
  return null;
}

function ownerNormKey(owner) {
  if (!owner) return "";
  if (owner.type === "company")
    return `company:${normSpace(owner.name || "").toLowerCase()}`;
  const parts = [owner.first_name, owner.middle_name, owner.last_name]
    .map((x) => normSpace(x || "").toLowerCase())
    .filter(Boolean);
  return `person:${parts.join(" ")}`;
}

function extractOwnerGroups($) {
  const groups = [];
  // Updated labelRx to include "Name:" which is used for the owner in your HTML
  const labelRx =
    /^(owner\(s\)|owners?|owner\s*name\s*\d*|co-?owner|primary\s*owner|name)\s*:*/i;

  // Existing logic for table rows
  $("tr").each((_, tr) => {
    const tds = $(tr).find("td,th");
    if (tds.length < 2) return;
    const label = normSpace($(tds[0]).text());
    if (!labelRx.test(label)) return;

    const htmlValue = $(tds[1]).html() || "";
    const rawValue = htmlValue
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\u00A0/g, " ");
    const valueText = rawValue.replace(/\s*\n+\s*/g, "\n").trim();
    if (!valueText) return;

    // Find a date near this row (same or next row)
    let dateCandidate = null;
    const dateRx =
      /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}\/\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/i;
    const rowText = normSpace($(tr).text());
    let m = rowText.match(dateRx);
    if (m) dateCandidate = toIsoDate(m[1]);
    if (!dateCandidate) {
      const nextRow = $(tr).next("tr");
      if (nextRow && nextRow.length) {
        const rowText2 = normSpace(nextRow.text());
        const m2 = rowText2.match(dateRx);
        if (m2) dateCandidate = toIsoDate(m2[1]);
      }
    }

    groups.push({
      context: label,
      valueText,
      date: dateCandidate,
      isCurrent: true,
    }); // assume this is the current owner block
  });

  // If no direct owner label rows found, try generic spans/divs where the preceding sibling label contains Owners
  if (groups.length === 0) {
    $('td:contains("Owners")').each((_, el) => {
      const $el = $(el);
      const label = normSpace($el.text());
      if (!/owners?/i.test(label)) return;
      const tr = $el.closest("tr");
      if (!tr.length) return;
      const tds = tr.find("td");
      if (tds.length >= 2) {
        const valueText = normSpace($(tds[1]).text());
        if (valueText)
          groups.push({
            context: "Owners",
            valueText,
            date: null,
            isCurrent: true,
          });
      }
    });
  }

  // Deduplicate by valueText
  const out = [];
  const seen = new Set();
  groups.forEach((g) => {
    const key = `${g.context}::${g.valueText}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(g);
  });
  return out;
}

function parseOwnersFromGroup(valueText, contextHint) {
  const candidates = splitOwnerCandidates(valueText);
  const owners = [];
  const invalid = [];
  let pendingInterest = null;
  let pendingGroupId = null;
  let interestGroupCounter = 0;

  candidates.forEach((raw) => {
    if (!raw || /^none$/i.test(raw)) return;

    const interestInfo = extractInterestInfo(raw);
    let workingText = interestInfo ? interestInfo.cleaned : raw;
    workingText = workingText
      .replace(/\bINT\b\.?/gi, "")
      .replace(/:+$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    let owner = null;
    // --- NEW: Check for company name *before* stripping legal designations for person name ---
    // This ensures "JOHN DOE TRUSTEE" is correctly identified as a company/trust if 'TRUSTEE' is a company keyword
    // but "JOHN DOE LIFE EST" is processed as a person "JOHN DOE" with "LIFE EST" stripped.
    if (isCompanyName(workingText)) {
      owner = { type: "company", name: workingText.trim() };
    } else {
      // If not a company, try parsing as a person, which now includes stripping legal designations
      const person = parsePersonName(workingText, contextHint || "");
      if (person && person.first_name && person.last_name) owner = person;
    }

    if (!owner) {
      invalid.push({ raw, reason: "unclassified_or_insufficient_info" });
      pendingInterest = null;
      pendingGroupId = null;
      return;
    }

    owners.push(owner);

    const lastOwner = owners[owners.length - 1];
    if (!lastOwner) {
      pendingInterest = null;
      pendingGroupId = null;
      return;
    }

    if (interestInfo) {
      interestGroupCounter += 1;
      pendingInterest = interestInfo;
      pendingGroupId = `group_${interestGroupCounter}`;
      lastOwner.ownership_interest_fraction = interestInfo.fractionString;
      lastOwner.ownership_interest_decimal = Number(
        interestInfo.fraction.toFixed(6),
      );
      lastOwner.ownership_interest_percentage = Number(
        (interestInfo.fraction * 100).toFixed(4),
      );
      lastOwner.ownership_interest_group = pendingGroupId;
    } else if (pendingInterest) {
      lastOwner.ownership_interest_fraction = pendingInterest.fractionString;
      lastOwner.ownership_interest_decimal = Number(
        pendingInterest.fraction.toFixed(6),
      );
      lastOwner.ownership_interest_percentage = Number(
        (pendingInterest.fraction * 100).toFixed(4),
      );
      lastOwner.ownership_interest_group = pendingGroupId;
      pendingInterest = null;
      pendingGroupId = null;
    }
  });

  const uniq = [];
  const seen = new Set();
  for (const o of owners) {
    const key = ownerNormKey(o);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (o.middle_name === "") o.middle_name = null;
    uniq.push(o);
  }

  return { owners: uniq, invalid };
}

function buildOwnersByDate(groups) {
  const buckets = [];
  let placeholderIdx = 1;
  const globalInvalid = [];

  groups.forEach((g) => {
    const { owners, invalid } = parseOwnersFromGroup(g.valueText, g.context);
    invalid.forEach((inv) => globalInvalid.push(inv));
    if (owners.length === 0) return;
    let key = g.date ? g.date : `unknown_date_${placeholderIdx++}`;
    buckets.push({ key, owners, isCurrent: g.isCurrent });
  });

  // If nothing parsed, return empty skeleton
  if (buckets.length === 0) {
    return { owners_by_date: { current: [] }, invalid_owners: [] };
  }

  // Choose a current bucket (prefer a group marked current, else last)
  let currentOwners = [];
  const currentMarked = buckets.filter((b) => b.isCurrent);
  currentOwners = (
    currentMarked.length
      ? currentMarked[currentMarked.length - 1]
      : buckets[buckets.length - 1]
  ).owners;

  const dated = [];
  buckets.forEach((b) => {
    if (b.owners === currentOwners && !/^\d{4}-\d{2}-\d{2}$/.test(b.key))
      return; // avoid duplicating current unknown
    dated.push({ key: b.key, owners: b.owners });
  });

  const knownDates = dated.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.key));
  const unknowns = dated.filter((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d.key));
  knownDates.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const owners_by_date = {};
  unknowns.forEach((d) => {
    owners_by_date[d.key] = d.owners;
  });
  knownDates.forEach((d) => {
    owners_by_date[d.key] = d.owners;
  });
  owners_by_date.current = currentOwners;

  return { owners_by_date, invalid_owners: globalInvalid };
}

// --- End of original owner_data.js content ---


// --- Start of DOR Code Mapping ---
const DOR_CODE_MAP = {
  "00": {
    property_type: "VacantLand",
    property_usage_type: "Residential",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "0003": {
    property_type: "LandParcel",
    property_usage_type: "Residential",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: "TownhouseRowhouse",
  },
  "0004": {
    property_type: "LandParcel",
    property_usage_type: "Residential",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: "ApartmentUnit",
  },
  "0005": {
    property_type: "LandParcel",
    property_usage_type: "PlannedUnitDevelopment",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "0011": {
    property_type: "Other",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "0040": {
    property_type: "LandParcel",
    property_usage_type: "Residential",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "01": {
    property_type: "SingleFamily",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: "SingleFamilyDetached",
  },
  "0102": {
    property_type: "SingleFamily",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: "SingleFamilyDetached",
  },
  "0103": {
    property_type: "SingleFamily",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: "TownhouseRowhouse",
  },
  "02": {
    property_type: "ManufacturedHome",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: "ManufacturedHomeOnLand",
  },
  "03": {
    property_type: "MultiFamilyMoreThan10",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: "MultiFamilyMoreThan10",
  },
  "04": {
    property_type: "Condominium",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "Condominium",
    structure_form: "ApartmentUnit",
  },
  "0415": {
    property_type: "Condominium",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "Condominium",
    structure_form: "ApartmentUnit",
  },
  "05": {
    property_type: "Cooperative",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "Cooperative",
    structure_form: "ApartmentUnit",
  },
  "0500": {
    property_type: "Cooperative",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "Cooperative",
    structure_form: "ApartmentUnit",
  },
  "06": {
    property_type: "Retirement",
    property_usage_type: "Retirement",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "07": {
    property_type: "MiscellaneousResidential",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "08": {
    property_type: "MultiFamilyLessThan10",
    property_usage_type: "Residential",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: "MultiFamilyLessThan10",
  },
  "09": {
    property_type: "ResidentialCommonElementsAreas",
    property_usage_type: "ResidentialCommonElementsAreas",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "10": {
    property_type: "VacantLand",
    property_usage_type: "Commercial",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "11": {
    property_type: "Building",
    property_usage_type: "RetailStore",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "12": {
    property_type: "Building",
    property_usage_type: "Commercial",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "13": {
    property_type: "Building",
    property_usage_type: "DepartmentStore",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "14": {
    property_type: "Building",
    property_usage_type: "Supermarket",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "15": {
    property_type: "Building",
    property_usage_type: "ShoppingCenterRegional",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "16": {
    property_type: "Building",
    property_usage_type: "ShoppingCenterCommunity",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "17": {
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "18": {
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "19": {
    property_type: "Building",
    property_usage_type: "OfficeBuilding",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "20": {
    property_type: "Building",
    property_usage_type: "TransportationTerminal",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "21": {
    property_type: "Building",
    property_usage_type: "Restaurant",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "22": {
    property_type: "Building",
    property_usage_type: "Restaurant",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "23": {
    property_type: "Building",
    property_usage_type: "FinancialInstitution",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "24": {
    property_type: "Building",
    property_usage_type: "FinancialInstitution",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "25": {
    property_type: "Building",
    property_usage_type: "Commercial",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "26": {
    property_type: "Building",
    property_usage_type: "ServiceStation",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "27": {
    property_type: "Building",
    property_usage_type: "AutoSalesRepair",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "28": {
    property_type: "LandParcel",
    property_usage_type: "MobileHomePark",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "29": {
    property_type: "Building",
    property_usage_type: "WholesaleOutlet",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "30": {
    property_type: "Building",
    property_usage_type: "Ornamentals",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "31": {
    property_type: "Building",
    property_usage_type: "Theater",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "32": {
    property_type: "Building",
    property_usage_type: "Theater",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "33": {
    property_type: "Building",
    property_usage_type: "Entertainment",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "34": {
    property_type: "Building",
    property_usage_type: "Entertainment",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "35": {
    property_type: "Building",
    property_usage_type: "Entertainment",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "36": {
    property_type: "Building",
    property_usage_type: "Recreational",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "37": {
    property_type: "Building",
    property_usage_type: "Entertainment",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "38": {
    property_type: "Building",
    property_usage_type: "GolfCourse",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "39": {
    property_type: "Building",
    property_usage_type: "Hotel",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "40": {
    property_type: "VacantLand",
    property_usage_type: "Industrial",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "41": {
    property_type: "Building",
    property_usage_type: "LightManufacturing",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "42": {
    property_type: "Building",
    property_usage_type: "HeavyManufacturing",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "43": {
    property_type: "Building",
    property_usage_type: "LumberYard",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "44": {
    property_type: "Building",
    property_usage_type: "PackingPlant",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "45": {
    property_type: "Building",
    property_usage_type: "Cannery",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "46": {
    property_type: "Building",
    property_usage_type: "LightManufacturing",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "47": {
    property_type: "Building",
    property_usage_type: "MineralProcessing",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "48": {
    property_type: "Building",
    property_usage_type: "Warehouse",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "49": {
    property_type: "LandParcel",
    property_usage_type: "OpenStorage",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "50": {
    property_type: "Building",
    property_usage_type: "Agricultural",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "51": {
    property_type: "VacantLand",
    property_usage_type: "DrylandCropland",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "52": {
    property_type: "VacantLand",
    property_usage_type: "DrylandCropland",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "53": {
    property_type: "VacantLand",
    property_usage_type: "DrylandCropland",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "54": {
    property_type: "VacantLand",
    property_usage_type: "TimberLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "55": {
    property_type: "VacantLand",
    property_usage_type: "TimberLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "56": {
    property_type: "VacantLand",
    property_usage_type: "TimberLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "57": {
    property_type: "VacantLand",
    property_usage_type: "TimberLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "58": {
    property_type: "VacantLand",
    property_usage_type: "TimberLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "59": {
    property_type: "VacantLand",
    property_usage_type: "TimberLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "60": {
    property_type: "VacantLand",
    property_usage_type: "GrazingLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "61": {
    property_type: "VacantLand",
    property_usage_type: "GrazingLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "62": {
    property_type: "VacantLand",
    property_usage_type: "GrazingLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "63": {
    property_type: "VacantLand",
    property_usage_type: "GrazingLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "64": {
    property_type: "VacantLand",
    property_usage_type: "GrazingLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "65": {
    property_type: "VacantLand",
    property_usage_type: "GrazingLand",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "66": {
    property_type: "VacantLand",
    property_usage_type: "OrchardGroves",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "67": {
    property_type: "VacantLand",
    property_usage_type: "Poultry",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "68": {
    property_type: "VacantLand",
    property_usage_type: "Agricultural",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "69": {
    property_type: "VacantLand",
    property_usage_type: "Ornamentals",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "70": {
    property_type: "VacantLand",
    property_usage_type: "GovernmentProperty",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "71": {
    property_type: "Building",
    property_usage_type: "Church",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "72": {
    property_type: "Building",
    property_usage_type: "PrivateSchool",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "73": {
    property_type: "Building",
    property_usage_type: "PrivateHospital",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "74": {
    property_type: "Retirement",
    property_usage_type: "Retirement",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "75": {
    property_type: "Building",
    property_usage_type: "NonProfitCharity",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "76": {
    property_type: "Building",
    property_usage_type: "MortuaryCemetery",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "77": {
    property_type: "LandParcel",
    property_usage_type: "Unknown",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "78": {
    property_type: "Retirement",
    property_usage_type: "Retirement",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "79": {
    property_type: "Building",
    property_usage_type: "CulturalOrganization",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "80": {
    property_type: "VacantLand",
    property_usage_type: "GovernmentProperty",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "81": {
    property_type: "Building",
    property_usage_type: "Military",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "82": {
    property_type: "LandParcel",
    property_usage_type: "ForestParkRecreation",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "83": {
    property_type: "Building",
    property_usage_type: "PublicSchool",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "84": {
    property_type: "Building",
    property_usage_type: "CollegeUniversity",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "85": {
    property_type: "Building",
    property_usage_type: "PublicHospital",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "86": {
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "87": {
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "88": {
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "89": {
    property_type: "Building",
    property_usage_type: "GovernmentProperty",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "90": {
    property_type: "VacantLand",
    property_usage_type: "Unknown",
    build_status: "Unknown",
    ownership_estate_type: "Leasehold",
    structure_form: null,
  },
  "91": {
    property_type: "LandParcel",
    property_usage_type: "Utility",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "92": {
    property_type: "Building",
    property_usage_type: "MineralProcessing",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "93": {
    property_type: "VacantLand",
    property_usage_type: "Unknown",
    build_status: "VacantLand",
    ownership_estate_type: "SubsurfaceRights",
    structure_form: null,
  },
  "94": {
    property_type: "VacantLand",
    property_usage_type: "Unknown",
    build_status: "VacantLand",
    ownership_estate_type: "RightOfWay",
    structure_form: null,
  },
  "95": {
    property_type: "LandParcel",
    property_usage_type: "RiversLakes",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "96": {
    property_type: "LandParcel",
    property_usage_type: "TransitionalProperty",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "97": {
    property_type: "LandParcel",
    property_usage_type: "ForestParkRecreation",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "9800": {
    property_type: "Other",
    property_usage_type: "Utility",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "9801": {
    property_type: "Building",
    property_usage_type: "Utility",
    build_status: "Improved",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
  "9802": {
    property_type: "VacantLand",
    property_usage_type: "TransportationTerminal",
    build_status: "VacantLand",
    ownership_estate_type: "RightOfWay",
    structure_form: null,
  },
  "99": {
    property_type: "VacantLand",
    property_usage_type: "TransitionalProperty",
    build_status: "VacantLand",
    ownership_estate_type: "FeeSimple",
    structure_form: null,
  },
};

function mapDorCodeToEnums(rawCode) {
  if (!rawCode) return null;
  const digits = String(rawCode).replace(/[^\d]/g, "");
  if (!digits) return null;

  const attempts = [];
  for (let len = digits.length; len >= 2; len--) {
    attempts.push(digits.slice(0, len));
  }
  if (digits.length >= 2) {
    attempts.push(digits.slice(0, 2));
  }

  for (const key of attempts) {
    if (DOR_CODE_MAP[key]) return DOR_CODE_MAP[key];
  }

  return null;
}
// --- End of DOR Code Mapping ---


// --- Start of original main.js content ---

// const { mapDorCodeToEnums, DOR_CODE_MAP } = require("./propertyCodeMapping"); // Now inlined
// let cheerio; // Already declared above

const missingDorCodes = new Set();

const PROPERTY_TYPE_ENUM = new Set([
  "LandParcel",
  "Building",
  "Unit",
  "ManufacturedHome",
]);
const PROPERTY_TYPE_ALIASES = {
  LandParcel: "LandParcel",
  VacantLand: "LandParcel",
  ManufacturedHome: "ManufacturedHome",
  ManufacturedHousing: "ManufacturedHome",
  ManufacturedHousingMultiWide: "ManufacturedHome",
  ManufacturedHousingSingleWide: "ManufacturedHome",
  ManufacturedHomeOnLand: "ManufacturedHome",
  ManufacturedHomeInPark: "ManufacturedHome",
  Building: "Building",
  SingleFamily: "Building",
  MultiFamilyMoreThan10: "Building",
  MultiFamilyLessThan10: "Building",
  MiscellaneousResidential: "Building",
  ResidentialCommonElementsAreas: "Building",
  Condominium: "Unit",
  Cooperative: "Unit",
  Retirement: "Building",
  Other: "Building",
};
const PROPERTY_USAGE_VALUES = [
  "Residential",
  "Commercial",
  "Industrial",
  "Agricultural",
  "Recreational",
  "Conservation",
  "Retirement",
  "ResidentialCommonElementsAreas",
  "DrylandCropland",
  "HayMeadow",
  "CroplandClass2",
  "CroplandClass3",
  "TimberLand",
  "GrazingLand",
  "OrchardGroves",
  "Poultry",
  "Ornamentals",
  "Church",
  "PrivateSchool",
  "PrivateHospital",
  "HomesForAged",
  "NonProfitCharity",
  "MortuaryCemetery",
  "ClubsLodges",
  "SanitariumConvalescentHome",
  "CulturalOrganization",
  "Military",
  "ForestParkRecreation",
  "PublicSchool",
  "PublicHospital",
  "GovernmentProperty",
  "RetailStore",
  "DepartmentStore",
  "Supermarket",
  "ShoppingCenterRegional",
  "ShoppingCenterCommunity",
  "OfficeBuilding",
  "MedicalOffice",
  "TransportationTerminal",
  "Restaurant",
  "FinancialInstitution",
  "ServiceStation",
  "AutoSalesRepair",
  "MobileHomePark",
  "WholesaleOutlet",
  "Theater",
  "Entertainment",
  "Hotel",
  "RaceTrack",
  "GolfCourse",
  "LightManufacturing",
  "HeavyManufacturing",
  "LumberYard",
  "PackingPlant",
  "Cannery",
  "MineralProcessing",
  "Warehouse",
  "OpenStorage",
  "Utility",
  "RiversLakes",
  "SewageDisposal",
  "Railroad",
  "TransitionalProperty",
  "ReferenceParcel",
  "NurseryGreenhouse",
  "AgriculturalPackingFacility",
  "LivestockFacility",
  "Aquaculture",
  "VineyardWinery",
  "DataCenter",
  "TelecommunicationsFacility",
  "SolarFarm",
  "WindFarm",
  "NativePasture",
  "ImprovedPasture",
  "Rangeland",
  "PastureWithTimber",
  "Unknown",
];
const PROPERTY_USAGE_ENUM = new Set(PROPERTY_USAGE_VALUES);
const PROPERTY_USAGE_ALIASES = {
  PlannedUnitDevelopment: "Residential",
  MiscellaneousResidential: "Residential",
  CollegeUniversity: "PublicSchool",
};
const STRUCTURE_FORM_ENUM = new Set([
  "SingleFamilyDetached",
  "SingleFamilySemiDetached",
  "TownhouseRowhouse",
  "Duplex",
  "Triplex",
  "Quadplex",
  "MultiFamily5Plus",
  "ApartmentUnit",
  "Loft",
  "ManufacturedHomeOnLand",
  "ManufacturedHomeInPark",
  "MultiFamilyMoreThan10",
  "MultiFamilyLessThan10",
  "MobileHome",
  "ManufacturedHousingMultiWide",
  "ManufacturedHousing",
  "ManufacturedHousingSingleWide",
  "Modular",
]);
const OWNERSHIP_ESTATE_ENUM = new Set([
  "Condominium",
  "Cooperative",
  "LifeEstate",
  "Timeshare",
  "OtherEstate",
  "FeeSimple",
  "Leasehold",
  "RightOfWay",
  "NonWarrantableCondo",
  "SubsurfaceRights",
]);
const BUILD_STATUS_ENUM = new Set(["VacantLand", "Improved", "UnderConstruction"]);
const NUMBER_OF_UNITS_TYPE_ENUM = new Set([
  "One",
  "Two",
  "Three",
  "Four",
  "OneToFour",
  "TwoToFour",
]);
const EXTERIOR_WALL_MATERIAL_ENUM = new Set([
  "Brick",
  "Natural Stone",
  "Manufactured Stone",
  "Stucco",
  "Vinyl Siding",
  "Wood Siding",
  "Fiber Cement Siding",
  "Metal Siding",
  "Concrete Block",
  "EIFS",
  "Log",
  "Adobe",
  "Precast Concrete",
  "Curtain Wall",
]);
const PRIMARY_FRAMING_MATERIAL_ENUM = new Set([
  "Wood Frame",
  "Steel Frame",
  "Concrete Block",
  "Poured Concrete",
  "Masonry",
  "Engineered Lumber",
  "Post and Beam",
  "Log Construction",
]);
const DEED_TYPE_ENUM = new Set([
  "Warranty Deed",
  "Special Warranty Deed",
  "Quitclaim Deed",
  "Grant Deed",
  "Bargain and Sale Deed",
  "Lady Bird Deed",
  "Transfer on Death Deed",
  "Sheriff's Deed",
  "Tax Deed",
  "Trustee's Deed",
  "Personal Representative Deed",
  "Correction Deed",
  "Deed in Lieu of Foreclosure",
  "Life Estate Deed",
  "Joint Tenancy Deed",
  "Tenancy in Common Deed",
  "Community Property Deed",
  "Gift Deed",
  "Interspousal Transfer Deed",
  "Wild Deed",
  "Special Master’s Deed",
  "Court Order Deed",
  "Contract for Deed",
  "Quiet Title Deed",
  "Administrator's Deed",
  "Guardian's Deed",
  "Receiver's Deed",
  "Right of Way Deed",
  "Vacation of Plat Deed",
  "Assignment of Contract",
  "Release of Contract",
  "Miscellaneous",
]);
const PROPERTY_IMPROVEMENT_TYPE_ENUM = new Set([
  "GeneralBuilding",
  "ResidentialConstruction",
  "CommercialConstruction",
  "BuildingAddition",
  "StructureMove",
  "Demolition",
  "PoolSpaInstallation",
  "Electrical",
  "MechanicalHVAC",
  "GasInstallation",
  "Roofing",
  "Fencing",
  "DockAndShore",
  "FireProtectionSystem",
  "Plumbing",
  "ExteriorOpeningsAndFinishes",
  "MobileHomeRV",
  "LandscapeIrrigation",
  "ScreenEnclosure",
  "ShutterAwning",
  "SiteDevelopment",
  "CodeViolation",
  "Complaint",
  "ContractorLicense",
  "Sponsorship",
  "StateLicenseRegistration",
  "AdministrativeApproval",
  "AdministrativeAppeal",
  "BlueSheetHearing",
  "PlannedDevelopment",
  "DevelopmentOfRegionalImpact",
  "Rezoning",
  "SpecialExceptionZoning",
  "Variance",
  "ZoningExtension",
  "ZoningVerificationLetter",
  "RequestForRelief",
  "WaiverRequest",
  "InformalMeeting",
  "EnvironmentalMonitoring",
  "Vacation",
  "VegetationRemoval",
  "ComprehensivePlanAmendment",
  "MinimumUseDetermination",
  "TransferDevelopmentRightsDetermination",
  "MapBoundaryDetermination",
  "TransferDevelopmentRightsCertificate",
  "UniformCommunityDevelopment",
  "SpecialCertificateOfAppropriateness",
  "CertificateToDig",
  "HistoricDesignation",
  "PlanningAdministrativeAppeal",
  "WellPermit",
  "TestBoring",
  "ExistingWellInspection",
  "NaturalResourcesComplaint",
  "NaturalResourcesViolation",
  "LetterWaterSewer",
  "UtilitiesConnection",
  "DrivewayPermit",
  "RightOfWayPermit",
]);
const IMPROVEMENT_ALIAS_MAP = {
  Pool: "PoolSpaInstallation",
  PoolDeck: "PoolSpaInstallation",
  PoolHeater: "PoolSpaInstallation",
  ScreenEnclosure: "ScreenEnclosure",
  BoatHouse: "DockAndShore",
  Dock: "DockAndShore",
  Seawall: "DockAndShore",
  Paving: "SiteDevelopment",
  Fence: "Fencing",
  HotTub: "PoolSpaInstallation",
  HVAC: "MechanicalHVAC",
  Carport: "BuildingAddition",
  DetachedGarage: "BuildingAddition",
  Garage: "BuildingAddition",
  Deck: "BuildingAddition",
  Porch: "BuildingAddition",
  Patio: "SiteDevelopment",
  Canopy: "ExteriorOpeningsAndFinishes",
  Wall: "SiteDevelopment",
  Barn: "GeneralBuilding",
  Shed: "GeneralBuilding",
  Greenhouse: "GeneralBuilding",
  ParkingLotLighting: "SiteDevelopment",
  FuelPump: "MechanicalHVAC",
  Elevator: "GeneralBuilding",
  RetainingWall: "SiteDevelopment",
  RecreationCourt: "SiteDevelopment",
  TennisCourt: "SiteDevelopment",
  StorageTank: "SiteDevelopment",
  Silo: "GeneralBuilding",
  Tower: "GeneralBuilding",
};
const PROPERTY_USAGE_UNKNOWN = "Unknown";

function ensureEnum(value, allowedSet) {
  if (value == null) return null;
  return allowedSet.has(value) ? value : null;
}

function coercePropertyType(value, context = {}) {
  const { buildStatus = null, units = null, structureForm = null } = context;
  if (value) {
    const normalized = PROPERTY_TYPE_ALIASES[value] || value;
    if (PROPERTY_TYPE_ENUM.has(normalized)) return normalized;
  }
  if (buildStatus === "VacantLand") return "LandParcel";
  if (
    structureForm === "ManufacturedHomeOnLand" ||
    structureForm === "ManufacturedHomeInPark" ||
    structureForm === "ManufacturedHousing" ||
    structureForm === "ManufacturedHousingMultiWide" ||
    structureForm === "ManufacturedHousingSingleWide"
  ) {
    return "ManufacturedHome";
  }
  if (Number.isFinite(units) && units > 0) return "Building";
  if (buildStatus === "Improved") return "Building";
  return null;
}

function coercePropertyUsageType(value) {
  if (value == null) return null;
  const alias = PROPERTY_USAGE_ALIASES[value] || value;
  if (PROPERTY_USAGE_ENUM.has(alias)) return alias;
  return PROPERTY_USAGE_ENUM.has(PROPERTY_USAGE_UNKNOWN)
    ? PROPERTY_USAGE_UNKNOWN
    : null;
}

function coerceStructureForm(value) {
  return ensureEnum(value, STRUCTURE_FORM_ENUM);
}

function coerceOwnershipEstateType(value) {
  return ensureEnum(value, OWNERSHIP_ESTATE_ENUM);
}

function coerceBuildStatus(value) {
  return ensureEnum(value, BUILD_STATUS_ENUM);
}

function coerceNumberOfUnitsType(value) {
  if (value == null) return null;
  return NUMBER_OF_UNITS_TYPE_ENUM.has(value) ? value : null;
}

function coerceExteriorWallMaterial(value) {
  return ensureEnum(value, EXTERIOR_WALL_MATERIAL_ENUM);
}

function coercePrimaryFramingMaterial(value) {
  return ensureEnum(value, PRIMARY_FRAMING_MATERIAL_ENUM);
}

function coerceDeedType(value) {
  if (value == null) return null;
  if (DEED_TYPE_ENUM.has(value)) return value;
  return "Miscellaneous";
}

function coerceImprovementType(label) {
  if (!label) return null;
  if (PROPERTY_IMPROVEMENT_TYPE_ENUM.has(label)) return label;
  const mapped = IMPROVEMENT_ALIAS_MAP[label] || null;
  if (mapped && PROPERTY_IMPROVEMENT_TYPE_ENUM.has(mapped)) return mapped;
  return null;
}
// try {
//   cheerio = require("cheerio"); // Already declared above
// } catch (e) {
//   cheerio = null;
// }

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
function clearDir(p) {
  if (!fs.existsSync(p)) return;
  for (const f of fs.readdirSync(p)) fs.unlinkSync(path.join(p, f));
}
function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function readText(p) {
  return fs.readFileSync(p, "utf8");
}
function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function textNormalize(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function toNumber(value) {
  if (value == null) return null;
  const clean = String(value).replace(/[^0-9.\-]/g, "");
  if (!clean) return null;
  const num = parseFloat(clean);
  return Number.isFinite(num) ? num : null;
}

function toInt(value) {
  const num = toNumber(value);
  if (num == null) return null;
  const intVal = Math.round(num);
  return Number.isFinite(intVal) ? intVal : null;
}

function parseCurrency(str) {
  if (str == null) return null;
  const s = String(str).replace(/[$,\s]/g, "");
  const n = parseFloat(s);
  return isFinite(n) ? Number(n.toFixed(2)) : null;
}
function toISODate(mdY) {
  if (!mdY) return null;
  const m = mdY.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [_, mm, dd, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}
function properCaseName(s) {
  if (!s) return s;
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function mapLandUseToPropertyType(landUseDescription) {
  if (!landUseDescription) return null;

  const desc = landUseDescription.toUpperCase();

  // Map Lake County land use descriptions to property types (fallback)
  if (desc.includes("VACANT")) return "VacantLand";
  if (desc.includes("SINGLE FAMILY")) return "SingleFamily";
  if (desc.includes("MANUFACTURED HOME")) return "ManufacturedHome";
  if (
    desc.includes("MULTI FAMILY >9") ||
    desc.includes("MULTI FAMILY >=10") ||
    desc.includes("MULTI FAMILY 10")
  )
    return "MultiFamilyMoreThan10";
  if (
    desc.includes("MULTI FAMILY <5") ||
    desc.includes("MULTI FAMILY >4 AND <10") ||
    desc.includes("MULTI FAMILY <=9")
  )
    return "MultiFamilyLessThan10";
  if (desc.includes("CONDOMINIUM") || desc.includes("CONDO"))
    return "Condominium";
  if (desc.includes("CO-OP")) return "Cooperative";
  if (desc.includes("RETIREMENT")) return "Retirement";
  if (desc.includes("MISC RESIDENTIAL") || desc.includes("MIGRANT"))
    return "MiscellaneousResidential";
  if (
    desc.includes("RESIDENTIAL COMMON ELEMENTS") ||
    desc.includes("COMMON ELEMENTS")
  )
    return "ResidentialCommonElementsAreas";

  // Default to null for non-residential or unrecognized codes
  return null;
}

function normalizeDeedType(raw) {
  if (!raw) return null;
  const value = String(raw).trim();
  const upper = value.toUpperCase();
  let candidate = null;
  if (upper.includes("QUIT")) candidate = "Quitclaim Deed";
  else if (upper.includes("SPECIAL") && upper.includes("WARRANTY"))
    candidate = "Special Warranty Deed";
  else if (upper.includes("WARRANTY")) candidate = "Warranty Deed";
  else if (upper.includes("TRUSTEE")) candidate = "Trustee's Deed";
  else if (upper.includes("TAX")) candidate = "Tax Deed";
  else if (upper.includes("SHERIFF")) candidate = "Sheriff's Deed";
  else if (upper.includes("PERSONAL REPRESENTATIVE"))
    candidate = "Personal Representative Deed";
  else if (upper.includes("ADMINISTRATOR")) candidate = "Administrator's Deed";
  else if (upper.includes("CERTIFICATE") && upper.includes("TITLE"))
    candidate = "Miscellaneous";
  else if (upper.includes("COURT")) candidate = "Court Order Deed";
  else candidate = value;
  return coerceDeedType(candidate);
}

function mapMiscImprovementType(code, description) {
  const baseCode = (code || "").replace(/[^A-Z]/g, "");
  const descUpper = (description || "").toUpperCase();
  const keywordMatch = (kw) => descUpper.includes(kw);
  const candidates = [];

  const push = (label) => {
    if (label) candidates.push(label);
  };

  switch (baseCode) {
    case "POL":
      push("Pool");
      break;
    case "PLD":
      push("PoolDeck");
      break;
    case "PLH":
      push("PoolHeater");
      break;
    case "SEN":
      push("ScreenEnclosure");
      break;
    case "BHS":
      push("BoatHouse");
      break;
    case "DOC":
      push("Dock");
      break;
    case "SEW":
      push("Seawall");
      break;
    case "PAV":
      push("Paving");
      break;
    case "FEN":
      push("Fence");
      break;
    case "HTB":
      push("HotTub");
      break;
    case "HAC":
    case "AIR":
      push("HVAC");
      break;
    case "UCP":
    case "CPU":
    case "CPF":
      push("Carport");
      break;
    case "DGF":
      push("DetachedGarage");
      break;
    case "GRH":
      push("Greenhouse");
      break;
    case "PFL":
      push("ParkingLotLighting");
      break;
    case "PIL":
      push("FuelPump");
      break;
    case "REL":
      push("Elevator");
      break;
    case "RTN":
      push("RetainingWall");
      break;
    case "SBC":
      push("RecreationCourt");
      break;
    case "SLO":
      push("Silo");
      break;
    case "TCT":
      push("TennisCourt");
      break;
    case "TKS":
    case "TNK":
      push("StorageTank");
      break;
    case "TWR":
    case "TVT":
      push("Tower");
      break;
    default:
      break;
  }

  if (keywordMatch("POOL") && keywordMatch("SCREEN")) push("ScreenEnclosure");
  else if (keywordMatch("POOL")) push("Pool");
  if (keywordMatch("DECK")) push("Deck");
  if (keywordMatch("PORCH")) push("Porch");
  if (keywordMatch("FENCE")) push("Fence");
  if (keywordMatch("DOCK")) push("Dock");
  if (keywordMatch("BOAT")) push("BoatHouse");
  if (keywordMatch("SEAWALL")) push("Seawall");
  if (keywordMatch("BARN")) push("Barn");
  if (keywordMatch("SHED")) push("Shed");
  if (keywordMatch("CANOPY")) push("Canopy");
  if (keywordMatch("PATIO")) push("Patio");
  if (keywordMatch("WALL")) push("Wall");

  const cleaned = (description || baseCode || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (cleaned) {
    const cleanedLabel = cleaned
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("");
    push(cleanedLabel);
  }

  for (const label of candidates) {
    const mapped = coerceImprovementType(label);
    if (mapped) return mapped;
  }

  if (candidates.length > 0) {
    const fallback = coerceImprovementType("GeneralBuilding");
    if (fallback) return fallback;
  }

  return null;
}

function getUnitsType(units) {
  if (!units || units === 1) return "One";
  if (units === 2) return "Two";
  if (units === 3) return "Three";
  if (units === 4) return "Four";
  if (units >= 2 && units <= 4) return "TwoToFour";
  if (units >= 1 && units <= 4) return "OneToFour";
  return null;
}

function main() {
  const dataDir = path.join(".", "data");
  ensureDir(dataDir);
  clearDir(dataDir);

  // Inputs
  const inputHtml = readText("input.html");
  const addrSeed = readJSON("unnormalized_address.json");
  const propSeed = readJSON("property_seed.json");

  // Owner-related JSON sources
  const ownerPath = path.join("owners", "owner_data.json");
  const utilitiesPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  // --- owner_data.js specific logic to generate owner_data.json ---
  const $forOwners = cheerio.load(inputHtml);
  const propertyIdRaw = extractPropertyId($forOwners);
  const propertyKey = `property_${propertyIdRaw}`;

  console.log("Property Key derived from input.html:", propertyKey); // DEBUG LOG

  const groups = extractOwnerGroups($forOwners);
  console.log("Extracted owner groups from input.html:", JSON.stringify(groups, null, 2)); // DEBUG LOG

  const { owners_by_date, invalid_owners } = buildOwnersByDate(groups);
  console.log("Owners by date generated from input.html:", JSON.stringify(owners_by_date, null, 2)); // DEBUG LOG

  const ownerResult = {};
  ownerResult[propertyKey] = {
    owners_by_date,
    invalid_owners: invalid_owners || [],
  };

  const outDirOwners = path.join(process.cwd(), "owners");
  const outFileOwners = path.join(outDirOwners, "owner_data.json");
  if (!fs.existsSync(outDirOwners)) fs.mkdirSync(outDirOwners, { recursive: true });
  fs.writeFileSync(outFileOwners, JSON.stringify(ownerResult, null, 2), "utf8");
  console.log("Generated owners/owner_data.json with content:", JSON.stringify(ownerResult, null, 2)); // DEBUG LOG
  // --- End of owner_data.js specific logic ---


  let ownerData = fs.existsSync(ownerPath) ? readJSON(ownerPath) : ownerResult;
  console.log("OwnerData used for processing:", JSON.stringify(ownerData, null, 2)); // DEBUG LOG

  const utilitiesData = fs.existsSync(utilitiesPath)
    ? readJSON(utilitiesPath)
    : null;
  const layoutData = fs.existsSync(layoutPath) ? readJSON(layoutPath) : null;

  const resolveRecordForKey = (dataMap, desiredKey) => {
    if (!dataMap || typeof dataMap !== "object") return null;
    if (desiredKey && dataMap[desiredKey]) return dataMap[desiredKey];
    const keys = Object.keys(dataMap);
    if (keys.length === 1) return dataMap[keys[0]];
    if (desiredKey && dataMap.property_unknown) return dataMap.property_unknown;
    if (desiredKey) {
      const normalizeKey = (k) => (k || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
      const normalizedTarget = normalizeKey(desiredKey);
      const matchedKey = keys.find((key) => normalizeKey(key) === normalizedTarget);
      if (matchedKey) return dataMap[matchedKey];
    }
    return null;
  };

  const altKey =
    (propSeed &&
      propSeed.source_http_request &&
      propSeed.source_http_request.multiValueQueryString &&
      propSeed.source_http_request.multiValueQueryString.AltKey &&
      propSeed.source_http_request.multiValueQueryString.AltKey[0]) ||
    (addrSeed &&
      addrSeed.source_http_request &&
      addrSeed.source_http_request.multiValueQueryString &&
      addrSeed.source_http_request.multiValueQueryString.AltKey &&
      addrSeed.source_http_request.multiValueQueryString.AltKey[0]) ||
    null;
  // const ownerKey = altKey ? `property_${altKey}` : null; // Already defined as propertyKey from owner_data.js logic

  // HTML parsing
  let $ = null;
  // if (cheerio) { // Cheerio is always available now
    $ = cheerio.load(inputHtml);
  // }

  // Helper: find cell by label in General Information table
  function extractGeneral() {
    if (!$) return {};
    const result = {};
    // Parcel Number
    const rows = $("table.property_head").first().find("tr");
    rows.each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 4) {
        const label = $(tds[2]).text().trim();
        const val = $(tds[3]).text().trim();
        if (/Parcel Number/i.test(label)) result.parcelNumber = val || null;
      }
    });

    // Mailing Address block
    rows.each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 2) {
        const label = $(tds[0]).text().trim();
        if (/Mailing Address:/i.test(label)) {
          const cellHtml = $(tds[1]).html() || "";
          const cleanedHtml = cellHtml.replace(
            /<span[^>]*>[\s\S]*?<\/span>/gi,
            "",
          );
          const lines = cleanedHtml
            .split(/<br\s*\/?>/i)
            .map((line) =>
              line
                .replace(/<[^>]+>/g, "")
                .replace(/\s+/g, " ")
                .trim(),
            )
            .filter(
              (line) =>
                line &&
                !/update mailing address/i.test(line) &&
                line !== "/>",
            );
          if (lines.length) result.mailingAddressLines = lines;
        }
      }
    });

    // Property Location block
    rows.each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 4) {
        const label = $(tds[0]).text().trim();
        if (/Property Location:/i.test(label)) {
          const addrHtml = $(tds[1]).html() || "";
          const addrText = addrHtml
            .replace(/<br\s*\/?>(?=\s*|$)/gi, "\n")
            .replace(/<[^>]+>/g, "")
            .trim();
          result.propertyLocationRaw = addrText; // e.g., "31729 PARKDALE DR\nLEESBURG FL, 34748"
        }
      }
    });

    // Property Description
    rows.each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 2) {
        const label = $(tds[0]).text().trim();
        if (/Property Description:/i.test(label)) {
          result.legalDescription = $(tds[1]).text().trim() || null;
        }
      }
    });

    return result;
  }

  function extractPropertyTypeFromLandData() {
    if (!$)
      return {
        propertyType: null,
        units: null,
        landUseCodes: [],
      };

    let landUseDescription = null;
    let units = null;
    const landUseCodes = [];

    // Extract from Land Data table
    $("#cphMain_gvLandData tr.property_row").each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 2) {
        const landUseText = $(tds[1]).text().trim();
        if (landUseText) {
          landUseDescription = landUseText.toUpperCase();
          const codeMatch = landUseText.match(/\((\d{2,6})\)/);
          if (codeMatch) {
            const code = codeMatch[1];
            if (!landUseCodes.includes(code)) landUseCodes.push(code);
          }
        }
      }
      if (tds.length >= 7 && units == null) {
        const typeText = $(tds[6]).text().trim().toUpperCase();
        if (!/UNIT/.test(typeText)) return;
        const unitText = $(tds[5]).text().trim();
        const parsedUnits = parseFloat(unitText.replace(/,/g, ""));
        if (!Number.isNaN(parsedUnits)) {
          units = parsedUnits % 1 === 0 ? parsedUnits : null;
        }
      }
    });

    // Also check for units in building summary if available
    $("table.property_building_summary td").each((i, td) => {
      if (units != null) return;
      const text = $(td).text().trim();
      const unitMatch = text.match(/Units:\s*(\d+)/i);
      if (unitMatch) {
        units = parseInt(unitMatch[1], 10);
      }
    });

    const propertyType = mapLandUseToPropertyType(landUseDescription);

    return { propertyType, units, landUseCodes, landUseDescription };
  }

  // Extract Living Area, Year Built, Building/Land Values, Sales, and derive structure hints
  function extractBuildingAndValues() {
    if (!$) return {};
    const out = {
      yearBuilt: null,
      livingArea: null,
      buildingValue: null,
      landValue: null,
      assessedValue: null,
      taxableValue: null,
      marketValue: null,
      taxYear: null,
      sales: [],
      structure: {
        number_of_stories: null,
        exterior_wall_material_primary: null,
        exterior_wall_material_secondary: null,
        primary_framing_material: null,
      },
    };

    // Summary table with Year Built and Total Living Area
    $("table.property_building_summary td").each((i, td) => {
      const t = $(td).text().replace(/\s+/g, " ").trim();
      let m;
      m = t.match(/Year Built:\s*(\d{4})/i);
      if (m) out.yearBuilt = parseInt(m[1], 10);
      m = t.match(/Total Living Area:\s*([0-9,\.]+)/i);
      if (m) out.livingArea = m[1].replace(/[,]/g, "").trim();
    });

    // Building Value
    $("div.property_building table")
      .first()
      .find("tr")
      .first()
      .find("td")
      .each((i, td) => {
        const text = $(td).text();
        const m = text.match(/Building Value:\s*\$([0-9,\.]+)/i);
        if (m) out.buildingValue = parseCurrency(m[0].split(":")[1]);
      });

    // Land Value (from Land Data table)
    $("#cphMain_gvLandData tr.property_row").each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 9) {
        const lv = $(tds[8]).text();
        const parsed = parseCurrency(lv);
        if (parsed != null) out.landValue = parsed;
      }
    });

    // Tax values
    const estRows = $("#cphMain_gvEstTax tr").toArray();
    if (estRows.length > 1) {
      // First data row after header
      const tds = $(estRows[1]).find("td");
      if (tds.length >= 6) {
        const market = $(tds[1]).text();
        const assessed = $(tds[2]).text();
        const taxable = $(tds[3]).text();
        out.marketValue = parseCurrency(market);
        out.assessedValue = parseCurrency(assessed);
        out.taxableValue = parseCurrency(taxable);
      }
    }

    // Tax year from the red note text or globally from HTML
    let noteText = "";
    $("div.red").each((i, el) => {
      noteText += $(el).text() + " ";
    });
    let mYear = noteText.match(
      /Values shown below are\s+(\d{4})\s+CERTIFIED VALUES/i,
    );
    if (!mYear)
      mYear = inputHtml.match(
        /Values shown below are\s+(\d{4})\s+CERTIFIED VALUES/i,
      );
    if (mYear) out.taxYear = parseInt(mYear[1], 10);

    // Sales History: capture book/page, instrument, qualification, and pricing
    $("#cphMain_gvSalesHistory tr").each((i, tr) => {
      if (i === 0) return; // header
      const tds = $(tr).find("td");
      if (tds.length < 6) return;
      const bookPageLink = $(tds[0]).find("a");
      const bookPageText = bookPageLink.length
        ? bookPageLink.text().trim()
        : $(tds[0]).text().trim();
      const docUrl = bookPageLink.attr("href") || null;
      const saleDateRaw = $(tds[1]).text().trim();
      const instrument = $(tds[2]).text().trim();
      const qualifiedText = $(tds[3]).text().trim();
      const vacantImprovedText = $(tds[4]).text().trim();
      const salePriceRaw = $(tds[5]).text().trim();

      let book = null;
      let page = null;
      if (bookPageText && bookPageText.includes("/")) {
        const parts = bookPageText.split("/");
        if (parts.length >= 2) {
          book = parts[0].trim() || null;
          page = parts[1].trim() || null;
        }
      }

      let volume = null;
      if (docUrl) {
        try {
          const urlObj = new URL(
            docUrl,
            "https://www.lakecopropappr.com",
          );
          const pathParts = urlObj.pathname.split("/").filter(Boolean);
          const idx = pathParts.findIndex(
            (part) => part.toLowerCase() === "getdocumentbybookpage",
          );
          if (idx !== -1) {
            volume = pathParts[idx + 1] || volume;
            book = pathParts[idx + 2] || book;
            page = pathParts[idx + 3] || page;
          } else if (urlObj.searchParams) {
            const bookParam = urlObj.searchParams.get("booknumber");
            const pageParam = urlObj.searchParams.get("pagenumber");
            if (bookParam) book = bookParam;
            if (pageParam) page = pageParam;
          }
        } catch (err) {
          // ignore malformed URLs
        }
      }

      const saleRecord = {
        sale_date: toISODate(saleDateRaw),
        sale_price: parseCurrency(salePriceRaw),
        instrument: instrument || null,
        qualified: qualifiedText || null,
        improvement_status: vacantImprovedText || null,
        book: book || null,
        page: page || null,
        volume: volume || null,
        instrument_number: null,
        document_url: docUrl || null,
        document_name: bookPageText
          ? `Official Records ${bookPageText}`
          : null,
      };

      if (!saleRecord.sale_date && saleRecord.sale_price == null) return;
      out.sales.push(saleRecord);
    });

    // Residential Building Characteristics (Sections) for stories and exterior wall types
    const secTable = $("table#cphMain_repResidential_gvBuildingSections_0");
    if (secTable && secTable.length) {
      const firstDataRow = secTable
        .find("tr")
        .not(".property_table_head")
        .first();
      const tds = firstDataRow.find("td");
      if (tds.length >= 4) {
        const extText = (tds.eq(1).text() || "").trim();
        const storiesText = (tds.eq(2).text() || "").trim();
        if (storiesText) {
          const sNum = parseFloat(storiesText);
          if (!isNaN(sNum)) out.structure.number_of_stories = Math.round(sNum);
        }
        if (extText) {
          const U = extText.toUpperCase();
          let primary = null;
          let secondary = null;
          let framing = null;

          const has = (kw) => U.indexOf(kw) !== -1;
          if (has("BLOCK") || has("CONCRETE BLOCK")) framing = "Concrete Block";

          if (has("STUCCO")) primary = "Stucco";
          if (!primary && has("VINYL") && has("SIDING"))
            primary = "Vinyl Siding";
          if (!primary && has("WOOD") && has("SIDING")) primary = "Wood Siding";
          if (!primary && has("FIBER") && has("CEMENT"))
            primary = "Fiber Cement Siding";
          if (!primary && has("BRICK")) primary = "Brick";
          if (!primary && (has("BLOCK") || has("CONCRETE BLOCK")))
            primary = "Concrete Block";

          if (has("BRICK") && primary !== "Brick") secondary = "Brick Accent";
          if (
            !secondary &&
            (has("BLOCK") || has("CONCRETE BLOCK")) &&
            primary !== "Concrete Block"
          )
            secondary = "Decorative Block";
          if (!secondary && has("STUCCO") && primary !== "Stucco")
            secondary = "Stucco Accent";

          out.structure.exterior_wall_material_primary = primary;
          out.structure.exterior_wall_material_secondary = secondary || null;
          out.structure.primary_framing_material = framing || null;
        }
      }
    }

    return out;
  }

  function buildPropertyJson() {
    const propertyInfo = extractPropertyTypeFromLandData();
    const dorMappings = propertyInfo.landUseCodes.map((code) => ({
      code,
      mapping: mapDorCodeToEnums(code),
    }));
    const firstValidMapping =
      dorMappings.find((entry) => entry.mapping != null)?.mapping || null;

    dorMappings.forEach((entry) => {
      if (!entry.mapping && entry.code) {
        missingDorCodes.add(entry.code);
      }
    });

    const units =
      propertyInfo.units != null && Number.isFinite(propertyInfo.units)
        ? Math.round(Number(propertyInfo.units))
        : null;
    const numberOfUnitsTypeRaw = units != null ? getUnitsType(units) : null;
    const numberOfUnitsType = coerceNumberOfUnitsType(numberOfUnitsTypeRaw);

    const ownershipEstate = coerceOwnershipEstateType(
      firstValidMapping ? firstValidMapping.ownership_estate_type : null,
    );
    const buildStatus = coerceBuildStatus(
      firstValidMapping ? firstValidMapping.build_status : null,
    );
    const structureForm = coerceStructureForm(
      firstValidMapping ? firstValidMapping.structure_form : null,
    );

    let propertyUsageType = coercePropertyUsageType(
      firstValidMapping ? firstValidMapping.property_usage_type : null,
    );
    if (!propertyUsageType && propertyInfo.propertyType) {
      propertyUsageType = coercePropertyUsageType(propertyInfo.propertyType);
    }
    if (!propertyUsageType && propertyInfo.landUseDescription) {
      const desc = propertyInfo.landUseDescription;
      let inferred = null;
      if (desc.includes("RESIDENT")) inferred = "Residential";
      else if (desc.includes("COMMERCIAL")) inferred = "Commercial";
      else if (desc.includes("INDUSTR")) inferred = "Industrial";
      else if (desc.includes("AGRICULT") || desc.includes("FARM"))
        inferred = "Agricultural";
      else if (desc.includes("GOV")) inferred = "GovernmentProperty";
      else if (desc.includes("MOBILE HOME PARK"))
        inferred = "MobileHomePark";
      propertyUsageType = coercePropertyUsageType(inferred);
    }

    const propertyType = coercePropertyType(
      (firstValidMapping && firstValidMapping.property_type) ||
        propertyInfo.propertyType ||
        null,
      { buildStatus, units, structureForm },
    );

    const property = {
      parcel_identifier: general.parcelNumber || propSeed.parcel_id || null,
      property_structure_built_year: bx.yearBuilt || null,
      livable_floor_area: bx.livingArea ? String(bx.livingArea) : null,
      property_legal_description_text: general.legalDescription || null,
      ownership_estate_type: ownershipEstate,
      build_status: buildStatus,
      structure_form: structureForm,
      property_usage_type: propertyUsageType,
      property_type: propertyType || undefined,
      number_of_units_type: numberOfUnitsType,
      number_of_units: units,
      area_under_air: null,
      property_effective_built_year: null,
      subdivision: null,
      total_area: null,
      zoning: null,
    };

    Object.keys(property).forEach((k) => {
      if (property[k] === undefined) delete property[k];
    });

    return property;
  }

  // Execute extractions in proper order
  const general = extractGeneral();
  const bx = extractBuildingAndValues();
  const structureFiles = [];
  const utilityFiles = [];
  const buildingLayoutFiles = [];
  const allLayoutFiles = [];
  const topLevelLayoutFiles = [];
  let autoGeneratedBuildingLayoutFile = null;

  // Address parsing
  function parseAddress() {
    let raw = (general.propertyLocationRaw || addrSeed.full_address || "")
      .replace(/\r/g, "")
      .trim();
    raw = raw.replace(/\n/g, ", ").replace(/\s+/g, " ").trim();

    let street_number = null,
      street_name = null,
      street_suffix_type = null,
      city_name = null,
      state_code = null,
      postal_code = null;

    const m =
      raw.match(
        /^(\d+)\s+([^,]+?)\s+([A-Za-z]+)\s*,\s*([A-Z\s\-']+)\s*,?\s*([A-Z]{2})\s*,?\s*(\d{5})(?:-?(\d{4}))?$/i,
      ) ||
      raw.match(
        /^(\d+)\s+([^,]+?)\s+([A-Za-z]+),\s*([A-Z\s\-']+)\s*,\s*([A-Z]{2})\s*(\d{5})(?:-?(\d{4}))?$/i,
      ) ||
      raw.match(
        /^(\d+)\s+([^,]+?)\s+([A-Za-z]+),\s*([A-Z\s\-']+)\s*([A-Z]{2})\s*,\s*(\d{5})(?:-?(\d{4}))?$/i,
      );

    if (m) {
      street_number = m[1];
      street_name = (m[2] || "").trim().replace(/\s+/g, " ").toUpperCase();
      street_suffix_type = (m[3] || "").trim();
      city_name = (m[4] || "").trim().toUpperCase();
      state_code = (m[5] || "").trim().toUpperCase();
      postal_code = (m[6] || "").trim();
    } else {
      const fa = (addrSeed.full_address || "").trim();
      const parts = fa.split(",");
      if (parts.length >= 3) {
        const street = parts[0].trim();
        const city = parts[1].trim();
        const stZip = parts[2].trim();
        const st = stZip.match(/([A-Z]{2})/)?.[1] || null;
        const zip = stZip.match(/(\d{5})/)?.[1] || null;
        const streetParts = street.split(/\s+/);
        street_number = streetParts.shift();
        street_suffix_type = streetParts.pop() || null;
        street_name = streetParts.join(" ").toUpperCase();
        city_name = city.toUpperCase();
        state_code = st;
        postal_code = zip;
      }
    }

    const suffixMap = {
      STREET: "St",
      ST: "St",
      AVENUE: "Ave",
      AVE: "Ave",
      BOULEVARD: "Blvd",
      BLVD: "Blvd",
      ROAD: "Rd",
      RD: "Rd",
      LANE: "Ln",
      LN: "Ln",
      DRIVE: "Dr",
      DR: "Dr",
      COURT: "Ct",
      CT: "Ct",
      PLACE: "Pl",
      PL: "Pl",
      TERRACE: "Ter",
      TER: "Ter",
      CIRCLE: "Cir",
      CIR: "Cir",
      WAY: "Way",
      LOOP: "Loop",
      PARKWAY: "Pkwy",
      PKWY: "Pkwy",
      PLAZA: "Plz",
      PLZ: "Plz",
      TRAIL: "Trl",
      TRL: "Trl",
      BEND: "Bnd",
      BND: "Bnd",
      CRESCENT: "Cres",
      CRES: "Cres",
      MANOR: "Mnr",
      MNR: "Mnr",
      SQUARE: "Sq",
      SQ: "Sq",
      CROSSING: "Xing",
      XING: "Xing",
      PATH: "Path",
      RUN: "Run",
      WALK: "Walk",
      ROW: "Row",
      ALLEY: "Aly",
      ALY: "Aly",
      BEACH: "Bch",
      BCH: "Bch",
      BRIDGE: "Br",
      BRG: "Br",
      BROOK: "Brk",
      BRK: "Brk",
      BROOKS: "Brks",
      BRKS: "Brks",
      BUG: "Bg",
      BG: "Bg",
      BUGS: "Bgs",
      BGS: "Bgs",
      CLUB: "Clb",
      CLB: "Clb",
      CLIFF: "Clf",
      CLF: "Clf",
      CLIFFS: "Clfs",
      CLFS: "Clfs",
      COMMON: "Cmn",
      CMN: "Cmn",
      COMMONS: "Cmns",
      CMNS: "Cmns",
      CORNER: "Cor",
      COR: "Cor",
      CORNERS: "Cors",
      CORS: "Cors",
      CREEK: "Crk",
      CRK: "Crk",
      COURSE: "Crse",
      CRSE: "Crse",
      CREST: "Crst",
      CRST: "Crst",
      CAUSEWAY: "Cswy",
      CSWY: "Cswy",
      COVE: "Cv",
      CV: "Cv",
      CANYON: "Cyn",
      CYN: "Cyn",
      DALE: "Dl",
      DL: "Dl",
      DAM: "Dm",
      DM: "Dm",
      DRIVES: "Drs",
      DRS: "Drs",
      DIVIDE: "Dv",
      DV: "Dv",
      ESTATE: "Est",
      EST: "Est",
      ESTATES: "Ests",
      ESTS: "Ests",
      EXPRESSWAY: "Expy",
      EXPY: "Expy",
      EXTENSION: "Ext",
      EXT: "Ext",
      EXTENSIONS: "Exts",
      EXTS: "Exts",
      FALL: "Fall",
      FALL: "Fall",
      FALLS: "Fls",
      FLS: "Fls",
      FLAT: "Flt",
      FLT: "Flt",
      FLATS: "Flts",
      FLTS: "Flts",
      FORD: "Frd",
      FRD: "Frd",
      FORDS: "Frds",
FRDS: "Frds",
      FORGE: "Frg",
      FRG: "Frg",
      FORGES: "Frgs",
      FRGS: "Frgs",
      FORK: "Frk",
      FRK: "Frk",
      FORKS: "Frks",
      FRKS: "Frks",
      FOREST: "Frst",
      FRST: "Frst",
      FREEWAY: "Fwy",
      FWY: "Fwy",
      FIELD: "Fld",
      FLD: "Fld",
      FIELDS: "Flds",
      FLDS: "Flds",
      GARDEN: "Gdn",
      GDN: "Gdn",
      GARDENS: "Gdns",
      GDNS: "Gdns",
      GLEN: "Gln",
      GLN: "Gln",
      GLENS: "Glns",
      GLNS: "Glns",
      GREEN: "Grn",
      GRN: "Grn",
      GREENS: "Grns",
      GRNS: "Grns",
      GROVE: "Grv",
      GRV: "Grv",
      GROVES: "Grvs",
      GRVS: "Grvs",
      GATEWAY: "Gtwy",
      GTWY: "Gtwy",
      HARBOR: "Hbr",
      HBR: "Hbr",
      HARBORS: "Hbrs",
      HBRS: "Hbrs",
      HILL: "Hl",
      HL: "Hl",
      HILLS: "Hls",
      HLS: "Hls",
      HOLLOW: "Holw",
      HOLW: "Holw",
      HEIGHTS: "Hts",
      HTS: "Hts",
      HAVEN: "Hvn",
      HVN: "Hvn",
      HIGHWAY: "Hwy",
      HWY: "Hwy",
      INLET: "Inlt",
      INLT: "Inlt",
      ISLAND: "Is",
      IS: "Is",
      ISLANDS: "Iss",
      ISS: "Iss",
      ISLE: "Isle",
      SPUR: "Spur",
      JUNCTION: "Jct",
      JCT: "Jct",
      JUNCTIONS: "Jcts",
      JCTS: "Jcts",
      KNOLL: "Knl",
      KNL: "Knl",
      KNOLLS: "Knls",
      KNLS: "Knls",
      LOCK: "Lck",
      LCK: "Lck",
      LOCKS: "Lcks",
      LCKS: "Lcks",
      LODGE: "Ldg",
      LDG: "Ldg",
      LIGHT: "Lgt",
      LGT: "Lgt",
      LIGHTS: "Lgts",
      LGTS: "Lgts",
      LAKE: "Lk",
      LK: "Lk",
      LAKES: "Lks",
      LKS: "Lks",
      LANDING: "Lndg",
      LNDG: "Lndg",
      MALL: "Mall",
      MEWS: "Mews",
      MEADOW: "Mdw",
      MDW: "Mdw",
      MEADOWS: "Mdws",
      MDWS: "Mdws",
      MILL: "Ml",
      ML: "Ml",
      MILLS: "Mls",
      MLS: "Mls",
      MANORS: "Mnrs",
      MNRS: "Mnrs",
      MOUNT: "Mt",
      MT: "Mt",
      MOUNTAIN: "Mtn",
      MTN: "Mtn",
      MOUNTAINS: "Mtns",
      MTNS: "Mtns",
      OVERPASS: "Opas",
      OPAS: "Opas",
      ORCHARD: "Orch",
      ORCH: "Orch",
      OVAL: "Oval",
      PARK: "Park",
      PASS: "Pass",
      PIKE: "Pike",
      PLAIN: "Pln",
      PLN: "Pln",
      PLAINS: "Plns",
      PLNS: "Plns",
      PINE: "Pne",
      PNE: "Pne",
      PINES: "Pnes",
      PNES: "Pnes",
      PRAIRIE: "Pr",
      PR: "Pr",
      PORT: "Prt",
      PRT: "Prt",
      PORTS: "Prts",
      PRTS: "Prts",
      PASSAGE: "Psge",
      PSGE: "Psge",
      POINT: "Pt",
      PT: "Pt",
      POINTS: "Pts",
      PTS: "Pts",
      RADIAL: "Radl",
      RADL: "Radl",
      RAMP: "Ramp",
      REST: "Rst",
      RIDGE: "Rdg",
      RDG: "Rdg",
      RIDGES: "Rdgs",
      RDGS: "Rdgs",
      ROADS: "Rds",
      RDS: "Rds",
      RANCH: "Rnch",
      RNCH: "Rnch",
      RAPID: "Rpd",
      RPD: "Rpd",
      RAPIDS: "Rpds",
      RPDS: "Rpds",
      ROUTE: "Rte",
      RTE: "Rte",
      SHOAL: "Shl",
      SHL: "Shl",
      SHOALS: "Shls",
      SHLS: "Shls",
      SHORE: "Shr",
      SHR: "Shr",
      SHORES: "Shrs",
      SHRS: "Shrs",
      SKYWAY: "Skwy",
      SKWY: "Skwy",
      SUMMIT: "Smt",
      SMT: "Smt",
      SPRING: "Spg",
      SPG: "Spg",
      SPRINGS: "Spgs",
      SPGS: "Spgs",
      SQUARES: "Sqs",
      SQS: "Sqs",
      STATION: "Sta",
      STA: "Sta",
      STRAVENUE: "Stra",
      STRA: "Stra",
      STREAM: "Strm",
      STRM: "Strm",
      STREETS: "Sts",
      STS: "Sts",
      THROUGHWAY: "Trwy",
      TRWY: "Trwy",
      TRACE: "Trce",
      TRCE: "Trce",
      TRAFFICWAY: "Trfy",
      TRFY: "Trfy",
      TRAILER: "Trlr",
      TRLR: "Trlr",
      TUNNEL: "Tunl",
      TUNL: "Tunl",
      UNION: "Un",
      UN: "Un",
      UNIONS: "Uns",
      UNS: "Uns",
      UNDERPASS: "Upas",
      UPAS: "Upas",
      VIEW: "Vw",
      VIEWS: "Vws",
      VILLAGE: "Vlg",
      VLG: "Vlg",
      VILLAGES: "Vlgs",
      VLGS: "Vlgs",
      VALLEY: "Vl",
      VLY: "Vl",
      VALLEYS: "Vlys",
      VLYS: "Vlys",
      WAYS: "Ways",
      VIA: "Via",
      WELL: "Wl",
      WL: "Wl",
      WELLS: "Wls",
      WLS: "Wls",
      CROSSROAD: "Xrd",
      XRD: "Xrd",
      CROSSROADS: "Xrds",
      XRDS: "Xrds",
    };
    if (street_suffix_type) {
      const key = street_suffix_type.toUpperCase();
      if (suffixMap[key]) street_suffix_type = suffixMap[key];
    }

    const countyName = addrSeed.county_jurisdiction || null;

    return {
      // street_number: street_number || null,
      // street_name: street_name || null,
      // street_suffix_type: street_suffix_type || null,
      // street_pre_directional_text: null,
      // street_post_directional_text: null,
      // city_name: city_name || null,
      // municipality_name: null,
      // state_code: state_code || null,
      // postal_code: postal_code || null,
      // plus_four_postal_code: null,
      // country_code: "US",
      // county_name: countyName || null,
      // unit_identifier: null,
      latitude: null,
      longitude: null,
      // route_number: null,
      // township: null,
      // range: null,
      // section: null,
      // block: null,
      // lot: null,
    };
  }

  const addr = parseAddress();
  const rawPropertyAddress = (general.propertyLocationRaw ||
    addrSeed.full_address ||
    "")
    .replace(/\r/g, "")
    .replace(/\s*\n+\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();

  addr.unnormalized_address = rawPropertyAddress || null;
  // Extract latitude and longitude from addrSeed if available
  addr.latitude = addrSeed.latitude || null;
  addr.longitude = addrSeed.longitude || null;

  Object.keys(addr).forEach((key) => {
    if (
      ![
        "unnormalized_address",
        "country_code",
        "county_name",
        "request_identifier",
        "source_http_request",
        "latitude", // Keep latitude
        "longitude", // Keep longitude
      ].includes(key)
    ) {
      addr[key] = null;
    }
  });
  addr.country_code = rawPropertyAddress ? "US" : addr.country_code || "US";
  addr.county_name = addrSeed.county_jurisdiction || null;
  addr.request_identifier = propSeed.request_identifier || null;
  addr.source_http_request = propSeed.source_http_request || null;

  function buildMailingAddress(lines) {
    if (!Array.isArray(lines) || !lines.length) return null;
    const normalizedLines = lines
      .map((line) => (line || "").replace(/\s+/g, " ").trim())
      .filter((line) => line && line !== "/>");
    if (!normalizedLines.length) return null;

    const raw = normalizedLines.join(", ");

    // Only include unnormalized_address, request_identifier, and source_http_request
    return {
      latitude: null,
      longitude: null,
      unnormalized_address: raw,
      request_identifier: propSeed.request_identifier || null,
      source_http_request: propSeed.source_http_request || null,
    };
  }

  const mailingAddress = buildMailingAddress(
    general.mailingAddressLines || null,
  );
  const mailingAddressFile = mailingAddress ? "mailing_address.json" : null;
  // No need for the extensive mailingAddress object manipulation here,
  // as buildMailingAddress now returns only the required fields.

  function createRelationshipFileName(fromFile, toFile, suffix = null) {
    const fromBase = fromFile.replace(/\.json$/i, "");
    const toBase = toFile.replace(/\.json$/i, "");
    const base = `relationship_${fromBase}_has_${toBase}`;
    return suffix ? `${base}_${suffix}.json` : `${base}.json`;
  }

  // Write address.json
  writeJSON(path.join(dataDir, "address.json"), addr);
  if (mailingAddressFile) {
    writeJSON(path.join(dataDir, mailingAddressFile), mailingAddress);
  }

  // property.json
  const property = buildPropertyJson();
  Object.keys(property).forEach((k) => {
    if (property[k] === undefined) delete property[k];
  });
  writeJSON(path.join(dataDir, "property.json"), property);
  const propertyTypeValue = property.property_type || null;
  const isLandProperty =
    propertyTypeValue === "LandParcel" || property.build_status === "VacantLand";

  // lot.json
  const lot = {
    lot_type: null,
    lot_length_feet: null,
    lot_width_feet: null,
    lot_area_sqft: null,
    landscaping_features: null,
    view: null,
    fencing_type: null,
    fence_height: null,
    fence_length: null,
    driveway_material: null,
    driveway_condition: null,
    lot_condition_issues: null,
  };
  writeJSON(path.join(dataDir, "lot.json"), lot);

  // tax_*.json
  if (
    bx.taxYear ||
    bx.marketValue ||
    bx.assessedValue ||
    bx.taxableValue ||
    bx.buildingValue ||
    bx.landValue
  ) {
    const targetTaxYear = 2025;
    const tax = {
      tax_year: targetTaxYear,
      property_assessed_value_amount:
        bx.assessedValue != null ? bx.assessedValue : null,
      property_market_value_amount:
        bx.marketValue != null ? bx.marketValue : null,
      property_building_amount:
        bx.buildingValue != null ? bx.buildingValue : null,
      property_land_amount: bx.landValue != null ? bx.landValue : null,
      property_taxable_value_amount:
        bx.taxableValue != null ? bx.taxableValue : null,
      monthly_tax_amount: null,
      period_end_date: null,
      period_start_date: null,
      yearly_tax_amount: null,
      first_year_on_tax_roll: null,
      first_year_building_on_tax_roll: null,
    };
    const taxName = `tax_${tax.tax_year}.json`;
    writeJSON(path.join(dataDir, taxName), tax);
    if (tax.tax_year && fs.existsSync(path.join(dataDir, "tax_1.json"))) {
      try {
        fs.unlinkSync(path.join(dataDir, "tax_1.json"));
      } catch (e) {}
    }
  }

  // structure.json — include parsed stories and exterior wall mapping
  const livingAreaNumber =
    bx.livingArea != null
      ? parseFloat(String(bx.livingArea).replace(/,/g, ""))
      : null;

  const exteriorWallPrimary = coerceExteriorWallMaterial(
    bx.structure.exterior_wall_material_primary || null,
  );
  const exteriorWallSecondary = coerceExteriorWallMaterial(
    bx.structure.exterior_wall_material_secondary || null,
  );
  const primaryFramingMaterial = coercePrimaryFramingMaterial(
    bx.structure.primary_framing_material || null,
  );

  const structure = {
    architectural_style_type: null,
    attachment_type: null,
    exterior_wall_material_primary: exteriorWallPrimary,
    exterior_wall_material_secondary: exteriorWallSecondary,
    exterior_wall_condition: null,
    exterior_wall_insulation_type: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    subfloor_material: null,
    flooring_condition: null,
    interior_wall_structure_material: null,
    interior_wall_surface_material_primary: null,
    interior_wall_surface_material_secondary: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_condition: null,
    roof_covering_material: null,
    roof_underlayment_type: null,
    roof_structure_material: null,
    roof_design_type: null,
    roof_condition: null,
    roof_age_years: null,
    gutters_material: null,
    gutters_condition: null,
    roof_material_type: null,
    foundation_type: null,
    foundation_material: null,
    foundation_waterproofing: null,
    foundation_condition: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    ceiling_insulation_type: null,
    ceiling_height_average: null,
    ceiling_condition: null,
    exterior_door_material: null,
    interior_door_material: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,
    primary_framing_material: primaryFramingMaterial,
    secondary_framing_material: null,
    structural_damage_indicators: null,
    number_of_stories: bx.structure.number_of_stories || null,
    finished_base_area:
      livingAreaNumber != null && !Number.isNaN(livingAreaNumber)
        ? livingAreaNumber
        : null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    roof_date: bx.yearBuilt ? String(bx.yearBuilt) : null,
  };
  const structureFileName = "structure_1.json";
  writeJSON(path.join(dataDir, structureFileName), structure);
  structureFiles.push(structureFileName);

  const inferredBuildingTotalArea =
    structure.finished_base_area ??
    structure.finished_upper_story_area ??
    structure.unfinished_base_area ??
    structure.unfinished_upper_story_area ??
    structure.finished_basement_area ??
    (bx.livingArea != null ? toNumber(bx.livingArea) : null);
  const inferredBuildingLivableArea =
    structure.finished_base_area ??
    (bx.livingArea != null ? toNumber(bx.livingArea) : null) ??
    inferredBuildingTotalArea ??
    null;

  // utility.json from utilities_data
  const resolvedUtilityRecord = resolveRecordForKey(utilitiesData, propertyKey);
  if (resolvedUtilityRecord) {
    const utilityFileName = "utility_1.json";
    writeJSON(path.join(dataDir, utilityFileName), resolvedUtilityRecord);
    utilityFiles.push(utilityFileName);
  }

  // layout_*.json from layout_data
  let layoutRecord = null;
  if (layoutData && typeof layoutData === "object") {
    layoutRecord = resolveRecordForKey(layoutData, propertyKey);
  }

  if (layoutRecord && Array.isArray(layoutRecord.layouts)) {
    const layouts = layoutRecord.layouts;
    const layoutIdToFile = new Map();
    const layoutParentLinks = [];

    layouts.forEach((layoutObj, idx) => {
      const fileName = `layout_${idx + 1}.json`;
      const localId =
        (layoutObj.local_id && String(layoutObj.local_id)) || fileName;
      const parentLocalId =
        layoutObj.parent_local_id != null
          ? String(layoutObj.parent_local_id)
          : null;

      const layoutContent = { ...layoutObj };
      delete layoutContent.local_id;
      delete layoutContent.parent_local_id;

      const isBuildingLayout = (layoutContent.space_type || "") === "Building";
      if (isBuildingLayout) {
        if (
          layoutContent.total_area_sq_ft == null &&
          inferredBuildingTotalArea != null
        ) {
          layoutContent.total_area_sq_ft = inferredBuildingTotalArea;
        }
        if (
          layoutContent.livable_area_sq_ft == null &&
          inferredBuildingLivableArea != null
        ) {
          layoutContent.livable_area_sq_ft = inferredBuildingLivableArea;
        }
        if (
          layoutContent.size_square_feet == null &&
          layoutContent.total_area_sq_ft != null
        ) {
          layoutContent.size_square_feet = layoutContent.total_area_sq_ft;
        }
        layoutContent.is_exterior =
          layoutContent.is_exterior !== undefined
            ? layoutContent.is_exterior
            : false;
        layoutContent.is_finished =
          layoutContent.is_finished !== undefined
            ? layoutContent.is_finished
            : true;
      }

      writeJSON(path.join(dataDir, fileName), layoutContent);
      allLayoutFiles.push(fileName);
      layoutIdToFile.set(localId, fileName);

      if (parentLocalId) {
        layoutParentLinks.push({ parent: parentLocalId, child: localId });
      } else {
        topLevelLayoutFiles.push(fileName);
      }

      if (isBuildingLayout) {
        buildingLayoutFiles.push(fileName);
      }
    });

    layoutParentLinks.forEach((link) => {
      const parentFile = layoutIdToFile.get(link.parent);
      const childFile = layoutIdToFile.get(link.child);
      if (!parentFile || !childFile) return;
      const rel = {
        from: { "/": `./${parentFile}` },
        to: { "/": `./${childFile}` },
      };
      const relFile = createRelationshipFileName(parentFile, childFile);
      writeJSON(path.join(dataDir, relFile), rel);
    });
  }

  const existingLayoutFiles = new Set(allLayoutFiles);
  const getUniqueLayoutFileName = (base) => {
    if (!existingLayoutFiles.has(base)) {
      existingLayoutFiles.add(base);
      return base;
    }
    const extIndex = base.lastIndexOf(".json");
    const prefix = extIndex !== -1 ? base.slice(0, extIndex) : base;
    const suffix = extIndex !== -1 ? base.slice(extIndex) : "";
    let counter = 2;
    // ensure uniqueness
    let candidate = `${prefix}_${counter}${suffix}`;
    while (existingLayoutFiles.has(candidate)) {
      counter += 1;
      candidate = `${prefix}_${counter}${suffix}`;
    }
    existingLayoutFiles.add(candidate);
    return candidate;
  };

  // if (!isLandProperty && buildingLayoutFiles.length === 0) {
  //   const defaultLayoutFile = getUniqueLayoutFileName("layout_1.json");
  //   const defaultLayout = {
  //     space_type: "Building",
  //     space_index: 1,
  //     space_type_index: "1",
  //     size_square_feet:
  //       inferredBuildingTotalArea != null
  //         ? inferredBuildingTotalArea
  //         : inferredBuildingLivableArea,
  //     total_area_sq_ft:
  //       inferredBuildingTotalArea != null ? inferredBuildingTotalArea : null,
  //     livable_area_sq_ft:
  //       inferredBuildingLivableArea != null ? inferredBuildingLivableArea : null,
  //     is_exterior: false,
  //     is_finished: true,
  //     building_number: 1,
  //   };
  //   writeJSON(path.join(dataDir, defaultLayoutFile), defaultLayout);
  //   allLayoutFiles.push(defaultLayoutFile);
  //   topLevelLayoutFiles.push(defaultLayoutFile);
  //   buildingLayoutFiles.push(defaultLayoutFile);
  //   autoGeneratedBuildingLayoutFile = defaultLayoutFile;
  // }

  const propertyFileName = "property.json";
  buildingLayoutFiles.sort();
  structureFiles.sort();
  utilityFiles.sort();
  const writeRelationshipFile = (fromFile, toFile, suffix = null) => {
    const rel = {
      from: { "/": `./${fromFile}` },
      to: { "/": `./${toFile}` },
    };
    const relFile = createRelationshipFileName(fromFile, toFile, suffix);
    writeJSON(path.join(dataDir, relFile), rel);
  };

  const propertyLayoutTargets = autoGeneratedBuildingLayoutFile
    ? [autoGeneratedBuildingLayoutFile]
    : topLevelLayoutFiles.slice();

  // if (propertyLayoutTargets.length > 0) {
  //   propertyLayoutTargets.forEach((layoutFile, idx) => {
  //     const suffix =
  //       propertyLayoutTargets.length === 1 ? null : idx + 1;
  //     writeRelationshipFile(propertyFileName, layoutFile, suffix);
  //   });
  // }

  if (autoGeneratedBuildingLayoutFile) {
    const childLayouts = topLevelLayoutFiles.filter(
      (file) => file !== autoGeneratedBuildingLayoutFile,
    );
    if (childLayouts.length > 0) {
      childLayouts.forEach((layoutFile, idx) => {
        const suffix = childLayouts.length === 1 ? null : idx + 1;
        writeRelationshipFile(autoGeneratedBuildingLayoutFile, layoutFile, suffix);
      });
    }
  }

  if (structureFiles.length > 0) {
    if (buildingLayoutFiles.length === 0) {
      structureFiles.forEach((structureFile, index) => {
        const suffix = structureFiles.length === 1 ? null : index + 1;
        writeRelationshipFile(propertyFileName, structureFile, suffix);
      });
    } else if (buildingLayoutFiles.length === 1) {
      const layoutFile = buildingLayoutFiles[0];
      structureFiles.forEach((structureFile) => {
        writeRelationshipFile(layoutFile, structureFile, null);
      });
    } else {
      if (structureFiles.length === 1) {
        writeRelationshipFile(propertyFileName, structureFiles[0], null);
      } else {
        const pairCount = Math.min(
          structureFiles.length,
          buildingLayoutFiles.length,
        );
        for (let i = 0; i < pairCount; i += 1) {
          writeRelationshipFile(
            buildingLayoutFiles[i],
            structureFiles[i],
            null,
          );
        }
        const leftoverCount = structureFiles.length - pairCount;
        if (leftoverCount > 0) {
          for (let i = pairCount; i < structureFiles.length; i += 1) {
            const suffix =
              leftoverCount === 1 ? null : i - pairCount + 1;
            writeRelationshipFile(
              propertyFileName,
              structureFiles[i],
              suffix,
            );
          }
        }
      }
    }
  }

  if (utilityFiles.length > 0) {
    if (buildingLayoutFiles.length === 0) {
      utilityFiles.forEach((utilityFile, index) => {
        const suffix = utilityFiles.length === 1 ? null : index + 1;
        writeRelationshipFile(propertyFileName, utilityFile, suffix);
      });
    } else if (buildingLayoutFiles.length === 1) {
      const layoutFile = buildingLayoutFiles[0];
      utilityFiles.forEach((utilityFile) => {
        writeRelationshipFile(layoutFile, utilityFile, null);
      });
    } else {
      if (utilityFiles.length === 1) {
        writeRelationshipFile(propertyFileName, utilityFiles[0], null);
      } else {
        const pairCount = Math.min(
          utilityFiles.length,
          buildingLayoutFiles.length,
        );
        for (let i = 0; i < pairCount; i += 1) {
          writeRelationshipFile(
            buildingLayoutFiles[i],
            utilityFiles[i],
            null,
          );
        }
        const leftoverCount = utilityFiles.length - pairCount;
        if (leftoverCount > 0) {
          for (let i = pairCount; i < utilityFiles.length; i += 1) {
            const suffix =
              leftoverCount === 1 ? null : i - pairCount + 1;
            writeRelationshipFile(
              propertyFileName,
              utilityFiles[i],
              suffix,
            );
          }
        }
      }
    }
  }

  // Owners: person_*.json or company_*.json
  const personFiles = [];
  const companyFiles = [];
  const resolvedOwnerRecord = resolveRecordForKey(ownerData, propertyKey);
  console.log("Resolved Owner Record for processing:", JSON.stringify(resolvedOwnerRecord, null, 2)); // DEBUG LOG

  if (resolvedOwnerRecord && resolvedOwnerRecord.owners_by_date) {
    const ownersByDate = resolvedOwnerRecord.owners_by_date;
    console.log("OwnersByDate for iteration:", JSON.stringify(ownersByDate, null, 2)); // DEBUG LOG

    const seenOwners = new Map();
    const pushOwner = (owner) => {
      if (!owner) return;
      const ownerType = (owner.type || "").toString().toLowerCase();
      if (ownerType === "person") {
        const first = properCaseName(owner.first_name || null);
        const last = properCaseName(owner.last_name || null);
        if (!first || !last) return;
        const middle = owner.middle_name ? owner.middle_name : null;
        const prefixName = owner.prefix_name ? owner.prefix_name : null;
        const suffixName = owner.suffix_name ? owner.suffix_name : null;
        const key = `person:${[first, middle, last, prefixName, suffixName]
          .map((part) => (part || "").trim().toLowerCase())
          .filter(Boolean) // Filter out empty parts for a cleaner key
          .join("|")}`;
        if (seenOwners.has(key)) return;
        seenOwners.set(key, {
          type: "person",
          payload: {
            birth_date: null,
            first_name: first,
            last_name: last,
            middle_name: middle,
            prefix_name: prefixName,
            suffix_name: suffixName,
            us_citizenship_status: null,
            veteran_status: null,
          },
        });
        console.log("Pushed person owner to seenOwners:", key, seenOwners.get(key)); // DEBUG LOG
      } else if (ownerType === "company") {
        const rawName = owner.name || owner.company_name || owner.organization_name;
        if (!rawName) return;
        const normalized = rawName.replace(/\s+/g, " ").trim();
        if (!normalized) return;
        const key = `company:${normalized.toLowerCase()}`;
        if (seenOwners.has(key)) return;
        seenOwners.set(key, {
          type: "company",
          payload: { name: normalized },
        });
        console.log("Pushed company owner to seenOwners:", key, seenOwners.get(key)); // DEBUG LOG
      }
    };

    Object.entries(ownersByDate).forEach(([dateKey, entry]) => {
      console.log(`Iterating ownersByDate: dateKey='${dateKey}', entry type='${Array.isArray(entry) ? 'array' : typeof entry}'`); // DEBUG LOG
      if (Array.isArray(entry)) {
        entry.forEach((owner) => pushOwner(owner));
      } else if (typeof entry === 'object' && entry !== null && entry.type) {
        // This handles cases where an owner object might be directly under a dateKey,
        // though the current buildOwnersByDate typically puts arrays there.
        pushOwner(entry);
      }
    });

    console.log("Final seenOwners Map contents:", Array.from(seenOwners.values())); // DEBUG LOG

    let personIndex = 1;
    let companyIndex = 1;
    seenOwners.forEach((info) => {
      console.log("Processing owner from seenOwners for file creation:", info); // DEBUG LOG
      if (info.type === "person") {
        const file = `person_${personIndex}.json`;
        writeJSON(path.join(dataDir, file), info.payload);
        personFiles.push(file);
        personIndex += 1;
        console.log("Created person file:", file, info.payload); // DEBUG LOG
      } else if (info.type === "company") {
        const file = `company_${companyIndex}.json`;
        writeJSON(path.join(dataDir, file), info.payload);
        companyFiles.push(file);
        companyIndex += 1;
        console.log("Created company file:", file, info.payload); // DEBUG LOG
      }
    });
    console.log("All person files created:", personFiles); // DEBUG LOG
    console.log("All company files created:", companyFiles); // DEBUG LOG
  }

  if (mailingAddressFile) {
    personFiles.forEach((pf) => {
      const rel = {
        from: { "/": `./${pf}` },
        to: { "/": `./${mailingAddressFile}` },
      };
      const relFile = createRelationshipFileName(pf, mailingAddressFile);
      writeJSON(path.join(dataDir, relFile), rel);
    });
    companyFiles.forEach((cf) => {
      const rel = {
        from: { "/": `./${cf}` },
        to: { "/": `./${mailingAddressFile}` },
      };
      const relFile = createRelationshipFileName(cf, mailingAddressFile);
      writeJSON(path.join(dataDir, relFile), rel);
    });
  }

  // sales_history_*.json, deed_*.json, file_*.json + relationships
  const salesHistoryFiles = [];
  const salesHistoryMeta = [];
  const deedFiles = [];
  const fileFiles = [];
  (bx.sales || []).forEach((sale, index) => {
    const saleFileName = `sales_history_${index + 1}.json`;
    const saleObj = {
      ownership_transfer_date: sale.sale_date || null,
    };
    if (sale.sale_price != null) {
      saleObj.purchase_price_amount = sale.sale_price;
    }
    writeJSON(path.join(dataDir, saleFileName), saleObj);
    salesHistoryFiles.push(saleFileName);
    salesHistoryMeta.push({
      file: saleFileName,
      ownership_transfer_date: saleObj.ownership_transfer_date,
    });

    const deedFileName = `deed_${index + 1}.json`;
    const deedObj = {
      deed_type: normalizeDeedType(sale.instrument),
    };
    const bookVal =
      sale.book != null && String(sale.book).trim() ? String(sale.book).trim() : null;
    const pageVal =
      sale.page != null && String(sale.page).trim() ? String(sale.page).trim() : null;
    const volumeVal =
      sale.volume != null && String(sale.volume).trim()
        ? String(sale.volume).trim()
        : null;
    const instrumentNumberRaw =
      sale.instrument_number != null ? String(sale.instrument_number).trim() : "";
    if (bookVal) deedObj.book = bookVal;
    if (pageVal) deedObj.page = pageVal;
    if (volumeVal) deedObj.volume = volumeVal;
    if (instrumentNumberRaw) deedObj.instrument_number = instrumentNumberRaw;
    writeJSON(path.join(dataDir, deedFileName), deedObj);
    deedFiles.push(deedFileName);

    const fileFileName = `file_${index + 1}.json`;
    const fileObj = {
      document_type: "Title",
      file_format: null,
      ipfs_url: null,
      name: sale.document_name || null,
      original_url: sale.document_url || null,
    };
    writeJSON(path.join(dataDir, fileFileName), fileObj);
    fileFiles.push(fileFileName);
  });

  // relationship_deed_file_*.json (file → deed)
  for (let i = 0; i < Math.min(deedFiles.length, fileFiles.length); i++) {
    writeRelationshipFile(fileFiles[i], deedFiles[i]);
  }

  // relationship_sales_history_deed_*.json (sales_history → deed)
  for (let i = 0; i < Math.min(salesHistoryFiles.length, deedFiles.length); i++) {
    writeRelationshipFile(salesHistoryFiles[i], deedFiles[i]);
  }

  // relationship_sales_history_person/company_*.json for current owners to most recent sale
  const latestSaleMeta = salesHistoryMeta
    .map((entry, idx) => ({ ...entry, idx }))
    .filter((entry) => entry.ownership_transfer_date)
    .sort((a, b) =>
      a.ownership_transfer_date === b.ownership_transfer_date
        ? 0
        : a.ownership_transfer_date > b.ownership_transfer_date
        ? -1
        : 1,
    )[0];
  const latestIndex = latestSaleMeta ? latestSaleMeta.idx : 0;
  const latestSaleFile = salesHistoryFiles[latestIndex] || null;
  if (latestSaleFile) {
    const linkOwnerToSale = (ownerFileList) => {
      ownerFileList.forEach((ownerFile) => {
        writeRelationshipFile(latestSaleFile, ownerFile);
      });
    };
    if (personFiles.length > 0) {
      linkOwnerToSale(personFiles);
    }
    if (companyFiles.length > 0) {
      linkOwnerToSale(companyFiles);
    }
  }

  const propertyImprovementFiles = [];
  const miscImprovementRows = $("#cphMain_gvImprovements tr").toArray();
  if (miscImprovementRows.length > 1) {
    let improvementIndex = 1;
    miscImprovementRows.slice(1).forEach((row) => {
      const tds = $(row).find("td");
      if (tds.length < 6) return;
      const typeText = textNormalize($(tds[1]).text());
      if (!typeText) return;
      const codeMatch = typeText.match(/\(([^)]+)\)/);
      const rawCode = codeMatch ? codeMatch[1].trim().toUpperCase() : null;
      const baseCode = rawCode ? rawCode.replace(/[^A-Z]/g, "") : null;
      const description = typeText.replace(/\([^)]*\)/, "").trim();
      const improvementType = mapMiscImprovementType(baseCode, description);
      if (!improvementType) return;

      const improvement = {
        improvement_type: improvementType,
        improvement_status: null,
        completion_date: null,
        contractor_type: null,
        permit_required: false,
      };

      const fileName = `property_improvement_${improvementIndex}.json`;
      writeJSON(path.join(dataDir, fileName), improvement);
      propertyImprovementFiles.push(fileName);
      improvementIndex += 1;
    });
  }

  propertyImprovementFiles.forEach((fileName) => {
    writeRelationshipFile(propertyFileName, fileName);
  });

  if (missingDorCodes.size > 0) {
    console.warn(
      `Unmapped DOR codes encountered: ${Array.from(missingDorCodes).join(", ")}`,
    );
  }
}

main();