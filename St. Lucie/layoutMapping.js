// Layout Mapping Script
// Reads input.html, parses with cheerio, and outputs owners/layout_data.json per schema

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

function extractLayouts($) {
  const layouts = [];
  const interiorTableSelector =
    "#building-info .interior-container table.container";

  const bedroomCountText = getTextFromTableByLabel(
    $,
    interiorTableSelector,
    "Bedrooms",
  );
  const fullBathCountText = getTextFromTableByLabel(
    $,
    interiorTableSelector,
    "Full Baths",
  );
  const halfBathCountText = getTextFromTableByLabel(
    $,
    interiorTableSelector,
    "Half Baths",
  );

  const bedrooms = parseInt(bedroomCountText || "0", 10) || 0;
  const fullBaths = parseInt(fullBathCountText || "0", 10) || 0;
  const halfBaths = parseInt(halfBathCountText || "0", 10) || 0;

  let idx = 1;

  for (let i = 0; i < bedrooms; i++) {
    layouts.push({
      space_type: "Bedroom",
      space_index: idx++,
      flooring_material_type: null,
      size_square_feet: null,
      floor_level: null,
      has_windows: null,
      window_design_type: null,
      window_material_type: null,
      window_treatment_type: null,
      is_finished: false,
      furnished: null,
      paint_condition: null,
      flooring_wear: null,
      clutter_level: null,
      visible_damage: null,
      countertop_material: null,
      cabinet_style: null,
      fixture_finish_quality: null,
      design_style: null,
      natural_light_quality: null,
      decor_elements: null,
      pool_type: null,
      pool_equipment: null,
      spa_type: null,
      safety_features: null,
      view_type: null,
      lighting_features: null,
      condition_issues: null,
      is_exterior: false,
      pool_condition: null,
      pool_surface_type: null,
      pool_water_quality: null,
    });
  }

  for (let i = 0; i < fullBaths; i++) {
    layouts.push({
      space_type: "Full Bathroom",
      space_index: idx++,
      flooring_material_type: null,
      size_square_feet: null,
      floor_level: null,
      has_windows: null,
      window_design_type: null,
      window_material_type: null,
      window_treatment_type: null,
      is_finished: false,
      furnished: null,
      paint_condition: null,
      flooring_wear: null,
      clutter_level: null,
      visible_damage: null,
      countertop_material: null,
      cabinet_style: null,
      fixture_finish_quality: null,
      design_style: null,
      natural_light_quality: null,
      decor_elements: null,
      pool_type: null,
      pool_equipment: null,
      spa_type: null,
      safety_features: null,
      view_type: null,
      lighting_features: null,
      condition_issues: null,
      is_exterior: false,
      pool_condition: null,
      pool_surface_type: null,
      pool_water_quality: null,
    });
  }

  for (let i = 0; i < halfBaths; i++) {
    layouts.push({
      space_type: "Half Bathroom / Powder Room",
      space_index: idx++,
      flooring_material_type: null,
      size_square_feet: null,
      floor_level: null,
      has_windows: null,
      window_design_type: null,
      window_material_type: null,
      window_treatment_type: null,
      is_finished: false,
      furnished: null,
      paint_condition: null,
      flooring_wear: null,
      clutter_level: null,
      visible_damage: null,
      countertop_material: null,
      cabinet_style: null,
      fixture_finish_quality: null,
      design_style: null,
      natural_light_quality: null,
      decor_elements: null,
      pool_type: null,
      pool_equipment: null,
      spa_type: null,
      safety_features: null,
      view_type: null,
      lighting_features: null,
      condition_issues: null,
      is_exterior: false,
      pool_condition: null,
      pool_surface_type: null,
      pool_water_quality: null,
    });
  }

  return layouts;
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const $ = loadHtml(inputPath);
  const parcelId = getParcelId($);
  const layouts = extractLayouts($);

  const outputDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const output = {};
  output[`property_${parcelId}`] = { layouts };

  const outPath = path.join(outputDir, "layout_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote layout data for property_${parcelId} to ${outPath}`);
}

if (require.main === module) {
  main();
}
