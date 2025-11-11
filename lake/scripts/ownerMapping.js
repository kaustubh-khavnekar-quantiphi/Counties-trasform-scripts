const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Read input HTML
const inputPath = path.join(process.cwd(), "input.html");
const html = fs.readFileSync(inputPath, "utf-8");
const $ = cheerio.load(html);

// Helpers
const normalizeSpace = (s) => (s || "").replace(/\s+/g, " ").trim();
const cleanName = (s) =>
  normalizeSpace(String(s).replace(/\u00A0/g, " "))
    .replace(/^[,;\-]+|[,;\-]+$/g, "")
    .trim();
const isAllCapsWord = (w) => !!w && w === w.toUpperCase();
const hasLetters = (s) => /[A-Za-z]/.test(s || "");
const stripPunctuation = (s) => (s || "").replace(/[\.,;:]+/g, "").trim();

function normalizeAffixToken(token) {
  return stripPunctuation(token || "").replace(/[\s']/g, "").toUpperCase();
}

function consumePrefixes(tokens) {
  const working = tokens;
  while (working.length > 0) {
    const candidate = normalizeAffixToken(working[0]);
    if (candidate && PREFIX_MAP.has(candidate)) {
      const mapped = PREFIX_MAP.get(candidate);
      working.shift();
      return mapped;
    }
    break;
  }
  return null;
}

function consumeSuffixes(tokens) {
  const working = tokens;
  let bestValue = null;
  let bestPriority = -1;
  while (working.length > 0) {
    const candidate = normalizeAffixToken(working[working.length - 1]);
    if (candidate && SUFFIX_CONFIG.has(candidate)) {
      const config = SUFFIX_CONFIG.get(candidate);
      working.pop();
      if (config.priority > bestPriority) {
        bestPriority = config.priority;
        bestValue = config.value;
      }
      continue;
    }
    break;
  }
  return bestValue;
}

// Company detection keywords (case-insensitive)
const companyKeywords = [
  "inc",
  "llc",
  "l.l.c",
  "ltd",
  "foundation",
  "alliance",
  "solutions",
  "corp",
  "co",
  "company",
  "services",
  "trust",
  "tr",
  "assn",
  "association",
  "partners",
  "lp",
  "llp",
  "pllc",
  "pc",
  "holdings",
  "group",
  "bank",
  "n.a",
  "na",
  "fbo",
  "ministries",
  "church",
  "church",
  "c/o",
  "united states",
  "state of",
  "county of",
  "city of",
  "department",
  "dept",
  "authority",
  "agency",
  "commission",
  "board",
  "school",
];

const PREFIX_MAP = new Map([
  ["MR", "Mr."],
  ["MR.", "Mr."],
  ["MRS", "Mrs."],
  ["MRS.", "Mrs."],
  ["MS", "Ms."],
  ["MS.", "Ms."],
  ["MISS", "Miss"],
  ["SRTA", "Miss"],
  ["MX", "Mx."],
  ["DR", "Dr."],
  ["DR.", "Dr."],
  ["DOCTOR", "Dr."],
  ["PROF", "Prof."],
  ["PROF.", "Prof."],
  ["PROFESSOR", "Prof."],
  ["REV", "Rev."],
  ["REV.", "Rev."],
  ["REVEREND", "Rev."],
  ["PASTOR", "Rev."],
  ["FATHER", "Fr."],
  ["FR", "Fr."],
  ["FR.", "Fr."],
  ["BROTHER", "Br."],
  ["BR", "Br."],
  ["BR.", "Br."],
  ["SISTER", "Sr."],
  ["SR", "Sr."],
  ["SR.", "Sr."],
  ["HON", "Hon."],
  ["HON.", "Hon."],
  ["HONORABLE", "Hon."],
  ["JUDGE", "Judge"],
  ["CAPT", "Capt."],
  ["CAPT.", "Capt."],
  ["CAPTAIN", "Capt."],
  ["COL", "Col."],
  ["COL.", "Col."],
  ["COLONEL", "Col."],
  ["MAJ", "Maj."],
  ["MAJ.", "Maj."],
  ["MAJOR", "Maj."],
  ["LT", "Lt."],
  ["LT.", "Lt."],
  ["LIEUTENANT", "Lt."],
  ["SGT", "Sgt."],
  ["SGT.", "Sgt."],
  ["SERGEANT", "Sgt."],
  ["RABBI", "Rabbi"],
  ["IMAM", "Imam"],
  ["SHEIKH", "Sheikh"],
  ["SIR", "Sir"],
  ["DAME", "Dame"],
]);

const SUFFIX_CONFIG = new Map([
  ["JR", { value: "Jr.", priority: 3 }],
  ["JR.", { value: "Jr.", priority: 3 }],
  ["SR", { value: "Sr.", priority: 3 }],
  ["SR.", { value: "Sr.", priority: 3 }],
  ["II", { value: "II", priority: 3 }],
  ["III", { value: "III", priority: 3 }],
  ["IV", { value: "IV", priority: 3 }],
  ["PHD", { value: "PhD", priority: 2 }],
  ["PH.D", { value: "PhD", priority: 2 }],
  ["PH.D.", { value: "PhD", priority: 2 }],
  ["MD", { value: "MD", priority: 2 }],
  ["M.D", { value: "MD", priority: 2 }],
  ["M.D.", { value: "MD", priority: 2 }],
  ["ESQ", { value: "Esq.", priority: 1 }],
  ["ESQ.", { value: "Esq.", priority: 1 }],
  ["JD", { value: "JD", priority: 2 }],
  ["J.D", { value: "JD", priority: 2 }],
  ["J.D.", { value: "JD", priority: 2 }],
  ["LLM", { value: "LLM", priority: 2 }],
  ["MBA", { value: "MBA", priority: 2 }],
  ["RN", { value: "RN", priority: 2 }],
  ["DDS", { value: "DDS", priority: 2 }],
  ["DDS.", { value: "DDS", priority: 2 }],
  ["DMD", { value: "DDS", priority: 2 }],
  ["D.M.D", { value: "DDS", priority: 2 }],
  ["D.M.D.", { value: "DDS", priority: 2 }],
  ["DVM", { value: "DVM", priority: 2 }],
  ["D.V.M", { value: "DVM", priority: 2 }],
  ["D.V.M.", { value: "DVM", priority: 2 }],
  ["CFA", { value: "CFA", priority: 2 }],
  ["CPA", { value: "CPA", priority: 2 }],
  ["PE", { value: "PE", priority: 2 }],
  ["P.E", { value: "PE", priority: 2 }],
  ["P.E.", { value: "PE", priority: 2 }],
  ["PMP", { value: "PMP", priority: 2 }],
  ["EMERITUS", { value: "Emeritus", priority: 1 }],
  ["RET", { value: "Ret.", priority: 1 }],
  ["RET.", { value: "Ret.", priority: 1 }],
]);
const SUFFIX_PRIORITY = new Map();
SUFFIX_CONFIG.forEach(({ value, priority }) => {
  const existing = SUFFIX_PRIORITY.get(value);
  if (existing == null || priority > existing) {
    SUFFIX_PRIORITY.set(value, priority);
  }
});

function isCompanyName(name) {
  const n = (name || "").toLowerCase();
  return companyKeywords.some((kw) =>
    new RegExp(`(^|[^a-z])${kw}([^a-z]|$)`, "i").test(n),
  );
}

function dedupeOwners(owners) {
  const seen = new Set();
  const out = [];
  for (const o of owners) {
    if (!o) continue;
    let key = "";
    if (o.type === "company") {
      if (!o.name || !hasLetters(o.name)) continue;
      key = `company:${o.name.toLowerCase().trim()}`;
    } else if (o.type === "person") {
      const first = (o.first_name || "").toLowerCase().trim();
      const middle = (o.middle_name || "").toLowerCase().trim();
      const last = (o.last_name || "").toLowerCase().trim();
      const suffix = (o.suffix_name || "").toLowerCase().trim();
      if (!first || !last) continue;
      key = `person:${first}|${middle}|${last}|${suffix}`;
    } else {
      continue;
    }
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(o);
    }
  }
  return out;
}

function parsePersonNameTokens(tokens, options = {}) {
  const { preferFirstLast = false, carryLastName = null } = options;
  const working = tokens.filter(Boolean).map((token) => token.trim());
  const prefix = consumePrefixes(working);
  const suffix = consumeSuffixes(working);

  if (working.length < 2) {
    if (working.length === 1 && carryLastName) {
      // Single given name; attach carried last name
      return {
        type: "person",
        first_name: stripPunctuation(working[0]),
        last_name: stripPunctuation(carryLastName),
        middle_name: null,
        prefix_name: prefix || null,
        suffix_name: suffix || null,
      };
    }
    return null;
  }

  // If preferFirstLast (e.g., second owner after '&' with shared last name)
  if (preferFirstLast) {
    const first = stripPunctuation(working[0]);
    const last = stripPunctuation(carryLastName || working[working.length - 1]);
    let middle = null;
    if (working.length >= 2) {
      const midCandidate = stripPunctuation(working.slice(1).join(" "));
      if (midCandidate && hasLetters(midCandidate)) middle = midCandidate;
    }
    const person = {
      type: "person",
      first_name: first,
      last_name: last,
    };
    if (middle) person.middle_name = middle;
    if (prefix) person.prefix_name = prefix;
    if (suffix) person.suffix_name = suffix;
    return person;
  }

  // Heuristic: for ALL-CAPS names without comma, assume LAST FIRST [MIDDLE]
  const allCaps = working.every(isAllCapsWord);
  if (allCaps) {
    if (working.length < 2) return null;
    const last = stripPunctuation(working[0]);
    const first = stripPunctuation(working[1]);
    const middle =
      working.length > 2
        ? stripPunctuation(working.slice(2).join(" "))
        : null;
    const person = {
      type: "person",
      first_name: first,
      last_name: last,
    };
    if (middle && hasLetters(middle)) person.middle_name = middle;
    if (prefix) person.prefix_name = prefix;
    if (suffix) person.suffix_name = suffix;
    return person;
  }

  // Default: FIRST [MIDDLE] LAST
  const first = stripPunctuation(working[0]);
  const last = stripPunctuation(working[working.length - 1]);
  const middle =
    working.length > 2
      ? stripPunctuation(working.slice(1, -1).join(" "))
      : null;
  const person = {
    type: "person",
    first_name: first,
    last_name: last,
  };
  if (middle && hasLetters(middle)) person.middle_name = middle;
  if (prefix) person.prefix_name = prefix;
  if (suffix) person.suffix_name = suffix;
  return person;
}

function parsePersonWithComma(name) {
  // Format: LAST, FIRST [MIDDLE]
  const parts = name.split(",");
  if (parts.length < 2) return null;
  const lastTokens = parts[0].split(/\s+/).filter(Boolean);
  const lastSuffix = consumeSuffixes(lastTokens);
  const last = stripPunctuation(lastTokens.join(" "));
  const rest = normalizeSpace(parts.slice(1).join(", "));
  const tokens = rest.split(/\s+/).filter(Boolean);
  if (tokens.length < 1) return null;
  const prefix = consumePrefixes(tokens);
  const suffixInRest = consumeSuffixes(tokens);
  const suffixParts = [lastSuffix, suffixInRest].filter(Boolean);
  const first = stripPunctuation(tokens[0]);
  const middle =
    tokens.length > 1 ? stripPunctuation(tokens.slice(1).join(" ")) : null;
  const person = { type: "person", first_name: first, last_name: last };
  if (middle && hasLetters(middle)) person.middle_name = middle;
  if (prefix) person.prefix_name = prefix;
  if (suffixParts.length) {
    suffixParts.sort(
      (a, b) => (SUFFIX_PRIORITY.get(b) || 0) - (SUFFIX_PRIORITY.get(a) || 0),
    );
    person.suffix_name = suffixParts[0];
  }
  return person;
}

function splitOwners(raw) {
  // Split on common delimiters between multiple owners: '&', ' and ' (case-insensitive), '/'
  // Keep commas inside names intact for Last, First formats
  const replaced = raw
    .replace(/\s+&\s+/g, " | ")
    .replace(/\sand\s/gi, " | ")
    .replace(/\s*\/\s*/g, " | ");
  return replaced
    .split("|")
    .map((s) => cleanName(s))
    .filter((s) => s);
}

function parseOwnersFromString(rawStr) {
  const owners = [];
  const invalid = [];
  const parts = splitOwners(rawStr);
  let priorLastName = null;

  for (let i = 0; i < parts.length; i++) {
    let part = parts[i];
    if (!part) continue;

    // Remove placeholders like ET AL, EST, ESTATE OF, ET UX, ET VIR
    const lowered = part.toLowerCase();
    if (
      /\bet\s*al\b/.test(lowered) ||
      /\best\b/.test(lowered) ||
      /\bestate\b/.test(lowered) ||
      /\bet\s*ux\b/.test(lowered) ||
      /\bet\s*vir\b/.test(lowered)
    ) {
      invalid.push({
        raw: part,
        reason: "not a specific owner name (placeholder)",
      });
      continue;
    }

    // Company classification
    if (isCompanyName(part)) {
      const companyName = cleanName(part);
      if (hasLetters(companyName)) {
        owners.push({ type: "company", name: companyName });
      } else {
        invalid.push({ raw: part, reason: "company name missing letters" });
      }
      continue;
    }

    // Person parsing
    let person = null;
    if (part.includes(",")) {
      person = parsePersonWithComma(part);
    } else {
      const tokens = part.split(/\s+/).filter(Boolean);
      // Heuristic: for subsequent owners with 1-2 tokens and prior last name => FIRST [MIDDLE] LAST(prior)
      const preferFirstLast = i > 0 && tokens.length <= 3 && !!priorLastName; // allow capturing middle initials
      person = parsePersonNameTokens(tokens, {
        preferFirstLast,
        carryLastName: priorLastName,
      });
    }

    if (person && person.first_name && person.last_name) {
      owners.push(person);
      priorLastName = person.last_name || priorLastName;
    } else {
      invalid.push({
        raw: part,
        reason: "unable to confidently parse person name",
      });
    }
  }

  return { owners, invalid };
}

function extractOwnerStrings($) {
  const candidates = [];
  const labelRegex = /^(owner\s*name|owner|name)\s*:*/i;

  $("td.property_field").each((_, el) => {
    const label = normalizeSpace($(el).text());
    if (labelRegex.test(label)) {
      const sibling = $(el).next("td.property_item");
      if (sibling && sibling.length) {
        const txt = normalizeSpace(sibling.text());
        if (txt) candidates.push(txt);
      }
    }
  });

  // Additional heuristic: look for any element with text starting with 'Owner' then next cell
  $("th, td, div, span, label").each((_, el) => {
    const txt = normalizeSpace($(el).text());
    if (/^owner\b/i.test(txt) && $(el).next().length) {
      const n = normalizeSpace($(el).next().text());
      if (n) candidates.push(n);
    }
  });

  // Deduplicate raw strings
  const seen = new Set();
  const unique = [];
  for (const c of candidates) {
    const k = c.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      unique.push(c);
    }
  }
  return unique;
}

function extractPropertyId($) {
  // Try Alternate Key first
  let id = null;
  $("td.property_field").each((_, el) => {
    const label = normalizeSpace($(el).text()).toLowerCase();
    if (label.includes("alternate key")) {
      const val = normalizeSpace($(el).next("td.property_item").text());
      if (val) id = val;
    }
  });

  if (!id) {
    // Try common label text variants
    $("td, th, label, span").each((_, el) => {
      const label = normalizeSpace($(el).text()).toLowerCase();
      if (/(property\s*id|prop(?:erty)?\s*key|alt\s*key|altkey)/i.test(label)) {
        const next = $(el).next();
        const val = normalizeSpace(next.text());
        if (val) id = val;
      }
    });
  }

  if (!id) {
    // Try link with query=ID
    const href = $("#cphMain_lnkGIS").attr("href");
    if (href && /[?&]query=([^&]+)/i.test(href)) {
      id = decodeURIComponent(href.match(/[?&]query=([^&]+)/i)[1]);
    }
  }

  if (!id) {
    // Try form action AltKey param
    const action = $("form").attr("action") || "";
    const m = action.match(/AltKey=([\w-]+)/i);
    if (m) id = m[1];
  }

  if (!id) id = "unknown_id";
  // normalize to digits if looks numeric
  id = id.toString().trim();
  return id;
}

function extractSalesDates($) {
  // Extract sale dates for potential chronological ordering (not mapped to owners due to missing names)
  const dates = [];
  $("table.property_data_table#cphMain_gvSalesHistory tr").each((i, tr) => {
    if (i === 0) return; // skip header
    const tds = $(tr).find("td");
    if (tds.length >= 2) {
      const dateText = normalizeSpace($(tds[1]).text());
      if (/\d{2}\/\d{2}\/\d{4}/.test(dateText)) {
        // Convert to YYYY-MM-DD
        const [mm, dd, yyyy] = dateText.split("/");
        const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
        dates.push(iso);
      }
    }
  });
  // Sort chronological ascending
  dates.sort();
  return dates;
}

// Main extraction
const propertyId = extractPropertyId($);

const ownerStrings = extractOwnerStrings($);
let allOwners = [];
let invalidOwners = [];

for (const raw of ownerStrings) {
  const { owners, invalid } = parseOwnersFromString(raw);
  allOwners = allOwners.concat(owners);
  invalidOwners = invalidOwners.concat(invalid);
}

// Deduplicate owners
const validOwners = dedupeOwners(allOwners);

// Build owners_by_date
const ownersByDate = {};
if (validOwners.length > 0) {
  ownersByDate["current"] = validOwners;
} else {
  ownersByDate["current"] = [];
}

// Prepare final object
const result = {};
result[`property_${propertyId}`] = {
  owners_by_date: ownersByDate,
  invalid_owners: invalidOwners,
};

// Ensure output directory and write file
const outDir = path.join(process.cwd(), "owners");
const outPath = path.join(outDir, "owner_data.json");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");

// Output JSON to stdout
console.log(JSON.stringify(result, null, 2));
