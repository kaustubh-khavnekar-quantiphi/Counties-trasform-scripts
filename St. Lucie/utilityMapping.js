// Utility Mapping Script
// Reads input.html, parses with cheerio, and outputs owners/utilities_data.json per schema

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function loadHtml(filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  return cheerio.load(html);
}

function getParcelId($) {
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

function mapCooling(acPercentText) {
  if (!acPercentText) return null;
  const pct = parseFloat(acPercentText.replace(/[^0-9.]/g, ""));
  if (isNaN(pct) || pct === 0) return null;
  // No specific system indicated; default to CentralAir if cooled
  return "CentralAir";
}

function mapHeatingType(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("heat pump")) return "HeatPump";
  if (t.includes("gas")) return "GasFurnace";
  if (t.includes("electric") && t.includes("furnace")) return "ElectricFurnace";
  if (t.includes("electric")) return "Electric";
  if (t.includes("radiant")) return "Radiant";
  if (t.includes("baseboard")) return "Baseboard";
  if (t.includes("central")) return "Central";
  return null;
}

function mapHeatingFuel(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes("natural")) return "NaturalGas";
  if (t.includes("propane") || t.includes("lp")) return "Propane";
  if (t.includes("oil")) return "Oil";
  if (t.includes("kerosene")) return "Kerosene";
  if (t.includes("wood pellet")) return "WoodPellet";
  if (t.includes("wood")) return "Wood";
  if (t.includes("electric")) return "Electric";
  if (t.includes("geothermal")) return "Geothermal";
  if (t.includes("solar")) return "Solar";
  return null;
}

function extractUtility($) {
  const interiorTableSelector =
    "#building-info .interior-container table.container";
  const acPct = getTextFromTableByLabel($, interiorTableSelector, "A/C %");
  const heatTypeRaw = getTextFromTableByLabel(
    $,
    interiorTableSelector,
    "Heat Type",
  );
  const heatFuelRaw = getTextFromTableByLabel(
    $,
    interiorTableSelector,
    "Heat Fuel",
  );
  const electricRaw = getTextFromTableByLabel(
    $,
    interiorTableSelector,
    "Electric",
  );

  const utilities = {
    cooling_system_type: mapCooling(acPct),
    electrical_panel_capacity: null,
    electrical_panel_installation_date: null,
    electrical_rewire_date: null,
    electrical_wiring_type: electricRaw ? null : null,
    electrical_wiring_type_other_description: null,
    heating_fuel_type: mapHeatingFuel(heatFuelRaw),
    heating_system_type: mapHeatingType(heatTypeRaw),
    hvac_capacity_kw: null,
    hvac_capacity_tons: null,
    hvac_condensing_unit_present: null,
    hvac_equipment_component: null,
    hvac_equipment_manufacturer: null,
    hvac_equipment_model: null,
    hvac_installation_date: null,
    hvac_seer_rating: null,
    hvac_system_configuration: null,
    hvac_unit_condition: null,
    hvac_unit_issues: null,
    plumbing_fixture_count: null,
    plumbing_fixture_quality: null,
    plumbing_fixture_type_primary: null,
    plumbing_system_installation_date: null,
    plumbing_system_type: null,
    plumbing_system_type_other_description: null,
    public_utility_type: null,
    sewer_connection_date: null,
    sewer_type: null,
    smart_home_features: null,
    smart_home_features_other_description: null,
    solar_installation_date: null,
    solar_inverter_installation_date: null,
    solar_inverter_manufacturer: null,
    solar_inverter_model: null,
    solar_inverter_visible: false,
    solar_panel_present: false,
    solar_panel_type: null,
    solar_panel_type_other_description: null,
    water_connection_date: null,
    water_heater_installation_date: null,
    water_heater_manufacturer: null,
    water_heater_model: null,
    water_source_type: null,
    well_installation_date: null,
  };

  return utilities;
}

function main() {
  const inputPath = path.join(process.cwd(), "input.html");
  const $ = loadHtml(inputPath);
  const parcelId = getParcelId($);
  const utilities = extractUtility($);

  const outputDir = path.join(process.cwd(), "owners");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const output = {};
  output[`property_${parcelId}`] = utilities;

  const outPath = path.join(outputDir, "utilities_data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
  console.log(`Wrote utilities data for property_${parcelId} to ${outPath}`);
}

if (require.main === module) {
  main();
}
