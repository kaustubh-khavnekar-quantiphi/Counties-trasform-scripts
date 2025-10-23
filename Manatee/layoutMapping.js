// Layout mapping script
// Reads input.json and writes owners/layout_data.json with layouts array per schema

const fs = require("fs");
const path = require("path");
let cheerio;
try {
  cheerio = require("cheerio");
} catch (e) {
  cheerio = null;
}

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
  }
}

function safeParse(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw || !raw.trim()) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function extractParcelId(input) {
  // Try Owners HTML first
  try {
    const html = input?.OwnersAndGeneralInformation?.response || "";
    if (cheerio && html) {
      const $ = cheerio.load(html);
      const text = $.text();
      const m = text.match(/\b(\d{9,12})\b/);
      if (m) return m[1];
      const ta = $("textarea").first().text().trim();
      if (/^\d{9,12}$/.test(ta)) return ta;
    }
  } catch {}
  try {
    const qs = input?.Sales?.source_http_request?.multiValueQueryString?.parid;
    if (Array.isArray(qs) && qs[0]) return String(qs[0]);
  } catch {}
  const err = {
      type: "error",
      message: "Parcel ID not found",
      path: "",
    };
  throw Object.assign(new Error(JSON.stringify(err)), { _structured: err });
}

function toInt(val) {
  const n = parseInt(String(val).replace(/[,\s]/g, "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function sumFromBuildings(input) {
  const rows = input?.Buildings?.response?.rows || [];
  let underRoof = 0;
  let livBus = 0;
  let any = false;
  for (const r of rows) {
    if (!Array.isArray(r)) continue;
    const u = toInt(r[6]);
    const l = toInt(r[7]);
    if (u != null) {
      underRoof += u;
      any = true;
    }
    if (l != null) {
      livBus += l;
      any = true;
    }
  }
  return any ? { underRoof, livBus } : { underRoof: null, livBus: null };
}

function buildLayouts(input) {
  // const ownersHtml = input?.OwnersAndGeneralInformation?.response || "";
  // let totalLivable = null;
  // let totalUnderRoof = null;
  // if (cheerio && ownersHtml) {
  //   const $ = cheerio.load(ownersHtml);
  //   const text = $.text();
  //   const m = text.match(
  //     /(\d[\d,]*)\s*SqFt Under Roof\s*\/\s*(\d[\d,]*)\s*SqFt Living/i,
  //   );
  //   if (m) {
  //     totalUnderRoof = toInt(m[1]);
  //     totalLivable = toInt(m[2]);
  //   }
  // }
  // if (totalLivable == null || totalUnderRoof == null) {
  //   const s = sumFromBuildings(input);
  //   totalUnderRoof = totalUnderRoof ?? s.underRoof;
  //   totalLivable = totalLivable ?? s.livBus;
  // }

  // Pool present? From features rows with COMMERCIAL POOL
  // const features = input?.Features?.response?.rows || [];
  // const hasPool = features.some(
  //   (r) =>
  //     Array.isArray(r) &&
  //     String(r[3] || "")
  //       .toUpperCase()
  //       .includes("COMMERCIAL POOL"),
  // );

  const layouts = [];
  // let idx = 1;
  // layouts.push({
  //   space_type: "Living Area",
  //   space_index: idx++,
  //   flooring_material_type: null,
  //   size_square_feet: totalLivable,
  //   floor_level: null,
  //   has_windows: null,
  //   window_design_type: null,
  //   window_material_type: null,
  //   window_treatment_type: null,
  //   is_finished: true,
  //   furnished: null,
  //   paint_condition: null,
  //   flooring_wear: null,
  //   clutter_level: null,
  //   visible_damage: null,
  //   countertop_material: null,
  //   cabinet_style: null,
  //   fixture_finish_quality: null,
  //   design_style: null,
  //   natural_light_quality: null,
  //   decor_elements: null,
  //   pool_type: hasPool ? "BuiltIn" : null,
  //   pool_equipment: hasPool ? "Standard" : null,
  //   spa_type: null,
  //   safety_features: null,
  //   view_type: null,
  //   lighting_features: null,
  //   condition_issues: null,
  //   is_exterior: false,
  //   pool_condition: hasPool ? "Unknown" : null,
  //   pool_surface_type: hasPool ? "Unknown" : null,
  //   pool_water_quality: hasPool ? "Unknown" : null,
  //   adjustable_area_sq_ft: null,
  //   area_under_air_sq_ft: totalLivable,
  //   bathroom_renovation_date: null,
  //   building_number: null,
  //   kitchen_renovation_date: null,
  //   heated_area_sq_ft: totalLivable,
  //   installation_date: null,
  //   livable_area_sq_ft: totalLivable,
  //   pool_installation_date: null,
  //   spa_installation_date: null,
  //   story_type: null,
  //   total_area_sq_ft: totalUnderRoof,
  // });

  return layouts;
}

(function main() {
  const inputPath = path.join(process.cwd(), "input.json");
  const input = safeParse(inputPath);
  const parcelId = extractParcelId(input);  
  let parcel = readJSON("parcel.json");
  if (!parcel) {
    parcel = readJSON("property_seed.json");
  }
  if (parcel.request_identifier != parcelId.replaceAll("-","")) {
    throw {
      type: "error",
      message: `Request identifier and parcel id don't match.`,
      path: "property.request_identifier",
    };
  }
  const layouts = buildLayouts(input);
  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  const payload = {};
  payload[`property_${parcelId}`] = { layouts };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
})();
