// Layout mapping script
// Generates structured layout definitions with hierarchy metadata
// and writes owners/layout_data.json

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function readInputHtml() {
  const inputPath = path.join(process.cwd(), "input.html");
  return fs.readFileSync(inputPath, "utf8");
}

function textNormalize(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function toInt(text) {
  if (text == null) return null;
  const digits = String(text).match(/-?\d+/);
  if (!digits) return null;
  const num = parseInt(digits[0], 10);
  return Number.isFinite(num) ? num : null;
}

function toNumber(text) {
  if (text == null) return null;
  const clean = String(text).replace(/[^0-9.\-]/g, "");
  if (!clean) return null;
  const num = parseFloat(clean);
  return Number.isFinite(num) ? num : null;
}

const SECTION_CODE_MAP = {
  FLA: { skip: true, contributesToLivable: true },
  GAR: { space_type: "Attached Garage", is_exterior: true },
  GAF: { space_type: "Attached Garage", is_exterior: true, is_finished: true },
  GAU: { space_type: "Attached Garage", is_exterior: true, is_finished: false },
  GBF: { space_type: "Attached Garage", is_exterior: true, is_finished: true },
  GBU: { space_type: "Attached Garage", is_exterior: true, is_finished: false },
  GCF: { space_type: "Attached Garage", is_exterior: true, is_finished: true },
  GCU: { space_type: "Attached Garage", is_exterior: true, is_finished: false },
  EPA: { space_type: "Enclosed Porch", is_exterior: true },
  EPB: { space_type: "Enclosed Porch", is_exterior: true },
  EPC: { space_type: "Enclosed Porch", is_exterior: true },
  EPU: { space_type: "Enclosed Porch", is_exterior: true, is_finished: false },
  OPU: { space_type: "Porch", is_exterior: true, is_finished: false },
  OPF: { space_type: "Porch", is_exterior: true, is_finished: true },
  CAN: { space_type: "Patio", is_exterior: true },
  CPU: { space_type: "Carport", is_exterior: true, is_finished: false },
  CPF: { space_type: "Carport", is_exterior: true, is_finished: true },
  SPU: { space_type: "Enclosed Porch", is_exterior: true, is_finished: false },
  SPF: { space_type: "Enclosed Porch", is_exterior: true, is_finished: true },
  SAU: { space_type: "Storage Room", is_exterior: true, is_finished: false },
  SAF: { space_type: "Storage Room", is_exterior: true, is_finished: true },
  SBU: { space_type: "Storage Room", is_exterior: true, is_finished: false },
  SBF: { space_type: "Storage Room", is_exterior: true, is_finished: true },
  SCU: { space_type: "Storage Room", is_exterior: true, is_finished: false },
  SCF: { space_type: "Storage Room", is_exterior: true, is_finished: true },
  CBM: { skip: true, contributesToLivable: true },
  AWM: { space_type: "Enclosed Porch", is_exterior: true, is_finished: true },
  SPM: { space_type: "Enclosed Porch", is_exterior: true, is_finished: true },
  OPM: { space_type: "Porch", is_exterior: true, is_finished: true },
  PAM: { space_type: "Patio", is_exterior: true },
  CPM: { space_type: "Carport", is_exterior: true, is_finished: true },
  GUM: { space_type: "Attached Garage", is_exterior: true, is_finished: false },
  GFM: { space_type: "Attached Garage", is_exterior: true, is_finished: true },
  UTM: { space_type: "Utility Closet", is_exterior: false, is_finished: true },
};

function createBaseLayout(spaceType) {
  return {
    local_id: null,
    parent_local_id: null,
    space_type: spaceType,
    space_index: null,
    space_type_index: null,
    flooring_material_type: null,
    size_square_feet: null,
    floor_level: null,
    has_windows: null,
    window_design_type: null,
    window_material_type: null,
    window_treatment_type: null,
    is_finished: null,
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
    is_exterior: null,
    pool_condition: null,
    pool_surface_type: null,
    pool_water_quality: null,
    livable_area_sq_ft: null,
    total_area_sq_ft: null,
    building_number: null,
  };
}

function parseBuildings($) {
  const buildings = [];

  $("table.property_building_summary").each((idx, table) => {
    const info = {
      buildingNumber: idx + 1,
      bedrooms: 0,
      fullBaths: 0,
      halfBaths: 0,
      livingArea: null,
      sections: [],
    };
    $(table)
      .find("td")
      .each((_, cell) => {
        const text = textNormalize($(cell).text());
        if (/Total Living Area:/i.test(text)) {
          const val = toNumber(text);
          if (val != null) info.livingArea = val;
        } else if (/Bedrooms:/i.test(text)) {
          const val = toInt(text);
          if (val != null) info.bedrooms = val;
        } else if (/Full Bathrooms:/i.test(text)) {
          const val = toInt(text);
          if (val != null) info.fullBaths = val;
        } else if (/Half Bathrooms:/i.test(text)) {
          const val = toInt(text);
          if (val != null) info.halfBaths = val;
        }
      });
    buildings[idx] = info;
  });

  $('table[id^="cphMain_repResidential_gvBuildingSections_"]').each(
    (_, table) => {
      const id = $(table).attr("id") || "";
      const match = id.match(/_(\d+)$/);
      const index = match ? parseInt(match[1], 10) : buildings.length;
      if (!buildings[index]) {
        buildings[index] = {
          buildingNumber: index + 1,
          bedrooms: 0,
          fullBaths: 0,
          halfBaths: 0,
          livingArea: null,
          sections: [],
        };
      }
      const sections = buildings[index].sections;
      $(table)
        .find("tr")
        .each((rowIdx, row) => {
          if (rowIdx === 0) return;
          const cells = $(row).find("td");
          if (cells.length < 4) return;
          const typeText = textNormalize($(cells[0]).text());
          const extWall = textNormalize($(cells[1]).text());
          const storiesText = textNormalize($(cells[2]).text());
          const areaText = textNormalize($(cells[3]).text());
          const codeMatch = typeText.match(/\(([^)]+)\)/);
          const code = codeMatch ? codeMatch[1].trim().toUpperCase() : null;
          const description = typeText.replace(/\([^)]*\)/, "").trim();
          const area = toNumber(areaText);
          const stories = toNumber(storiesText);
          sections.push({
            code,
            description: description || null,
            extWall: extWall || null,
            stories: stories != null ? stories : null,
            area: area != null ? area : null,
          });
        });
    },
  );

  buildings.forEach((building) => {
    const totalArea = building.sections.reduce(
      (sum, section) => sum + (section.area || 0),
      0,
    );
    building.totalArea = totalArea > 0 ? totalArea : null;
    if (building.livingArea == null) {
      const livingSection = building.sections.find(
        (section) =>
          section.code &&
          (section.code === "FLA" ||
            SECTION_CODE_MAP[section.code]?.contributesToLivable),
      );
      if (livingSection && livingSection.area != null) {
        building.livingArea = livingSection.area;
      }
    }
  });

  return buildings.filter(
    (building) =>
      building.sections.length ||
      building.livingArea != null ||
      building.bedrooms ||
      building.fullBaths ||
      building.halfBaths,
  );
}

function buildLayouts(buildings) {
  const layouts = [];
  const layoutByLocalId = new Map();
  const childTypeCounters = new Map();

  const ROOT_KEY = "__root__";

  const registerLayout = (layout) => {
    if (layout.local_id) {
      layoutByLocalId.set(layout.local_id, layout);
    }
    layouts.push(layout);
    return layout;
  };

  const nextTypeIndex = (parentLayout, spaceType) => {
    const parentIndex = parentLayout ? parentLayout.space_type_index : null;
    const parentKey = parentIndex || ROOT_KEY;
    const counterKey = `${parentKey}::${spaceType}`;
    const next = (childTypeCounters.get(counterKey) || 0) + 1;
    childTypeCounters.set(counterKey, next);
    if (!parentIndex) return `${next}`;
    return `${parentIndex}.${next}`;
  };

  buildings.forEach((building) => {
    const buildingLocalId = `building_${building.buildingNumber}`;
    const buildingLayout = createBaseLayout("Building");
    buildingLayout.local_id = buildingLocalId;
    buildingLayout.space_index = building.buildingNumber;
    buildingLayout.space_type_index = nextTypeIndex(null, "Building");
    buildingLayout.total_area_sq_ft =
      building.totalArea != null ? building.totalArea : null;
    buildingLayout.size_square_feet = buildingLayout.total_area_sq_ft;
    buildingLayout.livable_area_sq_ft =
      building.livingArea != null ? building.livingArea : null;
    buildingLayout.building_number = building.buildingNumber;
    buildingLayout.is_exterior = false;
    buildingLayout.is_finished = true;
    registerLayout(buildingLayout);

    const typeCounters = new Map();

    const nextSpaceIndex = (spaceType) => {
      const next = (typeCounters.get(spaceType) || 0) + 1;
      typeCounters.set(spaceType, next);
      return next;
    };

    const pushLayout = (localId, parentLocalId, overrides) => {
      const layout = createBaseLayout(overrides.space_type);
      layout.local_id = localId;
      layout.parent_local_id = parentLocalId;
      layout.space_type = overrides.space_type;
      layout.space_index = overrides.space_index ?? null;

      const parentLayout = parentLocalId
        ? layoutByLocalId.get(parentLocalId)
        : null;

      layout.space_type_index =
        overrides.space_type_index ||
        nextTypeIndex(parentLayout, layout.space_type);

      layout.size_square_feet =
        overrides.size_square_feet != null ? overrides.size_square_feet : null;
      layout.is_exterior =
        overrides.is_exterior !== undefined ? overrides.is_exterior : null;
      layout.is_finished =
        overrides.is_finished !== undefined ? overrides.is_finished : false;
      if (overrides.livable_area_sq_ft !== undefined) {
        layout.livable_area_sq_ft = overrides.livable_area_sq_ft;
      }
      if (overrides.total_area_sq_ft !== undefined) {
        layout.total_area_sq_ft = overrides.total_area_sq_ft;
      }
      if (overrides.floor_level !== undefined) {
        layout.floor_level = overrides.floor_level;
      }

      registerLayout(layout);
      return layout;
    };

    const addRooms = (count, spaceType) => {
      for (let i = 0; i < count; i += 1) {
        const spaceIndex = nextSpaceIndex(spaceType);
        const localId = `${buildingLocalId}_${spaceType
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")}_${spaceIndex}`;
        pushLayout(localId, buildingLocalId, {
          space_type: spaceType,
          space_index: spaceIndex,
          is_exterior: false,
          is_finished: true,
        });
      }
    };

    addRooms(building.bedrooms, "Bedroom");
    addRooms(building.fullBaths, "Full Bathroom");
    addRooms(building.halfBaths, "Half Bathroom / Powder Room");

    building.sections.forEach((section) => {
      const code = (section.code || "").toUpperCase();
      const mapping =
        SECTION_CODE_MAP[code] || SECTION_CODE_MAP[code.replace(/[^A-Z]/g, "")];
      if (mapping && mapping.skip) return;
      if (!mapping) return;
      const spaceType = mapping.space_type;
      const spaceIndex = nextSpaceIndex(spaceType);
      const localId = `${buildingLocalId}_${(code || "section")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")}_${spaceIndex}`;
      const isFinished =
        mapping.is_finished !== undefined
          ? mapping.is_finished
          : code.endsWith("F")
          ? true
          : code.endsWith("U")
          ? false
          : false;
      const isExterior =
        mapping.is_exterior !== undefined ? mapping.is_exterior : true;
      pushLayout(localId, buildingLocalId, {
        space_type: spaceType,
        space_index: spaceIndex,
        size_square_feet: section.area != null ? section.area : null,
        is_exterior: isExterior,
        is_finished: isFinished,
      });
    });
  });

  return layouts;
}

function main() {
  const html = readInputHtml();
  const $ = cheerio.load(html);

  const altKeyCell = $('td.property_field:contains("Alternate Key:")').first();
  const altKey =
    textNormalize(altKeyCell.next("td.property_item").text()) || null;
  const propKey = altKey ? `property_${altKey}` : "property_unknown";

  const buildings = parseBuildings($);
  const layouts = buildLayouts(buildings);

  const payload = {};
  payload[propKey] = { layouts };

  const outDir = path.join(process.cwd(), "owners");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "layout_data.json");
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");

  console.log(
    `Wrote ${outPath} for ${propKey} with ${layouts.length} layout entries`,
  );
}

try {
  main();
} catch (err) {
  console.error("Error in layoutMapping:", err.message);
  process.exit(1);
}
