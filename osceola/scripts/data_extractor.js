#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

function readJson(p) {
  try {
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function cleanText(str) {
  if (str == null) return null;
  try {
    const $ = cheerio.load(String(str));
    return $.text().trim() || null;
  } catch (e) {
    return String(str);
  }
}

function ensureDirSync(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function toDateOnly(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function trimStr(val) {
  return typeof val === "string" ? val.trim() : val;
}

function numOrNull(n) {
  return n === null || n === undefined || Number.isNaN(Number(n))
    ? null
    : Number(n);
}

function writeJSON(p, obj) {
  ensureDirSync(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function extractAddress(parcelInfo, unnorm) {
  let hasOwnerMailingAddress = false;
  let inputCounty = (unnorm.county_jurisdiction || "").trim();
  if (!inputCounty) {
    inputCounty = (unnorm.county_name || "").trim();
  }
  const county_name = inputCounty || null;
  const mailingAddress = parcelInfo["Mailing"];
  const siteAddress = parcelInfo["Situs"];
  if (mailingAddress) {
    const mailingAddressObj = {
      latitude: null,
      longitude: null,
      unnormalized_address: mailingAddress,
    };
    writeJSON(path.join("data", "mailing_address.json"), mailingAddressObj);
    hasOwnerMailingAddress = true;
  }
  if (siteAddress) {
    const latitude = parcelInfo["lat"] ? parcelInfo["lat"] : (unnorm && unnorm.latitude ? unnorm.latitude : null);
    const longitude = parcelInfo["lon"] ? parcelInfo["lon"] : (unnorm && unnorm.longitude ? unnorm.longitude : null);
    const addressObj = {
      county_name,
      latitude: latitude,
      longitude: longitude,
      unnormalized_address: siteAddress,
    };
    writeJSON(path.join("data", "address.json"), addressObj);
    writeJSON(path.join("data", "relationship_property_has_address.json"), {
                to: { "/": `./address.json` },
                from: { "/": `./property.json` },
              });
  }
  return hasOwnerMailingAddress;
}

function mapPropertyType(dorDesc, nbcDesc) {
  const d = (dorDesc || "").toUpperCase();
  const n = (nbcDesc || "").toUpperCase();
  if (d.includes("MULTI-FAMILY") && (d.includes("10") || d.includes("50"))) {
    return "MultiFamilyMoreThan10";
  }
  if (n.includes("APARTMENTS")) return "Apartment";
  // If still unknown, throw per instruction
  throw {
    type: "error",
    message: `Unknown enum value ${dorDesc || nbcDesc}.`,
    path: "property.property_type",
  };
}

function mapUsageType(jurisdesc) {
  const j = (jurisdesc || "").toUpperCase();
  if (j.includes("COMMERCIAL")) return "Commercial";
  return null;
}

function mapDeedType(trns_cd, trans_dscr) {
  const code = (trns_cd || "").toUpperCase();
  const dscr = (trans_dscr || "").toUpperCase();
  // Check more specific strings first to avoid substring collisions
  if (code === "SW" || dscr.includes("SPECIAL WARRANTY DEED"))
    return "Special Warranty Deed";
  if (
    code === "WD" ||
    (dscr.includes("WARRANTY DEED") && !dscr.includes("SPECIAL WARRANTY DEED"))
  )
    return "Warranty Deed";
  if (code === "QC" || dscr.includes("QUIT CLAIM DEED"))
    return "Quitclaim Deed";
  if (
    code === "CD" ||
    dscr.includes("CORRECTIVE DEED") ||
    dscr.includes("CORRECTION DEED")
  )
    return "Correction Deed";
  return "Miscellaneous";
}

function mapExteriorWallAndFraming(structRows) {
  // Defaults
  let exteriorWall = null;
  let primaryFrame = null;
  for (const r of structRows) {
    const tp = (r.tp_dscr || "").toUpperCase();
    const cd = (r.cd_dscr || "").toUpperCase();
    if (tp === "EXTERIOR WALL") {
      if (cd.includes("CONCRETE BLOCK STUCCO")) {
        exteriorWall = exteriorWall || "Stucco"; // cladding
        primaryFrame = primaryFrame || "Concrete Block";
      } else if (cd.includes("FRAME STUCCO")) {
        exteriorWall = exteriorWall || "Stucco";
        primaryFrame = primaryFrame || "Wood Frame";
      } else if (cd.includes("CONCRETE BLOCK")) {
        // If mentioned without stucco
        primaryFrame = primaryFrame || "Concrete Block";
      } else if (cd.includes("STUCCO")) {
        exteriorWall = exteriorWall || "Stucco";
      }
    }
  }
  return { exteriorWall, primaryFrame };
}
let people = [];
let companies = [];

function findPersonIndexByName(first, last) {
  const tf = titleCaseName(first);
  const tl = titleCaseName(last);
  for (let i = 0; i < people.length; i++) {
    if (people[i].first_name === tf && people[i].last_name === tl)
      return i + 1;
  }
  return null;
}

function findCompanyIndexByName(name) {
  const tn = (name || "").trim().toUpperCase();
  for (let i = 0; i < companies.length; i++) {
    if ((companies[i].name || "").trim() === tn) return i + 1;
  }
  return null;
}

function titleCaseName(s) {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function writePersonCompaniesSalesRelationships(record, sales, hasOwnerMailingAddress) {
  if (!record || !record.owners_by_date) return;
  const ownersByDate = record.owners_by_date;
  const personMap = new Map();
  Object.values(ownersByDate).forEach((arr) => {
    (arr || []).forEach((o) => {
      if (o.type === "person") {
        const k = `${(o.first_name || "").trim().toUpperCase()}|${(o.last_name || "").trim().toUpperCase()}`;
        if (!personMap.has(k))
          personMap.set(k, {
            first_name: o.first_name,
            middle_name: o.middle_name,
            last_name: o.last_name,
          });
        else {
          const existing = personMap.get(k);
          if (!existing.middle_name && o.middle_name)
            existing.middle_name = o.middle_name;
        }
      }
    });
  });
  people = Array.from(personMap.values()).map((p) => ({
    first_name: p.first_name ? titleCaseName(p.first_name) : null,
    middle_name: p.middle_name ? titleCaseName(p.middle_name) : null,
    last_name: p.last_name ? titleCaseName(p.last_name) : null,
    birth_date: null,
    prefix_name: null,
    suffix_name: null,
    us_citizenship_status: null,
    veteran_status: null,
    request_identifier: parcelId,
  }));
  people.forEach((p, idx) => {
    writeJSON(path.join("data", `person_${idx + 1}.json`), p);
  });
  const companyNames = new Set();
  Object.values(ownersByDate).forEach((arr) => {
    (arr || []).forEach((o) => {
      if (o.type === "company" && (o.name || "").trim())
        companyNames.add((o.name || "").trim().toUpperCase());
    });
  });
  companies = Array.from(companyNames).map((n) => ({ 
    name: n,
  }));
  companies.forEach((c, idx) => {
    writeJSON(path.join("data", `company_${idx + 1}.json`), c);
  });
  // Relationships: link sale to owners present on that date (both persons and companies)
  let relPersonCounter = 0;
  let relCompanyCounter = 0;
  sales.forEach((rec, idx) => {
    const d = toDateOnly(rec.dos);
    const ownersOnDate = ownersByDate[d] || [];
    ownersOnDate
      .filter((o) => o.type === "person")
      .forEach((o) => {
        const pIdx = findPersonIndexByName(o.first_name, o.last_name);
        if (pIdx) {
          relPersonCounter++;
          writeJSON(
            path.join(
              "data",
              `relationship_sales_person_${relPersonCounter}.json`,
            ),
            {
              to: { "/": `./person_${pIdx}.json` },
              from: { "/": `./sales_${idx + 1}.json` },
            },
          );
        }
      });
    ownersOnDate
      .filter((o) => o.type === "company")
      .forEach((o) => {
        const cIdx = findCompanyIndexByName(o.name);
        if (cIdx) {
          relCompanyCounter++;
          writeJSON(
            path.join(
              "data",
              `relationship_sales_company_${relCompanyCounter}.json`,
            ),
            {
              to: { "/": `./company_${cIdx}.json` },
              from: { "/": `./sales_${idx + 1}.json` },
            },
          );
        }
      });
  });
  if (hasOwnerMailingAddress) {
    const currentOwner = ownersByDate["current"] || [];
    relPersonCounter = 0;
    relCompanyCounter = 0;
    currentOwner
    .filter((o) => o.type === "person")
    .forEach((o) => {
      const pIdx = findPersonIndexByName(o.first_name, o.last_name);
      if (pIdx) {
        relPersonCounter++;
        writeJSON(
          path.join(
            "data",
            `relationship_person_has_mailing_address_${relPersonCounter}.json`,
          ),
          {
            from: { "/": `./person_${pIdx}.json` },
            to: { "/": `./mailing_address.json` },
          },
        );
      }
    });
    currentOwner
    .filter((o) => o.type === "company")
    .forEach((o) => {
      const cIdx = findCompanyIndexByName(o.name);
      if (cIdx) {
        relCompanyCounter++;
        writeJSON(
          path.join(
            "data",
            `relationship_company_has_mailing_address_${relCompanyCounter}.json`,
          ),
          {
            from: { "/": `./company_${cIdx}.json` },
            to: { "/": `./mailing_address.json` },
          },
        );
      }
    });
  }
}

function main() {
  const dataDir = path.join("data");
  ensureDirSync(dataDir);

  // Read inputs
  const inputPath = "input.json";
  const addressPath = "address.json";
  const unnormalizedPath = "unnormalized_address.json"
  const parcelPath = "parcel.json";
  const ownersDir = "owners";
  const ownerDataPath = path.join(ownersDir, "owner_data.json");
  const utilitiesDataPath = path.join(ownersDir, "utilities_data.json");
  const layoutDataPath = path.join(ownersDir, "layout_data.json");
  const structureDataPath = path.join(ownersDir, "structure_data.json");

  const input = readJson(inputPath);
  let address = readJson(addressPath);
  if (!address) {
    address = readJson(unnormalizedPath);
  }
  if (!address) {
    throw new Error("Address file not found");
  }
  const parcel = readJson(parcelPath);
  const ownerData = readJson(ownerDataPath);
  const utilitiesData = readJson(utilitiesDataPath);
  const structureData = readJson(structureDataPath);
  const layoutData = readJson(layoutDataPath);
  const parcelInfo = input.ParcelInformation || {};
  const pResp =
      (parcelInfo.response &&
        parcelInfo.response.value &&
        parcelInfo.response.value[0]) ||
      null;
  const strap = cleanText(pResp.dsp_strap) || cleanText(pResp.strap) || "unknown";
  const key = `property_${strap.trim()}`;
  let struct = null;
  if (structureData) {
    struct = key && structureData[key] ? structureData[key] : null;
  }
  let util = null;
  if (utilitiesData) {
    util = key && utilitiesData[key] ? utilitiesData[key] : null;
  }

  const isMulti = Object.values(input || {}).some(
    (v) =>
      v &&
      typeof v === "object" &&
      "source_http_request" in v &&
      "response" in v,
  );
  let ownerHasMailingAddress = false;
  // Property from ParcelInformation
  try {
    const pReq = parcelInfo.source_http_request || null;
    const pResp =
      (parcelInfo.response &&
        parcelInfo.response.value &&
        parcelInfo.response.value[0]) ||
      null;
    if (pResp) {
      ownerHasMailingAddress = extractAddress(pResp, address);
      const strap = trimStr(
        pResp.strap ||
          pResp.Strap ||
          (parcel && parcel.parcel_identifier) ||
          "",
      );
      const dorDesc = pResp.dorDesc || pResp.prevDorDscr || "";
      const nbcDesc = pResp.NBCDesc || "";
      let property_type;
      try {
        property_type = mapPropertyType(dorDesc, nbcDesc);
      } catch (e) {
        // Re-throw for visibility since property_type is required
        throw e;
      }
      const out = {
        source_http_request: isMulti ? pReq : undefined,
        parcel_identifier: strap,
        property_legal_description_text: pResp.Legals || null,
        property_type,
        property_usage_type: mapUsageType(pResp.jurisdesc) || null,
        subdivision: pResp.subName || null,
        property_structure_built_year: pResp.ayb ?? null,
        property_effective_built_year: pResp.eyb ?? null,
        area_under_air:
          pResp.HeatedArea != null ? String(pResp.HeatedArea) : null,
        livable_floor_area: null,
        total_area:
          pResp.grossBldArea != null ? String(pResp.grossBldArea) : null,
        number_of_units: pResp.livunits ?? null,
        number_of_units_type: null,
        ownership_estate_type: null,
        structure_form: null,
        zoning: null,
        build_status: null,
        historic_designation: null,
      };
      // Clean undefined to satisfy additionalProperties false
      Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
      fs.writeFileSync(
        path.join(dataDir, "property.json"),
        JSON.stringify(out, null, 2),
      );
    }
  } catch (err) {
    // If enum mapping fails, output the error as JSON to stdout and stop
    if (err && err.type === "error") {
      console.error(JSON.stringify(err, null, 2));
      process.exit(1);
    } else {
      throw err;
    }
  }

  // Lot from Land
  const land = input.Land || {};
  const landReq = land.source_http_request || null;
  const landRow =
    land.response && land.response.value && land.response.value[0];
  if (
    landRow ||
    (input.ParcelInformation && input.ParcelInformation.response)
  ) {
    let acres = null;
    const pResp = input.ParcelInformation?.response?.value?.[0] || {};
    if (typeof pResp.totalAcres === "number") acres = pResp.totalAcres;
    let lot_area_sqft = null;
    if (acres != null) lot_area_sqft = Math.round(acres * 43560);
    const lotOut = {
      source_http_request: isMulti ? landReq : undefined,
      lot_type: null,
      lot_length_feet: null,
      lot_width_feet: null,
      lot_area_sqft: lot_area_sqft,
      landscaping_features: null,
      view: null,
      fencing_type: null,
      fence_height: null,
      fence_length: null,
      driveway_material: null,
      driveway_condition: null,
      lot_condition_issues: null,
      lot_size_acre: acres ?? null,
      paving_type: null,
      paving_installation_date: null,
      paving_area_sqft: null,
      site_lighting_fixture_count: null,
      site_lighting_installation_date: null,
      site_lighting_type: null,
    };
    Object.keys(lotOut).forEach(
      (k) => lotOut[k] === undefined && delete lotOut[k],
    );
    fs.writeFileSync(
      path.join(dataDir, "lot.json"),
      JSON.stringify(lotOut, null, 2),
    );
  }

  // Tax from ValuesAndTax
  const valuesAndTax = input.ValuesAndTax || {};
  const taxReq = valuesAndTax.source_http_request || null;
  const taxRows = (valuesAndTax.response && valuesAndTax.response.value) || [];
  let taxIndex = 1;
  for (const row of taxRows) {
    const taxOut = {
      source_http_request: isMulti ? taxReq : undefined,
      tax_year: row.tax_yr ?? null,
      property_assessed_value_amount: numOrNull(row.asd_val),
      property_market_value_amount: numOrNull(row.jst_val),
      property_building_amount: numOrNull(row.tot_bld_val),
      property_land_amount: numOrNull(row.tot_lnd_val),
      property_taxable_value_amount: numOrNull(row.tax_val),
      monthly_tax_amount: null,
      period_start_date: null,
      period_end_date: null,
      yearly_tax_amount: null,
      first_year_on_tax_roll: null,
      first_year_building_on_tax_roll: null,
    };
    Object.keys(taxOut).forEach(
      (k) => taxOut[k] === undefined && delete taxOut[k],
    );
    fs.writeFileSync(
      path.join(dataDir, `tax_${taxIndex}.json`),
      JSON.stringify(taxOut, null, 2),
    );
    taxIndex++;
  }

  // Sales from SalesHistory
  const sales = input.SalesHistory || {};
  const salesReq = sales.source_http_request || null;
  const salesRows = (sales.response && sales.response.value) || [];
  let saleIdx = 1;
  for (const row of salesRows) {
    const dateOnly = toDateOnly(row.dos);
    const saleOut = {
      source_http_request: isMulti ? salesReq : undefined,
      ownership_transfer_date: dateOnly,
    };
    // Include price only if > 0 to satisfy currency format
    if (row.price && Number(row.price) > 0) {
      saleOut.purchase_price_amount = Number(row.price);
    }
    Object.keys(saleOut).forEach(
      (k) => saleOut[k] === undefined && delete saleOut[k],
    );
    const salePath = path.join(dataDir, `sales_${saleIdx}.json`);
    fs.writeFileSync(salePath, JSON.stringify(saleOut, null, 2));
    saleIdx++;
  }

  // Deeds mapped from sales rows, and relationships use row index to avoid mismatches
  let deedIdx = 1;
  for (let i = 0; i < salesRows.length; i++) {
    const row = salesRows[i];
    const deedType = mapDeedType(row.trns_cd, row.trans_dscr);
    const deedOut = {
      source_http_request: isMulti ? salesReq : undefined,
      deed_type: deedType,
    };
    if (row.or_bk) {
      deedOut.book = row.or_bk;
    }
    if (row.or_pg) {
      deedOut.page = row.or_pg;
    }
    const deedPath = path.join(dataDir, `deed_${deedIdx}.json`);
    fs.writeFileSync(deedPath, JSON.stringify(deedOut, null, 2));

    // Relationship sales -> deed using the sale row index
    const saleFile = `./sales_${i + 1}.json`;
    const rel = {
      from: { "/": saleFile },
      to: { "/": `./deed_${deedIdx}.json` },
    };
    fs.writeFileSync(
      path.join(dataDir, `relationship_sales_deed_${deedIdx}.json`),
      JSON.stringify(rel, null, 2),
    );
    if (deedOut.book && deedOut.page) {
      const fileUrl = `https://officialrecords.osceolaclerk.org/browserviewpa/viewer.aspx?book=${deedOut.book}&page=${deedOut.page}&booktype=O`;
      const fileOut = {
        document_type: "Title",
        file_format: null,
        ipfs_url: null,
        name: `Deed ${deedOut.book}/${deedOut.page}`,
        original_url: fileUrl,
      };
      const filePath = path.join(dataDir, `file_${deedIdx}.json`);
      fs.writeFileSync(filePath, JSON.stringify(fileOut, null, 2));
      const relDeedFile = {
        to: { "/": `./file_${deedIdx}.json` },
        from: { "/": `./deed_${deedIdx}.json` },
      };
      fs.writeFileSync(
        path.join(dataDir, `relationship_deed_file_${deedIdx}.json`),
        JSON.stringify(relDeedFile, null, 2),
      );
    }
    deedIdx++;
  }
  // Owners: create company files and relationships to sales
  if (ownerData) {
    const ownersPayload = ownerData[key];
    writePersonCompaniesSalesRelationships(ownersPayload, salesRows, ownerHasMailingAddress);
  }
  if (layoutData) {
    const lset =
      key && layoutData[key] && Array.isArray(layoutData[key].layouts)
        ? layoutData[key].layouts
        : [];
    let layoutBuildingMap = {};
    let idx = 1;
    for (const l of lset) {
      const layoutOut = {
        space_type: l.space_type ?? null,
        space_type_index: l.space_type_index ?? null,
        flooring_material_type: l.flooring_material_type ?? null,
        size_square_feet: l.size_square_feet ?? null,
        has_windows: l.has_windows ?? null,
        window_design_type: l.window_design_type ?? null,
        window_material_type: l.window_material_type ?? null,
        window_treatment_type: l.window_treatment_type ?? null,
        is_finished: l.is_finished ?? null,
        furnished: l.furnished ?? null,
        paint_condition: l.paint_condition ?? null,
        flooring_wear: l.flooring_wear ?? null,
        clutter_level: l.clutter_level ?? null,
        visible_damage: l.visible_damage ?? null,
        countertop_material: l.countertop_material ?? null,
        cabinet_style: l.cabinet_style ?? null,
        fixture_finish_quality: l.fixture_finish_quality ?? null,
        design_style: l.design_style ?? null,
        natural_light_quality: l.natural_light_quality ?? null,
        decor_elements: l.decor_elements ?? null,
        pool_type: l.pool_type ?? null,
        pool_equipment: l.pool_equipment ?? null,
        spa_type: l.spa_type ?? null,
        safety_features: l.safety_features ?? null,
        view_type: l.view_type ?? null,
        lighting_features: l.lighting_features ?? null,
        condition_issues: l.condition_issues ?? null,
        is_exterior: l.is_exterior ?? false,
        pool_condition: l.pool_condition ?? null,
        pool_surface_type: l.pool_surface_type ?? null,
        pool_water_quality: l.pool_water_quality ?? null,

        adjustable_area_sq_ft: l.adjustable_area_sq_ft ?? null,
        area_under_air_sq_ft: l.area_under_air_sq_ft ?? null,
        bathroom_renovation_date: l.bathroom_renovation_date ?? null,
        building_number: l.building_number ?? null,
        kitchen_renovation_date: l.kitchen_renovation_date ?? null,
        heated_area_sq_ft: l.heated_area_sq_ft ?? null,
        installation_date: l.installation_date ?? null,
        livable_area_sq_ft: l.livable_area_sq_ft ?? null,
        pool_installation_date: l.pool_installation_date ?? null,
        spa_installation_date: l.spa_installation_date ?? null,
        story_type: l.story_type ?? null,
        total_area_sq_ft: l.total_area_sq_ft ?? null,
      };
      writeJSON(path.join("data", `layout_${idx}.json`), layoutOut);
      if (l.space_type === "Building") {
        const building_number = l.building_number;
        layoutBuildingMap[building_number.toString()] = idx;
      }
      if (l.space_type !== "Building") {
        const building_number = l.building_number;
        if (building_number) {
          const building_layout_number = layoutBuildingMap[building_number.toString()];
          writeJSON(path.join("data", `relationship_layout_${building_layout_number}_to_layout_${idx}.json`), {
            to: { "/": `./layout_${idx}.json` },
            from: { "/": `./layout_${building_layout_number}.json` },
          },);
        }
      }
      if (util && l.space_type === "Building") {
        if (l.building_number && l.building_number.toString() in util) {
          writeJSON(path.join("data", `utility_${idx}.json`), util[l.building_number.toString()]);
          writeJSON(path.join("data", `relationship_layout_to_utility_${idx}.json`), {
                    to: { "/": `./utility_${idx}.json` },
                    from: { "/": `./layout_${idx}.json` },
          },);
        }
      }
      if (struct && l.space_type === "Building") {
        if (l.building_number && l.building_number.toString() in struct) {
          writeJSON(path.join("data", `structure_${idx}.json`), struct[l.building_number.toString()]);
          writeJSON(path.join("data", `relationship_layout_to_structure_${idx}.json`), {
                    to: { "/": `./structure_${idx}.json` },
                    from: { "/": `./layout_${idx}.json` },
          },);
        }
      }
      idx++;
    }
  }
}

if (require.main === module) {
  try {
    main();
    console.log("Extraction complete.");
  } catch (e) {
    if (e && e.type === "error") {
      writeJSON(path.join("data", "error.json"), e);
      console.error("Extraction error:", e);
      process.exit(1);
    } else {
      console.error("Unexpected error:", e);
      process.exit(1);
    }
  }
}
