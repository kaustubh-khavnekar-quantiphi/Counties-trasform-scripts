// Structure Mapping Script
// Reads input.html, parses with cheerio, and outputs owners/structure_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function loadHtml(filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  return cheerio.load(html);
}

function getParcelId($) {
  // Find Parcel ID within Property Identification section
  const table = $("#property-identification table.container").first();
  let parcelId = null;
  table.find("tr").each((i, el) => {
    const th = cheerio.load(el)("th").first().text().trim();
    if (/Parcel ID/i.test(th)) {
      const td = cheerio.load(el)("td").first();
      const bold = td.find("b");
      parcelId = (bold.text() || td.text() || "").trim();
    }
  });
  return parcelId || "unknown";
}

function getTextFromTableByLabel($, containerSelector, label) {
  const container = $(containerSelector).first();
  let found = null;
  container.find("tr").each((i, el) => {
    const row = cheerio.load(el);
    const th = row("th").first().text().trim();
    if (th.toLowerCase().includes(label.toLowerCase())) {
      const val = row("td").first().text().trim();
      found = val || null;
    }
  });
  return found;
}

function mapExteriorWallMaterial(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("brick")) return "Brick";
  if (t.includes("stucco")) return "Stucco";
  if (t.includes("vinyl")) return "Vinyl Siding";
  if (t.includes("wood")) return "Wood Siding";
  if (t.includes("fiber cement") || t.includes("hardie"))
    return "Fiber Cement Siding";
  if (t.includes("metal")) return "Metal Siding";
  if (t.includes("block") || t.includes("cbs") || t.includes("concrete block"))
    return "Concrete Block";
  if (t.includes("stone")) return "Natural Stone";
  if (t.includes("eifs")) return "EIFS";
  if (t.includes("log")) return "Log";
  if (t.includes("adobe")) return "Adobe";
  if (t.includes("precast")) return "Precast Concrete";
  if (t.includes("curtain")) return "Curtain Wall";
  return null;
}

function mapRoofCover(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("3-tab")) return "3-Tab Asphalt Shingle";
  if (t.includes("architectural") || t.includes("dimensional"))
    return "Architectural Asphalt Shingle";
  if (t.includes("standing seam")) return "Metal Standing Seam";
  if (t.includes("metal")) return "Metal Corrugated";
  if (t.includes("clay")) return "Clay Tile";
  if (t.includes("concrete tile")) return "Concrete Tile";
  if (t.includes("slate")) return "Natural Slate";
  if (t.includes("synthetic slate")) return "Synthetic Slate";
  if (t.includes("shake")) return "Wood Shake";
  if (t.includes("shingle")) return "Wood Shingle";
  if (t.includes("tpo")) return "TPO Membrane";
  if (t.includes("epdm")) return "EPDM Membrane";
  if (t.includes("modified")) return "Modified Bitumen";
  if (t.includes("built-up") || t.includes("bur")) return "Built-Up Roof";
  if (t.includes("green roof")) return "Green Roof System";
  if (t.includes("solar tiles")) return "Solar Integrated Tiles";
  return null;
}

function mapRoofStructure(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("truss") && t.includes("wood")) return "Wood Truss";
  if (t.includes("truss") && t.includes("steel")) return "Steel Truss";
  if (t.includes("rafter")) return "Wood Rafter";
  if (t.includes("concrete")) return "Concrete Beam";
  if (t.includes("engineered")) return "Engineered Lumber";
  return null;
}

function extractStructure($) {
  // From Building Information -> Exterior and Interior tables
  const exteriorTableSelector =
    "#building-info .exterior-container table.container";
  const interiorTableSelector =
    "#building-info .interior-container table.container";

  const primaryWallRaw = getTextFromTableByLabel(
    $,
    exteriorTableSelector,
    "Primary Wall",
  );
  const secondaryWallRaw = getTextFromTableByLabel(
    $,
    exteriorTableSelector,
    "Secondary Wall",
  );
  const roofCoverRaw = getTextFromTableByLabel(
    $,
    exteriorTableSelector,
    "Roof Cover",
  );
  const roofStructRaw = getTextFromTableByLabel(
    $,
    exteriorTableSelector,
    "Roof Structure",
  );

  const structure = {
    architectural_style_type: null,
    attachment_type: null,
    ceiling_condition: null,
    ceiling_height_average: null,
    ceiling_insulation_type: null,
    ceiling_structure_material: null,
    ceiling_surface_material: null,
    exterior_door_installation_date: null,
    exterior_door_material: null,
    exterior_wall_condition: null,
    exterior_wall_condition_primary: null,
    exterior_wall_condition_secondary: null,
    exterior_wall_insulation_type: null,
    exterior_wall_insulation_type_primary: null,
    exterior_wall_insulation_type_secondary: null,
    exterior_wall_material_primary: mapExteriorWallMaterial(primaryWallRaw),
    exterior_wall_material_secondary: null,
    finished_base_area: null,
    finished_basement_area: null,
    finished_upper_story_area: null,
    flooring_condition: null,
    flooring_material_primary: null,
    flooring_material_secondary: null,
    foundation_condition: null,
    foundation_material: null,
    foundation_repair_date: null,
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
    number_of_buildings: null,
    number_of_stories: null,
    primary_framing_material: null,
    roof_age_years: null,
    roof_condition: null,
    roof_covering_material: mapRoofCover(roofCoverRaw),
    roof_date: null,
    roof_design_type: null,
    roof_material_type: null,
    roof_structure_material: mapRoofStructure(roofStructRaw),
    roof_underlayment_type: null,
    secondary_framing_material: null,
    siding_installation_date: null,
    structural_damage_indicators: null,
    subfloor_material: null,
    unfinished_base_area: null,
    unfinished_basement_area: null,
    unfinished_upper_story_area: null,
    window_frame_material: null,
    window_glazing_type: null,
    window_installation_date: null,
    window_operation_type: null,
    window_screen_material: null,
  };

  // number_of_buildings from '(1 of 1)'
  const seqText = $("#building-info .building-sequence").first().text().trim();
  const matchSeq = seqText.match(/\((\d+) of (\d+)\)/i);
  if (matchSeq) {
    structure.number_of_buildings = parseInt(matchSeq[2], 10) || null;
  }

  // Secondary wall mapping if text present
  structure.exterior_wall_material_secondary =
    mapExteriorWallMaterial(secondaryWallRaw);

  return structure;
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const $ = loadHtml(inputPath);
  const parcelId = getParcelId($);
  const structure = extractStructure($);

  const outputDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const output = {};
  output[`property_${parcelId}`] = structure;

  const outPath = path.join(outputDir, "structure_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote structure data for property_${parcelId} to ${outPath}`);
}

if (require.main === module) {
  main();
}
