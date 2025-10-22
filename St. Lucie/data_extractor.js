#!/usr/bin/env node
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const cheerio = require("cheerio");

async function readJson(p) {
  const s = await fsp.readFile(p, "utf8");
  return JSON.parse(s);
}

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function textClean(s) {
  return (s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCurrencyToNumber(str) {
  if (str == null) return null;
  const s = String(str).replace(/[^0-9.\-]/g, "");
  if (!s) return null;
  const n = Number(s);
  if (!isFinite(n)) return null;
  return n;
}

function parseDateToISO(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function detectMultiRequest(inputObj) {
  if (!inputObj || typeof inputObj !== "object") return false;
  const keys = Object.keys(inputObj);
  if (keys.length === 0) return false;
  return keys.some(
    (k) =>
      inputObj[k] &&
      typeof inputObj[k] === "object" &&
      inputObj[k].source_http_request &&
      inputObj[k].response,
  );
}

function getFileFormatFromUrl(u) {
  if (!u) return null;
  const m = u.toLowerCase().match(/\.([a-z0-9]+)(?:\?.*)?$/);
  if (!m) return null;
  const ext = m[1];
  if (ext === "jpg" || ext === "jpeg") return "jpeg";
  if (ext === "png") return "png";
  return null; // pdf or other => null per schema enum
}

async function removeExisting(pattern) {
  try {
    const files = await fsp.readdir("data");
    const targets = files.filter((f) => pattern.test(f));
    await Promise.all(
      targets.map((f) => fsp.unlink(path.join("data", f)).catch(() => {})),
    );
  } catch {}
}

const propertyTypeMapping = [
  {
    "st_lucie_property_type": "0000 - Vac Residential",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "0004 - Vac Res-Cond",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "0005 - Vac Res Coop",
    "ownership_estate_type": "Cooperative",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "0100 - Single Family",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "SingleFamily"
  },
  {
    "st_lucie_property_type": "0101 - SingleFam TH (Townhouse)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "TownhouseRowhouse",
    "property_usage_type": "Residential",
    "property_type": "Townhouse"
  },
  {
    "st_lucie_property_type": "0105 - SingFam-Coop",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "SingleFamilyDetached",
    "property_usage_type": "Residential",
    "property_type": "Cooperative"
  },
  {
    "st_lucie_property_type": "0200 - Mobile Homes",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MobileHome",
    "property_usage_type": "Residential",
    "property_type": "MobileHome"
  },
  {
    "st_lucie_property_type": "0205 - MobHome-Coop",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ManufacturedHomeInPark",
    "property_usage_type": "Residential",
    "property_type": "Cooperative"
  },
  {
    "st_lucie_property_type": "0300 - M-F >= 10U (Multi-Family >= 10 Units)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamily5Plus",
    "property_usage_type": "Residential",
    "property_type": "MultiFamilyMoreThan10"
  },
  {
    "st_lucie_property_type": "0400 - Condo",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Condominium"
  },
  {
    "st_lucie_property_type": "0425 - Time Share",
    "ownership_estate_type": "Timeshare",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "Timeshare"
  },
  {
    "st_lucie_property_type": "0500 - Cooperatives",
    "ownership_estate_type": "Cooperative",
    "build_status": "Improved",
    "structure_form": "ApartmentUnit",
    "property_usage_type": "Residential",
    "property_type": "Cooperative"
  },
  {
    "st_lucie_property_type": "0700 - Misc Res (Miscellaneous Residential)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Residential",
    "property_type": "MiscellaneousResidential"
  },
  {
    "st_lucie_property_type": "0800 - M-F < 10U (Multi-Family < 10 Units)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": "MultiFamilyLessThan10",
    "property_usage_type": "Residential",
    "property_type": "MultiFamilyLessThan10"
  },
  {
    "st_lucie_property_type": "0900 - ResCommonElemnt (Residential Common Element)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ResidentialCommonElementsAreas",
    "property_type": "ResidentialCommonElementsAreas"
  },
  {
    "st_lucie_property_type": "1000 - Vac Comm (Vacant Commercial)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "1004 - Vac Com Cond (Vacant Commercial Condominium)",
    "ownership_estate_type": "Condominium",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "1009 - Vac Comm (Vacant Commercial - duplicate entry, possibly a typo or specific sub-category)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "1100 - STOR-1STR (Store - 1 Story)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "1104 - Store Condo",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RetailStore",
    "property_type": "Unit"
  },
  {
    "st_lucie_property_type": "1200 - MX-STR OFCE (Mixed Store/Office)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "1300 - DEPT STORE (Department Store)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "1304 - DeptSt_Condo (Department Store Condominium)",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "DepartmentStore",
    "property_type": "Unit"
  },
  {
    "st_lucie_property_type": "1400 - SUPMARKET (Supermarket)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Supermarket",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "1600 - COM SHOP CNT (Community Shopping Center)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ShoppingCenterCommunity",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "1700 - OFCE BLDG (Office Building)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "1704 - OFFICE CONDO",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Unit"
  },
  {
    "st_lucie_property_type": "1800 - OFCE BLDG (Office Building - duplicate entry, possibly a typo or specific sub-category)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "1900 - PROF SERV (Professional Services)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OfficeBuilding",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "1904 - MED CONDO (Medical Condominium)",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MedicalOffice",
    "property_type": "Unit"
  },
  {
    "st_lucie_property_type": "2000 - AIRPT/MARINA (Airport/Marina)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransportationTerminal",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "2100 - REST CAF (Restaurant/Cafe)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "2104 - REST CONDO (Restaurant Condominium)",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Unit"
  },
  {
    "st_lucie_property_type": "2200 - DRV IN REST (Drive-In Restaurant)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "2204 - DRV IN Condo (Drive-In Condominium)",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Restaurant",
    "property_type": "Unit"
  },
  {
    "st_lucie_property_type": "2300 - FIN INST (Financial Institution)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "FinancialInstitution",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "2500 - RPR SRVC SHO (Repair Service Shop)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "2502 - Dry Cleaner/Laundromat",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Commercial",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "2600 - SRVC STAT (Service Station)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ServiceStation",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "2603 - Car Wash",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "2700 - AUTO SALS (Auto Sales)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "AutoSalesRepair",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "2800 - PRKG/MOBILE (Parking/Mobile)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MobileHomePark",
    "property_type": "LandParcel"
  },
  {
    "st_lucie_property_type": "3000 - FLRT GRNHSE (Florist/Greenhouse)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "3200 - ENC THETHRS (Enclosed Theaters)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Theater",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "3300 - NgtClub Bars (Nightclub/Bars)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "3400 - BWLNG ALYS (Bowling Alleys)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "3500 - TRST ATRCT (Tourist Attraction)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Entertainment",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "3800 - GLF CRSES (Golf Courses)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GolfCourse",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "3900 - HTLS MTLS (Hotels/Motels)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "3904 - Hotel-Condo",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Hotel",
    "property_type": "Unit"
  },
  {
    "st_lucie_property_type": "4000 - VCNT INDUS (Vacant Industrial)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Industrial",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "4100 - LGHT MNFCT (Light Manufacturing)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "4200 - HVY INDSTRL (Heavy Industrial)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HeavyManufacturing",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "4300 - LMBR YRD (Lumber Yard)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LumberYard",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "4400 - PCKNG PLNTS (Packing Plants)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PackingPlant",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "4500 - CANRIS FRT (Canneries/Fruit)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Cannery",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "4600 - OTHR FOOD (Other Food Processing)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "LightManufacturing",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "4700 - MNRAL (Mineral)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "4800 - WRHSNG DIST (Warehousing/Distribution)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "4804 - INDUS CONDO (Industrial Condominium)",
    "ownership_estate_type": "Condominium",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Unit"
  },
  {
    "st_lucie_property_type": "4820 - INDMINIWHS (Industrial Mini-Warehouse)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Warehouse",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "4900 - OPN STRGE (Open Storage)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "OpenStorage",
    "property_type": "LandParcel"
  },
  {
    "st_lucie_property_type": "5100 - CRPLD SL CAP (Cropland Soil Capability)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "DrylandCropland",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "5400 - TMBL STE (Timberland)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TimberLand",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "6000 - GRZNG SLD CP (Grazing Soil Capability)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GrazingLand",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "6600 - ORCHRD GRV (Orchard/Grove)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "OrchardGroves",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "6700 - MISC AG TYPES (Miscellaneous Agricultural Types)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Agricultural",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "6900 - NURSERY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NurseryGreenhouse",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "7000 - VAC INST (Vacant Institutional)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "7100 - CHRCHS (Churches)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Church",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "7200 - PRVTE SCHLS (Private Schools)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateSchool",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "7300 - PRVTE HOSP (Private Hospitals)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PrivateHospital",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "7400 - HMS AGED (Homes for the Aged)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "7500 - Orph/Non Prf (Orphanage/Non-Profit)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "NonProfitCharity",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "7502 - Rehab Living Facility",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "HomesForAged",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "7600 - MRTURIES (Mortuaries)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MortuaryCemetery",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "7700 - CLUBS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "7704 - HOA Clubhous (Homeowners Association Clubhouse)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ClubsLodges",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "7900 - CLTRAL ORGA (Cultural Organization)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "8000 - VAC GOVT (Vacant Government)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "8100 - MILITARY",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Military",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "8200 - FRST PRKS (Forest/Parks)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "ForestParkRecreation",
    "property_type": "LandParcel"
  },
  {
    "st_lucie_property_type": "8300 - PBL CTY SCH (Public City School)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicSchool",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "8400 - COLLEGES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "CulturalOrganization",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "8500 - HOSPITAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "PublicHospital",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "8600 - COUNTIES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "8700 - STATE",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "8800 - FEDERAL",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "8900 - Mncpal Prop (Municipal Property)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "GovernmentProperty",
    "property_type": "Building"
  },
  {
    "st_lucie_property_type": "9000 - LSHLD INTER (Leasehold Interest)",
    "ownership_estate_type": "Leasehold",
    "build_status": null,
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "LandParcel"
  },
  {
    "st_lucie_property_type": "9100 - UTLTY (Utility)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "st_lucie_property_type": "9200 - MINING LANDS",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "MineralProcessing",
    "property_type": "LandParcel"
  },
  {
    "st_lucie_property_type": "9300 - SBSRFCE RGHT (Subsurface Rights)",
    "ownership_estate_type": "SubsurfaceRights",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "9400 - R/W ST RDS,DITCH,IRRIGTN (Right-of-Way, State Roads, Ditch, Irrigation)",
    "ownership_estate_type": "RightOfWay",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "Unknown",
    "property_type": "VacantLand"
  },
  {
    "st_lucie_property_type": "9500 - RVRS, LKS,SUBMRGED (Rivers, Lakes, Submerged)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "RiversLakes",
    "property_type": "LandParcel"
  },
  {
    "st_lucie_property_type": "9600 - WASTELANDS,MARSH,DUNES",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "LandParcel"
  },
  {
    "st_lucie_property_type": "9700 - OTDR RCRTNL (Outdoor Recreational)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Recreational",
    "property_type": "LandParcel"
  },
  {
    "st_lucie_property_type": "9800 - CNTRLY ASSED (Centrally Assessed)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "Improved",
    "structure_form": null,
    "property_usage_type": "Utility",
    "property_type": "LandParcel"
  },
  {
    "st_lucie_property_type": "9900 - Non-Ag ACRG (Non-Agricultural Acreage)",
    "ownership_estate_type": "FeeSimple",
    "build_status": "VacantLand",
    "structure_form": null,
    "property_usage_type": "TransitionalProperty",
    "property_type": "VacantLand"
  }
];

function mapPropertyType(stLuciePropertyType) {
  // Extract only the number part from the st_lucie_property_type string
  const codeMatch = stLuciePropertyType ? stLuciePropertyType.match(/^(\d{4})/) : null;
  const code = codeMatch ? codeMatch[1] : null;

  if (!code) return {}; // Return empty object if no code found

  // Find mapping by matching the extracted code with the start of the mapping's st_lucie_property_type
  const mapping = propertyTypeMapping.find(
    (item) => item.st_lucie_property_type.startsWith(code)
  );
  return mapping || {};
}

async function main() {
  ensureDirSync("data");

  const inputHtmlRaw = await fsp.readFile("input.html", "utf8");

  let inputAsJson = null;
  try {
    inputAsJson = JSON.parse(inputHtmlRaw);
  } catch {}
  const isMulti = detectMultiRequest(inputAsJson);

  // Initialize cheerio here, before any potential usage
  const $ = isMulti ? null : cheerio.load(inputHtmlRaw);

  const addressPath = "address.json";
  const parcelPath = "parcel.json";
  const ownersDir = "owners";
  const ownerDataPath = path.join(ownersDir, "owner_data.json");
  const utilitiesDataPath = path.join(ownersDir, "utilities_data.json");
  const layoutDataPath = path.join(ownersDir, "layout_data.json");
  const unnormalizedAddressPath = "unnormalized_address.json";


  const addressData = await readJson(addressPath).catch(() => null);
  const parcelData = await readJson(parcelPath).catch(() => null);
  const ownerData = await readJson(ownerDataPath).catch(() => null);
  const utilitiesData = await readJson(utilitiesDataPath).catch(() => null);
  const layoutData = await readJson(layoutDataPath).catch(() => null);
  const unnormalizedAddressData = await readJson(unnormalizedAddressPath).catch(() => null);


  // Address extraction
  let siteAddress = null;
  if (!isMulti) {
    $("article#property-identification table.container tr").each((i, tr) => {
      const th = textClean($(tr).find("th").text());
      if (/Site Address/i.test(th)) {
        siteAddress = textClean($(tr).find("td").text());
      }
    });
  }

  if (addressData) {
    const outAddr = {
      source_http_request: addressData.source_http_request || null,
      request_identifier: addressData.request_identifier || null,
      county_name: addressData.county_name || null,
      latitude: addressData.latitude ?? null,
      longitude: addressData.longitude ?? null,
      unnormalized_address: null,
    };

    // Prioritize siteAddress from HTML, then unnormalized_address.json
    if (siteAddress && siteAddress.toLowerCase() !== "tbd") {
      outAddr.unnormalized_address = siteAddress;
    } else if (unnormalizedAddressData && unnormalizedAddressData.full_address) {
      outAddr.unnormalized_address = unnormalizedAddressData.full_address;
    } else {
      outAddr.unnormalized_address = addressData.unnormalized_address || null;
    }

    await fsp.writeFile(
      path.join("data", "address.json"),
      JSON.stringify(outAddr, null, 2),
    );
  }

  // Extract both parcel formats: normalized (parcel.json) and dashed (from HTML)
  let parcelIdentifierNormalized =
    parcelData && parcelData.parcel_identifier
      ? parcelData.parcel_identifier
      : null;
  let parcelIdentifierDashed = null;
  if (!isMulti) {
    $("article#property-identification table.container tr").each((i, tr) => {
      const th = textClean($(tr).find("th").text());
      if (/Parcel ID/i.test(th)) {
        parcelIdentifierDashed = textClean($(tr).find("td").text());
      }
    });
  }

  // Property extraction
  let propertyOut = null;
  if (!isMulti) {
    // Legal description
    let legalDescription = null;
    const legalSectionDiv = $("article#property-identification .section-title")
      .filter((i, el) => /Legal Description/i.test(textClean($(el).text())))
      .first();
    if (legalSectionDiv && legalSectionDiv.length) {
      const p = legalSectionDiv.next(".bottom-text").find("p").first();
      legalDescription = textClean(p.text());
    }

    // Zoning
    let zoningVal = null;
    $("article#property-identification table.container tr").each((i, tr) => {
      const th = textClean($(tr).find("th").text());
      if (/Zoning/i.test(th)) zoningVal = textClean($(tr).find("td").text());
    });

    // Land Use Code
    let landUseCodeText = null;
    $("article#property-identification table.container tr").each((i, tr) => {
      const th = textClean($(tr).find("th").text());
      if (/Land Use Code/i.test(th))
        landUseCodeText = textClean($(tr).find("td").text());
    });

    // Building Type from HTML (This is not directly used in the mapping, but kept for completeness if needed elsewhere)
    let buildingType = null;
    $("article#building-info table.container tr").each((i, tr) => {
      const th = textClean($(tr).find("th").text());
      if (/Building Type/i.test(th)) {
        buildingType = textClean($(tr).find("td").text());
      }
    });

    const mappedPropertyDetails = mapPropertyType(landUseCodeText);

    // Number of Units
    let numberOfUnits = null;
    $("article#building-info table.container tr").each((i, tr) => {
      const th = textClean($(tr).find("th").text());
      if (/Number of Units/i.test(th)) {
        const v = textClean($(tr).find("td").text());
        const n = parseInt(v.replace(/[^0-9\-]/g, ""), 10);
        if (!isNaN(n)) numberOfUnits = n;
      }
    });

    // Areas from Total Areas table
    let landAcres = null;
    let landSqft = null;
    $(
      "article#property-identification .area-container table.container tr",
    ).each((i, tr) => {
      const th = textClean($(tr).find("th").text());
      const td = textClean($(tr).find("td").text());
      if (/Land Size \(acres\)/i.test(th)) landAcres = td || null;
      if (/Land Size \(SF\)/i.test(th)) landSqft = td || null;
    });

    propertyOut = {
      parcel_identifier:
        parcelIdentifierNormalized || parcelIdentifierDashed || null,
      property_legal_description_text: legalDescription || null,
      property_type: mappedPropertyDetails.property_type || "LandParcel", // Default if not found
      property_usage_type: mappedPropertyDetails.property_usage_type || null,
      zoning: zoningVal || null,
      number_of_units: typeof numberOfUnits === "number" ? numberOfUnits : null,
      build_status: mappedPropertyDetails.build_status || "VacantLand",
      area_under_air: null,
      livable_floor_area: null,
      total_area: null,
      subdivision: null,
      structure_form: mappedPropertyDetails.structure_form || null,
      ownership_estate_type: mappedPropertyDetails.ownership_estate_type || null,
      property_structure_built_year: null,
      property_effective_built_year: null,
      historic_designation: false,
    };

    await fsp.writeFile(
      path.join("data", "property.json"),
      JSON.stringify(propertyOut, null, 2),
    );

    // Lot data
    const lotOut = {
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
      lot_size_acre: null,
    };
    if (landAcres) {
      const n = Number(String(landAcres).replace(/[^0-9.\-]/g, ""));
      if (isFinite(n)) lotOut.lot_size_acre = n;
    }
    if (landSqft) {
      const n = Number(String(landSqft).replace(/[^0-9.\-]/g, ""));
      if (isFinite(n)) lotOut.lot_area_sqft = Math.round(n);
    }
    await fsp.writeFile(
      path.join("data", "lot.json"),
      JSON.stringify(lotOut, null, 2),
    );
  }

  // Sales extraction
  const sales = [];
  if (!isMulti) {
    $("article#sale-info table.table tbody tr").each((i, tr) => {
      const tds = $(tr).find("th, td");
      if (!tds || tds.length < 6) return;
      const dateTxt = textClean($(tds[0]).text());
      const deedCode = textClean($(tds[3]).text());
      const priceTxt = textClean($(tds[5]).text());
      const iso = parseDateToISO(dateTxt);
      if (!iso) return;
      const priceNum = parseCurrencyToNumber(priceTxt);
      const sale = { ownership_transfer_date: iso };
      if (priceNum && priceNum > 0) sale.purchase_price_amount = priceNum;
      sale._deed_code = deedCode || null;
      sales.push(sale);
    });
    for (let i = 0; i < sales.length; i++) {
      const out = { ownership_transfer_date: sales[i].ownership_transfer_date };
      if (sales[i].purchase_price_amount != null)
        out.purchase_price_amount = sales[i].purchase_price_amount;
      await fsp.writeFile(
        path.join("data", `sales_${i + 1}.json`),
        JSON.stringify(out, null, 2),
      );
    }
  }

  // Tax extraction: clear old and create one file per year option present
  await removeExisting(/^tax_.*\.json$/);
  if (!isMulti) {
    const years = [];
    $("article#property-values select option").each((i, opt) => {
      const yr = parseInt(textClean($(opt).text()), 10);
      if (!isNaN(yr)) years.push(yr);
    });

    let buildingVal = null,
      landVal = null,
      justVal = null,
      assessedVal = null,
      taxableVal = null;
    $("article#property-values table.container tr").each((i, tr) => {
      const th = textClean($(tr).find("th").text());
      const td = textClean($(tr).find("td").text());
      const amt = parseCurrencyToNumber(td);
      if (/^Building$/i.test(th)) buildingVal = amt;
      if (/^Land$/i.test(th)) landVal = amt;
      if (/^Just\/Market$/i.test(th)) justVal = amt;
      if (/^Assessed$/i.test(th)) assessedVal = amt;
      if (/^Taxable$/i.test(th)) taxableVal = amt;
    });

    for (const yr of years) {
      const taxOut = {
        tax_year: yr,
        property_assessed_value_amount:
          assessedVal && assessedVal > 0 ? assessedVal : null,
        property_market_value_amount: justVal && justVal > 0 ? justVal : null,
        property_building_amount:
          buildingVal && buildingVal > 0 ? buildingVal : null,
        property_land_amount: landVal && landVal > 0 ? landVal : null,
        property_taxable_value_amount:
          taxableVal && taxableVal > 0 ? taxableVal : null,
        monthly_tax_amount: null,
        period_end_date: null,
        period_start_date: null,
        first_year_building_on_tax_roll: null,
        first_year_on_tax_roll: null,
        yearly_tax_amount: null,
      };
      await fsp.writeFile(
        path.join("data", `tax_${yr}.json`),
        JSON.stringify(taxOut, null, 2),
      );
    }
  }

  // Utilities from owners/utilities_data.json (use best available key)
  let ownerKey = null;
  if (propertyOut) {
    const k1 = `property_${propertyOut.parcel_identifier}`;
    const k2 = parcelIdentifierDashed
      ? `property_${parcelIdentifierDashed}`
      : null;
    if (utilitiesData) {
      if (utilitiesData[k1]) ownerKey = k1;
      else if (k2 && utilitiesData[k2]) ownerKey = k2;
    }
  }
  if (ownerKey && utilitiesData[ownerKey]) {
    const util = utilitiesData[ownerKey];
    const utilityOut = {
      cooling_system_type: util.cooling_system_type ?? null,
      heating_system_type: util.heating_system_type ?? null,
      public_utility_type: util.public_utility_type ?? null,
      sewer_type: util.sewer_type ?? null,
      water_source_type: util.water_source_type ?? null,
      plumbing_system_type: util.plumbing_system_type ?? null,
      plumbing_system_type_other_description:
        util.plumbing_system_type_other_description ?? null,
      electrical_panel_capacity: util.electrical_panel_capacity ?? null,
      electrical_wiring_type: util.electrical_wiring_type ?? null,
      hvac_condensing_unit_present: util.hvac_condensing_unit_present ?? null,
      electrical_wiring_type_other_description:
        util.electrical_wiring_type_other_description ?? null,
      solar_panel_present: util.solar_panel_present === true,
      solar_panel_type: util.solar_panel_type ?? null,
      solar_panel_type_other_description:
        util.solar_panel_type_other_description ?? null,
      smart_home_features: util.smart_home_features ?? null,
      smart_home_features_other_description:
        util.smart_home_features_other_description ?? null,
      hvac_unit_condition: util.hvac_unit_condition ?? null,
      solar_inverter_visible: util.solar_inverter_visible === true,
      hvac_unit_issues: util.hvac_unit_issues ?? null,
      electrical_panel_installation_date:
        util.electrical_panel_installation_date ?? null,
      electrical_rewire_date: util.electrical_rewire_date ?? null,
      hvac_equipment_component: util.hvac_equipment_component ?? null,
      hvac_equipment_manufacturer: util.hvac_equipment_manufacturer ?? null,
      hvac_equipment_model: util.hvac_equipment_model ?? null,
      hvac_installation_date: util.hvac_installation_date ?? null,
      hvac_capacity_kw: util.hvac_capacity_kw ?? null,
      hvac_capacity_tons: util.hvac_capacity_tons ?? null,
      hvac_system_configuration: util.hvac_system_configuration ?? null,
      hvac_seer_rating: util.hvac_seer_rating ?? null,
      plumbing_fixture_count: util.plumbing_fixture_count ?? null,
      plumbing_fixture_quality: util.plumbing_fixture_quality ?? null,
      plumbing_fixture_type_primary: util.plumbing_fixture_type_primary ?? null,
      plumbing_system_installation_date:
        util.plumbing_system_installation_date ?? null,
      sewer_connection_date: util.sewer_connection_date ?? null,
      solar_installation_date: util.solar_installation_date ?? null,
      solar_inverter_installation_date:
        util.solar_inverter_installation_date ?? null,
      solar_inverter_manufacturer: util.solar_inverter_manufacturer ?? null,
      solar_inverter_model: util.solar_inverter_model ?? null,
      water_connection_date: util.water_connection_date ?? null,
      water_heater_installation_date:
        util.water_heater_installation_date ?? null,
      water_heater_manufacturer: util.water_heater_manufacturer ?? null,
      water_heater_model: util.water_heater_model ?? null,
      well_installation_date: util.well_installation_date ?? null,
    };
    await fsp.writeFile(
      path.join("data", "utility.json"),
      JSON.stringify(utilityOut, null, 2),
    );
  }

  // Layouts from owners/layout_data.json
  if (layoutData && propertyOut) {
    let layoutKey = null;
    const k1 = `property_${propertyOut.parcel_identifier}`;
    const k2 = parcelIdentifierDashed
      ? `property_${parcelIdentifierDashed}`
      : null;
    if (layoutData[k1]) layoutKey = k1;
    else if (k2 && layoutData[k2]) layoutKey = k2;
    if (layoutKey) {
      const layoutsWrap = layoutData[layoutKey];
      if (layoutsWrap && Array.isArray(layoutsWrap.layouts)) {
        await removeExisting(/^layout_.*\.json$/);
        for (let i = 0; i < layoutsWrap.layouts.length; i++) {
          const lay = layoutsWrap.layouts[i];
          await fsp.writeFile(
            path.join("data", `layout_${i + 1}.json`),
            JSON.stringify(lay, null, 2),
          );
        }
      }
    }
  }

  // Structure minimal skeleton
  if (!isMulti) {
    let numberOfBuildings = null;
    const seqText = textClean(
      $("article#building-info .building-sequence").text(),
    );
    const m = seqText.match(/\((\d+) of (\d+)\)/i);
    if (m) {
      const total = parseInt(m[2], 10);
      if (!isNaN(total)) numberOfBuildings = total;
    }

    const structureOut = {
      architectural_style_type: null,
      attachment_type: null,
      exterior_wall_material_primary: null,
      exterior_wall_material_secondary: null,
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
      primary_framing_material: null,
      secondary_framing_material: null,
      structural_damage_indicators: null,
      number_of_buildings: numberOfBuildings,
      number_of_stories: null,
      finished_base_area: null,
      finished_basement_area: null,
      finished_upper_story_area: null,
      unfinished_base_area: null,
      unfinished_basement_area: null,
      unfinished_upper_story_area: null,
      roof_date: null,
      siding_installation_date: null,
      foundation_repair_date: null,
      exterior_door_installation_date: null,
      window_installation_date: null,
    };

    await fsp.writeFile(
      path.join("data", "structure.json"),
      JSON.stringify(structureOut, null, 2),
    );
  }

  // Deeds from sales table deed code column
  const deeds = [];
  if (!isMulti && sales.length) {
    function mapDeedCodeToType(code) {
      const c = (code || "").toUpperCase();
      if (c === "CV") return "Miscellaneous";
      return null;
    }
    await removeExisting(/^deed_.*\.json$/);
    for (let i = 0; i < sales.length; i++) {
      const deedType = mapDeedCodeToType(sales[i]._deed_code);
      const deedOut = {};
      if (deedType) deedOut.deed_type = deedType;
      deeds.push(deedOut);
      await fsp.writeFile(
        path.join("data", `deed_${i + 1}.json`),
        JSON.stringify(deedOut, null, 2),
      );
    }
  }

  // Files: collect key document/media links (no deed-file relationships since these are not deed docs)
  const fileRecords = [];
  if (!isMulti) {
    await removeExisting(/^file_.*\.json$/);
    const urls = new Set();
    $('a[href*="TrimPrint"]').each((i, a) => urls.add($(a).attr("href")));
    $('a[href*="/downloads/mapbook/"]').each((i, a) =>
      urls.add($(a).attr("href")),
    );
    $('a[href*="ImageSketches"], a[href*="imagesketches"]').each((i, a) =>
      urls.add($(a).attr("href")),
    );

    let idx = 0;
    for (const u of urls) {
      idx += 1;
      const rec = {
        file_format: getFileFormatFromUrl(u),
        name: path.basename(u || "") || null,
        original_url: u || null,
        ipfs_url: null,
        document_type: null,
      };
      if (rec.file_format === "jpeg") rec.document_type = "PropertyImage";
      fileRecords.push(rec);
      await fsp.writeFile(
        path.join("data", `file_${idx}.json`),
        JSON.stringify(rec, null, 2),
      );
    }
  }

  // Owners from owner_data and relationships
  let ownerDataKey = null;
  if (ownerData && propertyOut) {
    const k1 = `property_${propertyOut.parcel_identifier}`;
    const k2 = parcelIdentifierDashed
      ? `property_${parcelIdentifierDashed}`
      : null;
    if (ownerData[k1]) ownerDataKey = k1;
    else if (k2 && ownerData[k2]) ownerDataKey = k2;
  }
  let personIdx = 0;
  let companyIdx = 0;
  if (ownerDataKey) {
    const ownWrap = ownerData[ownerDataKey];
    if (
      ownWrap &&
      ownWrap.owners_by_date &&
      Array.isArray(ownWrap.owners_by_date.current)
    ) {
      const currentOwners = ownWrap.owners_by_date.current;
      await removeExisting(/^person_.*\.json$/);
      await removeExisting(/^company_.*\.json$/);
      for (const o of currentOwners) {
        if (o.type === "person") {
          personIdx += 1;
          const personOut = {
            birth_date: null,
            first_name: o.first_name || null,
            last_name: o.last_name || null,
            middle_name: null,
            prefix_name: null,
            suffix_name: null,
            us_citizenship_status: null,
            veteran_status: null,
          };
          await fsp.writeFile(
            path.join("data", `person_${personIdx}.json`),
            JSON.stringify(personOut, null, 2),
          );
        } else if (o.type === "company") {
          companyIdx += 1;
          const companyOut = { name: o.name || null };
          await fsp.writeFile(
            path.join("data", `company_${companyIdx}.json`),
            JSON.stringify(companyOut, null, 2),
          );
        }
      }
    }
  }

  // Relationships: clean and create one per sale-owner pair (no duplicates)
  await removeExisting(/^relationship_sales_company.*\.json$/);
  await removeExisting(/^relationship_sales_person.*\.json$/);
  await removeExisting(/^relationship_sales_deed.*\.json$/);
  await removeExisting(/^relationship_deed_file.*\.json$/);

  const salesFiles = await fsp
    .readdir("data")
    .then((arr) => arr.filter((f) => /^sales_\d+\.json$/.test(f)))
    .catch(() => []);
  salesFiles.sort(
    (a, b) =>
      parseInt(a.match(/(\d+)/)[1], 10) - parseInt(b.match(/(\d+)/)[1], 10),
  );
  if (salesFiles.length) {
    for (let s = 0; s < salesFiles.length; s++) {
      const saleIdx = parseInt(salesFiles[s].match(/(\d+)/)[1], 10);
      for (let i = 1; i <= companyIdx; i++) {
        const rel = {
          to: { "/": `./company_${i}.json` },
          from: { "/": `./${salesFiles[s]}` },
        };
        await fsp.writeFile(
          path.join("data", `relationship_sales_company_${saleIdx}.json`),
          JSON.stringify(rel, null, 2),
        );
      }
      for (let i = 1; i <= personIdx; i++) {
        const rel = {
          to: { "/": `./person_${i}.json` },
          from: { "/": `./${salesFiles[s]}` },
        };
        await fsp.writeFile(
          path.join("data", `relationship_sales_person_${saleIdx}.json`),
          JSON.stringify(rel, null, 2),
        );
      }
    }
  }

  // relationship: sales → deed (one per pair, suffixed only)
  if (deeds.length) {
    for (let i = 0; i < deeds.length; i++) {
      const rel = {
        to: { "/": `./sales_${i + 1}.json` },
        from: { "/": `./deed_${i + 1}.json` },
      };
      await fsp.writeFile(
        path.join("data", `relationship_sales_deed_${i + 1}.json`),
        JSON.stringify(rel, null, 2),
      );
    }
  }
}

main().catch(async (err) => {
  const errMsg = {
    type: "error",
    message: err && err.message ? err.message : String(err),
    path: "scripts/data_extractor",
  };
  try {
    ensureDirSync("data");
    await fsp.writeFile(
      path.join("data", "error.json"),
      JSON.stringify(errMsg, null, 2),
    );
  } catch {}
  console.error(err);
  process.exit(1);
});