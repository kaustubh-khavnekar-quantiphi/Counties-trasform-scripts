const fs = require("fs");
const cheerio = require("cheerio");

// Load input HTML
const html = fs.readFileSync("input.html", "utf8");
const $ = cheerio.load(html);

// Utility: normalize whitespace
const norm = (s) => (s || "").replace(/\s+/g, " ").trim();

// Utility: detect if a string looks like an address line (contains digits or zip or comma + state)
const looksLikeAddress = (s) => {
  const str = (s || "").toLowerCase();
  if (!str) return false;
  if (/\d/.test(str)) return true; // numbers typical for addresses
  if (
    /\b(fl|ca|ny|tx|wa|ga|il|oh|pa|nc|va|az|nj|ma|mi|co|tn|in|mo|md|wi|mn|al|sc|la|ky|or|ok|ct|ia|ut|ms|ar|nv|nm|ne|wv|id|hi|nh|me|mt|ri|de|sd|nd|vt)\b/.test(
      str,
    )
  )
    return true;
  if (/,/.test(str)) return true; // city, state
  return false;
};

// Company detection tokens (case-insensitive, word boundaries where possible)
const COMPANY_TOKENS = [
  "inc",
  "llc",
  "ltd",
  "foundation",
  "alliance",
  "solutions",
  "corp",
  "co",
  "services",
  "trust",
  "tr",
  "incorporated",
  "company",
  "lp",
  "llp",
  "pllc",
  "plc",
  "holdings",
  "partners",
  "partnership",
  "association",
  "church",
  "bank",
  "university",
  "college",
  "hospital",
  "group",
  "enterprises",
  "properties",
  "management",
  "investments",
];

const isCompany = (name) => {
  const n = (name || "").toLowerCase();
  return COMPANY_TOKENS.some((tok) =>
    new RegExp(`(^|[^a-z])${tok}([^a-z]|$)`, "i").test(n),
  );
};

// Parse person name from a string
function parsePersonName(raw) {
  const cleaned = norm(raw)
    .replace(/\s*&\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!cleaned) return null;

  // Handle "Last, First Middle" format
  if (/,/.test(cleaned)) {
    const [lastPart, restPart] = cleaned.split(/,\s*/);
    const restTokens = (restPart || "").split(/\s+/).filter(Boolean);
    if (restTokens.length === 0) return null;
    const first = restTokens[0];
    const middle = restTokens.slice(1).join(" ") || null;
    return {
      type: "person",
      first_name: first,
      last_name: lastPart,
      middle_name: middle || null,
    };
  }

  // Handle simple space-separated names: First Middle Last
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null; // can't decide first/last
  const first = tokens[0];
  const last = tokens[tokens.length - 1];
  const middle = tokens.slice(1, -1).join(" ") || null;
  return {
    type: "person",
    first_name: first,
    last_name: last,
    middle_name: middle || null,
  };
}

// Normalize owner for deduplication
function normalizeOwnerForKey(owner) {
  if (!owner) return "";
  if (owner.type === "company") return norm(owner.name).toLowerCase();
  const middle = owner.middle_name ? ` ${owner.middle_name}` : "";
  return `${norm(owner.first_name)}${middle} ${norm(owner.last_name)}`.toLowerCase();
}

// Extract property id with tight heuristics around table rows
function extractPropertyId($doc) {
  // Strategy 1: Find the table row with a header containing Parcel ID / Property ID
  let id = null;
  $doc("tr").each((i, tr) => {
    const th = $doc(tr).find("th").first();
    const label = norm(th.text()).toLowerCase();
    if (!label) return;
    if (/(parcel\s*id|property\s*id|prop\s*id)/i.test(label)) {
      const td = $doc(tr).find("td").first();
      if (td.length) {
        const bold = td.find("b").first();
        const candidate = bold.length ? norm(bold.text()) : norm(td.text());
        if (candidate) {
          id = candidate;
          return false;
        }
      }
    }
  });

  // Strategy 2: Regex fallback for typical parcel formats
  if (!id) {
    const m = html.match(/\b\d{3,}-\d{3}-\d{4}-\d{3}-\d\b/);
    if (m) id = m[0];
  }

  return id ? id : "unknown_id";
}

// Extract plausible owner name strings from the document
function extractOwnerNameStrings($doc) {
  const candidates = [];

  // Strategy A: Ownership section first line
  const ownP = $doc("#ownership .bottom-text p").first();
  if (ownP.length) {
    const htmlFrag = ownP.html() || "";
    const lines = htmlFrag
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .split("\n")
      .map((s) => norm(s))
      .filter(Boolean);
    if (lines.length) {
      for (const line of lines) {
        if (!looksLikeAddress(line)) {
          candidates.push(line);
          break;
        }
      }
    }
  }

  // Strategy B: Any table label containing Owner -> adjacent cell text
  $doc("tr").each((i, tr) => {
    const th = $doc(tr).find("th").first();
    const td = $doc(tr).find("td").first();
    const label = norm(th.text()).toLowerCase();
    if (label && /owner|grantee/.test(label)) {
      const val = norm(td.text());
      if (val) candidates.push(val);
    }
  });

  // Strategy C: Elements whose preceding sibling heading includes Owner/Ownership
  $doc("h1,h2,h3,h4,h5").each((i, h) => {
    const txt = norm($doc(h).text()).toLowerCase();
    if (/\bowner(ship)?\b/.test(txt)) {
      const container = $doc(h).parent();
      const p = container.find("p").first();
      const t = norm(p.text());
      if (t) {
        const maybe =
          t
            .split(/\n|\r/)
            .map((s) => norm(s))
            .filter(Boolean)[0] || t;
        candidates.push(maybe);
      }
    }
  });

  // Deduplicate raw candidate strings by normalized text
  const seen = new Set();
  const out = [];
  for (const c of candidates) {
    const key = norm(c).toLowerCase();
    if (!key) continue;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}

// Classify and structure owners
function classifyOwners(rawNames) {
  const owners = [];
  const invalid = [];
  const seen = new Set();

  for (const raw of rawNames) {
    const name = norm(raw).replace(/^owner:?\s*/i, "");
    if (!name) continue;

    if (isCompany(name)) {
      const owner = { type: "company", name: name };
      const key = normalizeOwnerForKey(owner);
      if (key && !seen.has(key)) {
        seen.add(key);
        owners.push(owner);
      }
      continue;
    }

    // Person (including names with &)
    const person = parsePersonName(name.replace(/\s*&\s*/g, " "));
    if (person) {
      const key = normalizeOwnerForKey(person);
      if (key && !seen.has(key)) {
        seen.add(key);
        owners.push(person);
      }
    } else {
      invalid.push({ raw: raw, reason: "unclassified_or_insufficient" });
    }
  }

  return { owners, invalid };
}

// Associate owners with dates if available (heuristic placeholder)
function buildOwnersByDate(owners) {
  const map = {};
  map["current"] = owners;
  return map;
}

// Main extraction flow
const propertyId = extractPropertyId($);
const rawOwnerNames = extractOwnerNameStrings($);
const { owners, invalid } = classifyOwners(rawOwnerNames);
const ownersByDate = buildOwnersByDate(owners);

const result = {};
result[`property_${propertyId}`] = {
  owners_by_date: ownersByDate,
  invalid_owners: invalid,
};

// Write to file and print
fs.writeFileSync(
  "owners/owner_data.json",
  JSON.stringify(result, null, 2),
  "utf8",
);
console.log(JSON.stringify(result, null, 2));
