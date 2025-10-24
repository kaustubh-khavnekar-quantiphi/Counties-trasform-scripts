#!/usr/bin/env node
/*
  Data extractor for property package.
  - Reads: input.html, unnormalized_address.json, property_seed.json
           owners/owner_data.json, owners/utilities_data.json, owners/layout_data.json
  - Writes: JSON files in ./data per schemas (without performing schema validation)

  Notes:
  - Owners, utilities, and layout are sourced strictly from the owners/*.json inputs
  - All other data are parsed from input.html (with county assist from unnormalized_address)
  - Missing/unknown values are set to null where schema allows
  - Idempotent: clears ./data before writing
*/

const fs = require("fs");
const path = require("path");
let cheerio;
try {
  cheerio = require("cheerio");
} catch (e) {
  cheerio = null;
}

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

function parseCurrency(str) {
  if (str == null) return null;
  const s = String(str).replace(/[$,\s]/g, "");
  const n = parseFloat(s);
  return isFinite(n) ? Number(n.toFixed(2)) : null;
}
function parseNumber(str) {
  if (str == null) return null;
  const cleaned = String(str).replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}
function parseCoordinate(val) {
  if (val == null) return null;
  const num =
    typeof val === "string" ? parseFloat(val) : Number(val);
  return Number.isFinite(num) ? Number(num) : null;
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

const PROPERTY_TYPE_BY_CODE = Object.freeze({
  "0000": "VacantLand",
  "0002": "VacantLand",
  "0003": "VacantLand",
  "0038": "VacantLand",
  "0100": "SingleFamily",
  "0102": "SingleFamily",
  "0103": "SingleFamily",
  "0138": "SingleFamily",
  "0200": "ManufacturedHousing",
  "0202": "ManufacturedHousing",
  "0203": "ManufacturedHousing",
  "0210": "LandParcel",
  "0220": "LandParcel",
  "0225": "Cooperative",
  "0230": "ManufacturedHousing",
  "0232": "ManufacturedHousing",
  "0233": "ManufacturedHousing",
  "0238": "ManufacturedHousing",
  "0300": "MultiFamilyMoreThan10",
  "0400": "Condominium",
  "0403": "Condominium",
  "0421": "Timeshare",
  "0430": "Timeshare",
  "0500": "Cooperative",
  "0600": "Retirement",
  "0700": "MiscellaneousResidential",
  "0800": "MultiFamilyLessThan10",
  "0802": "MultipleFamily",
  "0803": "MultipleFamily",
  "1000": "VacantLand",
  "1100": "Building",
  "1200": "Building",
  "1300": "Building",
  "1400": "Building",
  "1500": "Building",
  "1600": "Building",
  "1700": "Building",
  "1800": "Building",
  "1900": "Building",
  "2000": "Building",
  "2002": "Building",
  "2100": "Building",
  "2200": "Building",
  "2300": "Building",
  "2400": "Building",
  "2500": "Building",
  "2600": "Building",
  "2700": "Building",
  "2701": "Building",
  "2800": "Building",
  "2810": "ManufacturedHousing",
  "2820": "LandParcel",
  "2823": "ManufacturedHousing",
  "2900": "Building",
  "3000": "Building",
  "3100": "Building",
  "3200": "Building",
  "3300": "Building",
  "3400": "Building",
  "3500": "Building",
  "3600": "LandParcel",
  "3700": "LandParcel",
  "3800": "LandParcel",
  "3900": "Building",
  "4000": "VacantLand",
  "4100": "LandParcel",
  "4200": "LandParcel",
  "4300": "Building",
  "4400": "Building",
  "4500": "Building",
  "4600": "LandParcel",
  "4700": "Building",
  "4800": "Building",
  "4900": "Building",
  "5000": "LandParcel",
  "5003": "LandParcel",
  "5100": "LandParcel",
  "5200": "LandParcel",
  "5201": "LandParcel",
  "5202": "LandParcel",
  "5300": "LandParcel",
  "5400": "LandParcel",
  "5500": "LandParcel",
  "5600": "LandParcel",
  "5700": "LandParcel",
  "6200": "LandParcel",
  "6300": "LandParcel",
  "6301": "LandParcel",
  "6400": "LandParcel",
  "6401": "LandParcel",
  "6500": "LandParcel",
  "6501": "LandParcel",
  "6600": "LandParcel",
  "6601": "LandParcel",
  "6602": "LandParcel",
  "6603": "LandParcel",
  "6604": "LandParcel",
  "6605": "LandParcel",
  "6606": "LandParcel",
  "6607": "LandParcel",
  "6608": "LandParcel",
  "6609": "LandParcel",
  "6610": "LandParcel",
  "6611": "LandParcel",
  "6612": "LandParcel",
  "6613": "LandParcel",
  "6614": "LandParcel",
  "6615": "LandParcel",
  "6616": "LandParcel",
  "6617": "LandParcel",
  "6618": "LandParcel",
  "6619": "LandParcel",
  "6620": "LandParcel",
  "6621": "LandParcel",
  "6622": "LandParcel",
  "6623": "LandParcel",
  "6624": "LandParcel",
  "6625": "LandParcel",
  "6626": "LandParcel",
  "6627": "LandParcel",
  "6628": "LandParcel",
  "6629": "LandParcel",
  "6630": "LandParcel",
  "6631": "LandParcel",
  "6632": "LandParcel",
  "6633": "LandParcel",
  "6634": "LandParcel",
  "6635": "LandParcel",
  "6636": "LandParcel",
  "6637": "LandParcel",
  "6638": "LandParcel",
  "6700": "LandParcel",
  "6800": "LandParcel",
  "6900": "LandParcel",
  "7000": "VacantLand",
  "7100": "Building",
  "7200": "Building",
  "7300": "Building",
  "7400": "Building",
  "7500": "Building",
  "7600": "Building",
  "7700": "Building",
  "7701": "Building",
  "7710": "Building",
  "7720": "Building",
  "7800": "Building",
  "7900": "Building",
  "8086": "VacantLand",
  "8087": "VacantLand",
  "8088": "VacantLand",
  "8089": "VacantLand",
  "8200": "LandParcel",
  "8300": "Building",
  "8400": "Building",
  "8500": "Building",
  "8600": "LandParcel",
  "8700": "LandParcel",
  "8800": "LandParcel",
  "8900": "LandParcel",
  "9000": "LandParcel",
  "9100": "LandParcel",
  "9200": "LandParcel",
  "9300": "LandParcel",
  "9400": "LandParcel",
  "9500": "LandParcel",
  "9600": "LandParcel",
  "9700": "LandParcel",
  "9800": "LandParcel",
  "9900": "LandParcel",
});

function mapLandUseToPropertyType(landUseDescription) {
  if (!landUseDescription) return null;

  const codeMatch = landUseDescription.match(/\((\d{3,4})\)/);
  if (codeMatch) {
    const code = codeMatch[1];
    if (PROPERTY_TYPE_BY_CODE[code]) return PROPERTY_TYPE_BY_CODE[code];
  }

  const desc = landUseDescription.toUpperCase();

  // Map Lake County land use codes to property types
  if (desc.includes("VACANT RESIDENTIAL")) return "VacantLand";
  if (desc.includes("SINGLE FAMILY")) return "SingleFamily";
  if (
    desc.includes("MANUFACTURED HOME SUB") ||
    desc.includes("MANUFACTURED SUB")
  )
    return "ManufacturedHousing";
  if (desc.includes("MANUFACTURED HOME") && !desc.includes("SUB"))
    return "MobileHome";
  if (desc.includes("MULTI FAMILY >9") || desc.includes("MULTI FAMILY >=10"))
    return "MultiFamilyMoreThan10";
  if (
    desc.includes("MULTI FAMILY <5") ||
    desc.includes("MULTI FAMILY >4 AND <10") ||
    desc.includes("MULTI FAMILY <=9")
  )
    return "MultiFamilyLessThan10";
  if (desc.includes("MULTI FAMILY")) return "MultipleFamily";
  if (desc.includes("CONDOMINIUM") || desc.includes("CONDO"))
    return "Condominium";
  if (desc.includes("CO-OP")) return "Cooperative";
  if (desc.includes("RETIREMENT HOME")) return "Retirement";
  if (desc.includes("MISC RESIDENTIAL") || desc.includes("MIGRANT"))
    return "MiscellaneousResidential";
  if (desc.includes("TIMESHARE")) return "Timeshare";
  if (desc.includes("TOWNHOUSE")) return "Townhouse";
  if (desc.includes("DUPLEX")) return "Duplex";
  if (desc.includes("PUD")) return "Pud";
  if (desc.includes("MOBILE HOME")) return "MobileHome";
  if (
    desc.includes("RESIDENTIAL COMMON ELEMENTS") ||
    desc.includes("COMMON ELEMENTS")
  )
    return "ResidentialCommonElementsAreas";

  // Default to null for non-residential or unrecognized codes
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
  const addressSeed = fs.existsSync("address.json")
    ? readJSON("address.json")
    : null;

  // Owner-related JSON sources
  const ownerPath = path.join("owners", "owner_data.json");
  const utilitiesPath = path.join("owners", "utilities_data.json");
  const layoutPath = path.join("owners", "layout_data.json");

  const ownerData = fs.existsSync(ownerPath) ? readJSON(ownerPath) : null;
  const utilitiesData = fs.existsSync(utilitiesPath)
    ? readJSON(utilitiesPath)
    : null;
  const layoutData = fs.existsSync(layoutPath) ? readJSON(layoutPath) : null;

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
  const ownerKey = altKey ? `property_${altKey}` : null;

  // HTML parsing
  let $ = null;
  if (cheerio) {
    $ = cheerio.load(inputHtml);
  }

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
    if (!$) return { propertyType: null, units: null };

    let landUseDescription = null;
    let units = null;

    // Extract from Land Data table
    $("#cphMain_gvLandData tr.property_row").each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 2) {
        const landUseText = $(tds[1]).text().trim();
        if (landUseText) {
          landUseDescription = landUseText.toUpperCase();
        }
      }
    });

    // Also check for units in building summary if available
    $("table.property_building_summary td").each((i, td) => {
      const text = $(td).text().trim();
      const unitMatch = text.match(/Units:\s*(\d+)/i);
      if (unitMatch) {
        units = parseInt(unitMatch[1], 10);
      }
    });

    const propertyType = mapLandUseToPropertyType(landUseDescription);

    return { propertyType, units };
  }

  // Extract Living Area, Year Built, Building/Land Values, Sales, and derive structure hints
  function extractBuildingAndValues() {
    if (!$) return {};
  const out = {
    yearBuilt: null,
    livingArea: null,
    buildingValue: null,
    landValue: null,
    landRows: [],
    assessedValue: null,
      taxableValue: null,
      marketValue: null,
      taxYear: null,
      sales: [],
      deeds: [],
      files: [],
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
    const landUseText = $(tds[1]).text().replace(/\s+/g, " ").trim();
    const frontage = parseNumber($(tds[2]).text());
    const depth = parseNumber($(tds[3]).text());
    const notes = $(tds[4]).text().replace(/\s+/g, " ").trim();
    const units = parseNumber($(tds[5]).text());
    const unitType = $(tds[6]).text().replace(/\s+/g, " ").trim();
    const classValue = parseCurrency($(tds[7]).text());
    const landValue = parseCurrency($(tds[8]).text());
    if (landValue != null) out.landValue = landValue;
    out.landRows.push({
      land_use: landUseText || null,
      frontage: Number.isFinite(frontage) ? frontage : null,
      depth: Number.isFinite(depth) ? depth : null,
      notes: notes || null,
      units: Number.isFinite(units) ? units : null,
      unit_type: unitType || null,
      class_value: classValue,
      land_value: landValue,
    });
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

    // Sales History: Book/Page, Sale Date, Instrument, Sale Price
    $("#cphMain_gvSalesHistory tr").each((i, tr) => {
      if (i === 0) return; // header
      const tds = $(tr).find("td");
      if (tds.length < 6) return;
      const bookPageLink = $(tds[0]).find("a");
      const bookPageText = bookPageLink.text().trim(); // e.g., "3072 / 319"
      const docUrl = bookPageLink.attr("href") || null;
      const saleDateRaw = $(tds[1]).text().trim(); // mm/dd/yyyy
      const instrument = $(tds[2]).text().trim();
      const salePriceRaw = $(tds[5]).text().trim();

      const sale = {
        ownership_transfer_date: toISODate(saleDateRaw),
        purchase_price_amount: parseCurrency(salePriceRaw),
      };

      out.sales.push(sale);

      const deed = { deed_type: instrument || null };
      out.deeds.push(deed);

      const fileObj = {
        document_type: /Warranty Deed/i.test(instrument)
          ? "ConveyanceDeedWarrantyDeed"
          : null,
        file_format: null,
        ipfs_url: null,
        name: bookPageText ? `Official Records ${bookPageText}` : null,
        original_url: docUrl || null,
      };
      out.files.push(fileObj);
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

    const property = {
      parcel_identifier: general.parcelNumber || propSeed.parcel_id || null,
      property_structure_built_year: bx.yearBuilt || null,
      livable_floor_area: bx.livingArea ? String(bx.livingArea) : null,
      property_legal_description_text: general.legalDescription || null,
      property_type: propertyInfo.propertyType, // Now extracted from Land Data
      number_of_units_type: getUnitsType(propertyInfo.units), // Dynamic based on extracted units
      number_of_units:
        propertyInfo.units !== undefined && propertyInfo.units !== null
          ? propertyInfo.units
          : null,
      area_under_air: null,
      property_effective_built_year: null,
      subdivision: null,
      total_area: null,
      zoning: null,
    };

    // Remove undefined properties
    Object.keys(property).forEach((k) => {
      if (property[k] === undefined) delete property[k];
    });

    return property;
  }

  // Execute extractions in proper order
  const general = extractGeneral();
  const bx = extractBuildingAndValues();

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

    const latitude =
      parseCoordinate(addressSeed?.latitude) ??
      parseCoordinate(addrSeed.latitude);
    const longitude =
      parseCoordinate(addressSeed?.longitude) ??
      parseCoordinate(addrSeed.longitude);

    return {
      street_number: street_number || null,
      street_name: street_name || null,
      street_suffix_type: street_suffix_type || null,
      street_pre_directional_text: null,
      street_post_directional_text: null,
      city_name: city_name || null,
      municipality_name: null,
      state_code: state_code || null,
      postal_code: postal_code || null,
      plus_four_postal_code: null,
      country_code: null,
      county_name: countyName || null,
      unit_identifier: null,
      latitude,
      longitude,
      route_number: null,
      township: null,
      range: null,
      section: null,
      block: null,
      lot: null,
    };
  }

  const addr = parseAddress();

  // Write address.json
  writeJSON(path.join(dataDir, "address.json"), addr);

  // property.json
  const property = buildPropertyJson();
  Object.keys(property).forEach((k) => {
    if (property[k] === undefined) delete property[k];
  });
  writeJSON(path.join(dataDir, "property.json"), property);

  // lot.json
  const landRows = Array.isArray(bx.landRows) ? bx.landRows : [];
  const primaryLandRow =
    landRows.find((row) => row && row.unit_type) || landRows[0] || null;

  const normalizeFeet = (value) => {
    if (!Number.isFinite(value) || value <= 0) return null;
    return Math.round(value);
  };

  const lotLengthFeet = primaryLandRow
    ? normalizeFeet(primaryLandRow.frontage)
    : null;
  const lotWidthFeet = primaryLandRow
    ? normalizeFeet(primaryLandRow.depth)
    : null;

  const deriveLotAreaSqft = () => {
    if (primaryLandRow && Number.isFinite(primaryLandRow.units)) {
      const units = primaryLandRow.units;
      const unitType = (primaryLandRow.unit_type || "").toLowerCase();
      if (units > 0) {
        if (unitType.includes("acre")) return Math.round(units * 43560);
        if (
          unitType.includes("sq") ||
          unitType.includes("sf") ||
          unitType.includes("square")
        )
          return Math.round(units);
      }
    }
    if (lotLengthFeet && lotWidthFeet) {
      const computed = Math.round(lotLengthFeet * lotWidthFeet);
      if (computed > 0) return computed;
    }
    return null;
  };

  const lotAreaSqft = deriveLotAreaSqft();

  const determineLotType = () => {
    if (lotAreaSqft) {
      return lotAreaSqft > 10890
        ? "GreaterThanOneQuarterAcre"
        : "LessThanOrEqualToOneQuarterAcre";
    }
    if (primaryLandRow) {
      const unitType = (primaryLandRow.unit_type || "").toLowerCase();
      if (unitType.includes("acre")) return "GreaterThanOneQuarterAcre";
      if (unitType.includes("lot")) return "LessThanOrEqualToOneQuarterAcre";
      const notes = (primaryLandRow.notes || "").toLowerCase();
      if (notes.includes("paved")) return "PavedRoad";
    }
    return null;
  };

  const lot = {
    lot_type: determineLotType(),
    lot_length_feet: lotLengthFeet,
    lot_width_feet: lotWidthFeet,
    lot_area_sqft: lotAreaSqft,
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
    const tax = {
      tax_year: bx.taxYear || null,
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
    const taxName = `tax_${tax.tax_year || "1"}.json`;
    writeJSON(path.join(dataDir, taxName), tax);
    if (tax.tax_year && fs.existsSync(path.join(dataDir, "tax_1.json"))) {
      try {
        fs.unlinkSync(path.join(dataDir, "tax_1.json"));
      } catch (e) {}
    }
  }

  // structure.json — include parsed stories and exterior wall mapping
  const structure = {
    architectural_style_type: null,
    attachment_type:
      property.property_type === "SingleFamily" ? "Detached" : null,
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary:
      bx.structure.exterior_wall_material_primary || null,
    exterior_wall_material_secondary:
      bx.structure.exterior_wall_material_secondary || null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    foundation_condition: null,
    foundation_material: null,
    foundation_type: null,
    foundation_waterproofing: null,
    gutters_condition: null,
    gutters_material: null,
    interior_door_material: null,
    interior_wall_condition: null,
    interior_wall_finish_primary: null,
    interior_wall_finish_secondary: null,
    interior_wall_structure_material: null,
    interior_wall_structure_material_primary: null,
    interior_wall_structure_material_secondary: null,
    interior_wall_surface_material_primary: null,
    interior_wall_surface_material_secondary: null,
    number_of_stories: bx.structure.number_of_stories || null,
    primary_framing_material: bx.structure.primary_framing_material || null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: null,
    roof_date: null,
    roof_design_type: null,
    roof_material_type: null,
    roof_structure_material: null,
    roof_underlayment_type: null,
    secondary_framing_material: null,
    structural_damage_indicators: null,
    subfloor_material: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_operation_type: null,
    window_screen_material: null,
  };
  writeJSON(path.join(dataDir, "structure.json"), structure);

  // utility.json from utilities_data
  if (utilitiesData && ownerKey && utilitiesData[ownerKey]) {
    writeJSON(path.join(dataDir, "utility.json"), utilitiesData[ownerKey]);
  }

  // layout_*.json from layout_data
  if (
    layoutData &&
    ownerKey &&
    layoutData[ownerKey] &&
    Array.isArray(layoutData[ownerKey].layouts)
  ) {
    const layouts = layoutData[ownerKey].layouts;
    layouts.forEach((lay, idx) => {
      const name = `layout_${idx + 1}.json`;
      writeJSON(path.join(dataDir, name), lay);
    });
  }

  // Owners: person_*.json or company_*.json
  let personFiles = [];
  if (
    ownerData &&
    ownerKey &&
    ownerData[ownerKey] &&
    ownerData[ownerKey].owners_by_date &&
    Array.isArray(ownerData[ownerKey].owners_by_date.current)
  ) {
    const owners = ownerData[ownerKey].owners_by_date.current;
    const hasCompany = owners.some((o) => o.type === "company");
    const hasPerson = owners.some((o) => o.type === "person");

    if (hasPerson && !hasCompany) {
      let personIndex = 1;
      owners.forEach((o) => {
        if (o.type !== "person") return;
        const first = properCaseName(o.first_name || null);
        const last = properCaseName(o.last_name || null);
        const middle = o.middle_name ? o.middle_name : null;
        const person = {
          birth_date: null,
          first_name: first,
          last_name: last,
          middle_name: middle,
          prefix_name: null,
          suffix_name: null,
          us_citizenship_status: null,
          veteran_status: null,
        };
        const file = `person_${personIndex}.json`;
        writeJSON(path.join(dataDir, file), person);
        personFiles.push(file);
        personIndex++;
      });
    } else if (hasCompany && !hasPerson) {
      let compIndex = 1;
      owners.forEach((o) => {
        if (o.type !== "company") return;
        const company = { name: o.name || null };
        const file = `company_${compIndex}.json`;
        writeJSON(path.join(dataDir, file), company);
        compIndex++;
      });
    }
  }

  // sales_*.json, deed_*.json, file_*.json + relationships
  const salesFiles = [];
  const deedFiles = [];
  const fileFiles = [];
  bx.sales.forEach((s, i) => {
    const sName = `sales_${i + 1}.json`;
    writeJSON(path.join(dataDir, sName), {
      ownership_transfer_date: s.ownership_transfer_date || null,
      purchase_price_amount:
        s.purchase_price_amount != null ? s.purchase_price_amount : null,
    });
    salesFiles.push(sName);
  });
  bx.deeds.forEach((d, i) => {
    const dName = `deed_${i + 1}.json`;
    writeJSON(path.join(dataDir, dName), { deed_type: d.deed_type || null });
    deedFiles.push(dName);
  });
  bx.files.forEach((f, i) => {
    const fName = `file_${i + 1}.json`;
    const obj = { ...f };
    writeJSON(path.join(dataDir, fName), obj);
    fileFiles.push(fName);
  });

  // relationship_deed_file_*.json (deed ← file)
  for (let i = 0; i < Math.min(deedFiles.length, fileFiles.length); i++) {
    const rel = {
      to: { "/": `./${deedFiles[i]}` },
      from: { "/": `./${fileFiles[i]}` },
    };
    const relName = `relationship_deed_file_${i + 1}.json`;
    writeJSON(path.join(dataDir, relName), rel);
  }

  // relationship_sales_deed_*.json (sales ← deed)
  for (let i = 0; i < Math.min(salesFiles.length, deedFiles.length); i++) {
    const rel = {
      to: { "/": `./${salesFiles[i]}` },
      from: { "/": `./${deedFiles[i]}` },
    };
    const relName = `relationship_sales_deed_${i + 1}.json`;
    writeJSON(path.join(dataDir, relName), rel);
  }

  // relationship_sales_person_*.json for current owners to most recent sale
  if (personFiles.length > 0 && salesFiles.length > 0) {
    const recentSalesFile = salesFiles[0];
    personFiles.forEach((pf, idx) => {
      const rel = {
        to: { "/": `./${pf}` },
        from: { "/": `./${recentSalesFile}` },
      };
      const relName = `relationship_sales_person_${idx + 1}.json`;
      writeJSON(path.join(dataDir, relName), rel);
    });
  }
}

main();
