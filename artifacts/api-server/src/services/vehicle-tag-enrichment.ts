import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { VehicleTagSpec, VehicleTagVariant } from "../templates/vehicle-tag/render";

const DATA_FILENAME = "vehicle-specs-import-normalized.csv";

export interface VehicleSpecRecord {
  source_brand_label: string;
  model: string;
  model_year: string;
  production_year: string;
  trim_name_ru: string;
  scope: string;
  spec_key: string;
  label_ru: string;
  value: string;
  unit: string;
}

export interface VehicleTagActiveRow {
  complectation: string | null;
  modification: string | null;
  fuelType: string | null;
  engineVolume: number | null;
  enginePower: number | null;
  driveType: string | null;
  bodyType: string | null;
}

interface EnrichmentInput {
  records: VehicleSpecRecord[];
  brand: string;
  model: string;
  year: number | null;
  variants: VehicleTagVariant[];
  activeRows: VehicleTagActiveRow[];
  activeSpecs: VehicleTagSpec[];
}

interface EnrichmentResult {
  variants: VehicleTagVariant[];
  specs: VehicleTagSpec[];
}

const EXTRA_SPEC_GROUPS: Array<{
  keys: string[];
  label: string;
  category?: string;
}> = [
  { keys: ["dimensions_l_w_h"], label: "Длина × ширина × высота" },
  { keys: ["max_power_hp", "combined_power_hp", "electric_motor_peak_power_hp"], label: "Мощность", category: "power" },
  { keys: ["max_torque", "combined_torque"], label: "Максимальный крутящий момент" },
  { keys: ["engine_displacement"], label: "Рабочий объём", category: "engine-displacement" },
  { keys: ["transmission"], label: "Коробка передач", category: "transmission" },
  { keys: ["drive_type", "drivetrain"], label: "Тип привода", category: "drive" },
  { keys: ["ground_clearance"], label: "Клиренс" },
  { keys: ["trunk_capacity", "trunk_volume_pair", "trunk_volume_range"], label: "Объём багажника" },
  { keys: ["fuel_consumption_combined", "fuel_consumption_phev_charge_sustaining"], label: "Расход топлива, смешанный цикл" },
  { keys: ["fuel_tank", "fuel_tank_capacity"], label: "Объём топливного бака" },
  { keys: ["wheelbase"], label: "Колёсная база" },
  { keys: ["seating_capacity"], label: "Количество мест" },
  { keys: ["max_speed"], label: "Максимальная скорость" },
  { keys: ["acceleration_0_100"], label: "Разгон 0–100 км/ч" },
  { keys: ["engine_type"], label: "Тип двигателя" },
  { keys: ["fuel_type"], label: "Тип топлива" },
  { keys: ["body_type"], label: "Тип кузова", category: "body" },
];

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some(value => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some(value => value.length > 0)) rows.push(row);
  }
  return rows;
}

export function parseVehicleSpecCsv(input: string): VehicleSpecRecord[] {
  const rows = parseCsvRows(input.replace(/^\uFEFF/, ""));
  const headers = rows.shift()?.map(value => value.trim()) ?? [];
  const requiredHeaders = [
    "source_brand_label", "model", "model_year", "production_year",
    "trim_name_ru", "scope", "spec_key", "label_ru", "value", "unit",
  ];
  if (requiredHeaders.some(header => !headers.includes(header))) {
    throw new Error("Vehicle specification CSV is missing required columns");
  }

  return rows.map(values => Object.fromEntries(
    headers.map((header, index) => [header, (values[index] ?? "").trim()]),
  ) as unknown as VehicleSpecRecord)
    .filter(record => record.source_brand_label && record.model && record.spec_key && record.value);
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function chooseApplicableYearRows(rows: VehicleSpecRecord[], year: number | null): VehicleSpecRecord[] {
  const yearRows = rows.filter(row => row.model_year || row.production_year);
  const yearlessRows = rows.filter(row => !row.model_year && !row.production_year);

  if (year == null) {
    const cohorts = new Set(yearRows.map(row => row.model_year || row.production_year));
    return cohorts.size === 1 ? rows : yearlessRows;
  }

  const expected = String(year);
  const exactRows = yearRows.filter(row => row.model_year === expected || row.production_year === expected);
  return exactRows.length ? exactRows : yearlessRows;
}

function getApplicableRecords(
  records: VehicleSpecRecord[],
  brand: string,
  model: string,
  year: number | null,
): VehicleSpecRecord[] {
  const brandKey = normalizeKey(brand);
  const modelKey = normalizeKey(model);
  const matches = records.filter(record =>
    normalizeKey(record.source_brand_label) === brandKey
    && normalizeKey(record.model) === modelKey,
  );
  return chooseApplicableYearRows(matches, year);
}

function getTrimRecordsForRow(
  records: VehicleSpecRecord[],
  activeRow: VehicleTagActiveRow,
): VehicleSpecRecord[] {
  const trimRecords = records.filter(record => record.scope === "trim" && record.trim_name_ru);
  const candidates = [activeRow.complectation, activeRow.modification]
    .filter((value): value is string => Boolean(value?.trim()));
  const matched = new Set<string>();

  for (const candidate of candidates) {
    const candidateKey = normalizeKey(candidate);
    if (!candidateKey) continue;
    const containsMultipleTrims = /[\/,;]/.test(candidate);
    for (const record of trimRecords) {
      const trimKey = normalizeKey(record.trim_name_ru);
      if (
        candidateKey === trimKey
        || (!containsMultipleTrims && trimKey.length >= 4 && candidateKey.includes(trimKey))
      ) {
        matched.add(trimKey);
      }
    }
  }

  // A composite or ambiguous live trim must not be assigned arbitrary source data.
  if (matched.size !== 1) return [];
  const onlyTrim = matched.values().next().value;
  return trimRecords.filter(record => normalizeKey(record.trim_name_ru) === onlyTrim);
}

function formatDisplacement(value: string): string {
  const number = Number(value.replace(",", "."));
  if (!Number.isFinite(number)) return value;
  const liters = number > 100 ? number / 1000 : number;
  return `${liters.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} л`;
}

function getEnrichedVariant(
  variant: VehicleTagVariant,
  activeRow: VehicleTagActiveRow,
  allRecords: VehicleSpecRecord[],
): VehicleTagVariant {
  const trimRecords = getTrimRecordsForRow(allRecords, activeRow);
  const modelRecords = allRecords.filter(record => record.scope === "model");
  const uniqueValue = (keys: string[]): string => {
    for (const key of keys) {
      const trimValues = trimRecords.filter(record => record.spec_key === key);
      const source = trimValues.length ? trimValues : modelRecords.filter(record => record.spec_key === key);
      const values = Array.from(new Set(source.map(record =>
        `${record.value}${record.unit ? ` ${record.unit}` : ""}`.trim(),
      )));
      if (values.length === 1) return values[0]!;
      if (values.length > 1) return "";
    }
    return "";
  };

  if (!trimRecords.length && !modelRecords.length) return variant;

  const fuel = uniqueValue(["fuel_type"]);
  const displacementRaw = uniqueValue(["engine_displacement"]);
  const displacement = displacementRaw
    ? formatDisplacement(displacementRaw.replace(/\s*(?:см³|см3|л)\s*$/i, ""))
    : "";
  const power = uniqueValue(["max_power_hp"]);
  const engine = [
    fuel,
    displacement,
    power,
  ].filter(Boolean).join(" · ");

  return {
    ...variant,
    engine: variant.engine || engine || uniqueValue(["engine_type"]),
    gearbox: variant.gearbox || uniqueValue(["transmission"]),
    drive: variant.drive || uniqueValue(["drive_type", "drivetrain"]),
  };
}

function activeFieldIsPresent(key: string, rows: VehicleTagActiveRow[]): boolean {
  switch (key) {
    case "body_type":
      return rows.some(row => Boolean(row.bodyType?.trim()));
    case "drive_type":
    case "drivetrain":
      return rows.some(row => Boolean(row.driveType?.trim()));
    case "engine_displacement":
      return rows.some(row => row.engineVolume != null);
    case "max_power_hp":
      return rows.some(row => row.enginePower != null);
    case "fuel_type":
      return rows.some(row => Boolean(row.fuelType?.trim()));
    case "transmission":
      return rows.some(row => Boolean(row.complectation?.match(/(?:DCT|DSG|CVT|AMT|AT|MT|АКПП|МКПП|робот|вариатор|автомат|механик)/i)
        || row.modification?.match(/(?:DCT|DSG|CVT|AMT|AT|MT|АКПП|МКПП|робот|вариатор|автомат|механик)/i)));
    default:
      return false;
  }
}

function formatSpecValue(record: VehicleSpecRecord): string {
  if (!record.unit) return record.value;
  const normalizedValue = normalizeKey(record.value);
  const normalizedUnit = normalizeKey(record.unit);
  return normalizedUnit && normalizedValue.includes(normalizedUnit)
    ? record.value
    : `${record.value} ${record.unit}`;
}

function buildMissingSpecs(
  applicable: VehicleSpecRecord[],
  activeRows: VehicleTagActiveRow[],
  activeSpecs: VehicleTagSpec[],
): VehicleTagSpec[] {
  const modelRecords = applicable.filter(record => record.scope === "model");
  const trimRecords = applicable.filter(record => record.scope === "trim");
  const activeTrimKeys = new Set<string>();
  for (const row of activeRows) {
    for (const record of getTrimRecordsForRow(applicable, row)) {
      activeTrimKeys.add(normalizeKey(record.trim_name_ru));
    }
  }
  const selectedTrimRecords = trimRecords.filter(record => activeTrimKeys.has(normalizeKey(record.trim_name_ru)));
  const existingLabels = new Set(activeSpecs.map(spec => normalizeKey(spec.label)));
  const addedLabels = new Set<string>();
  const output: VehicleTagSpec[] = [];

  for (const group of EXTRA_SPEC_GROUPS) {
    const specKey = group.keys.find(key => (
      !activeFieldIsPresent(key, activeRows)
      && applicable.some(record => record.spec_key === key)
    ));
    if (!specKey) continue;
    if (group.category === "power" && activeRows.some(row => row.enginePower != null)) continue;
    if (group.category === "body" && activeRows.some(row => Boolean(row.bodyType?.trim()))) continue;
    if (group.category === "engine-displacement" && activeRows.some(row => row.engineVolume != null)) continue;
    if (group.category === "transmission" && activeFieldIsPresent("transmission", activeRows)) continue;
    if (group.category === "drive" && activeRows.some(row => Boolean(row.driveType?.trim()))) continue;

    const trimValues = selectedTrimRecords.filter(record => record.spec_key === specKey);
    const sourceRecords = trimValues.length
      ? trimValues
      : modelRecords.filter(record => record.spec_key === specKey);
    const values = Array.from(new Set(sourceRecords.map(formatSpecValue).filter(Boolean)));
    if (!values.length) continue;

    const label = sourceRecords[0]?.label_ru?.trim() || group.label;
    const labelKey = normalizeKey(label);
    if (existingLabels.has(labelKey) || addedLabels.has(labelKey)) continue;
    output.push({ label, value: values.join("; ") });
    addedLabels.add(labelKey);
  }

  return output;
}

export function enrichVehicleTagData(input: EnrichmentInput): EnrichmentResult {
  const applicable = getApplicableRecords(input.records, input.brand, input.model, input.year);
  const variants = input.variants.map((variant, index) => {
    const row = input.activeRows[index];
    return row ? getEnrichedVariant(variant, row, applicable) : variant;
  });
  const additionalSpecs = buildMissingSpecs(applicable, input.activeRows, input.activeSpecs);
  const maxSpecCount = 8;

  return {
    variants,
    specs: [...input.activeSpecs, ...additionalSpecs].slice(0, maxSpecCount),
  };
}

let cachedRecords: VehicleSpecRecord[] | undefined;

export function loadVehicleTagSpecRecords(): VehicleSpecRecord[] {
  if (cachedRecords) return cachedRecords;

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(moduleDir, "data", DATA_FILENAME),
    path.join(moduleDir, "../data", DATA_FILENAME),
    path.resolve(process.cwd(), "artifacts/api-server/src/data", DATA_FILENAME),
    path.resolve(process.cwd(), "artifacts/api-server/dist/data", DATA_FILENAME),
  ];
  const dataPath = candidates.find(candidate => existsSync(candidate));
  if (!dataPath) {
    throw new Error(`Vehicle specification data file not found: ${DATA_FILENAME}`);
  }

  cachedRecords = parseVehicleSpecCsv(readFileSync(dataPath, "utf8"));
  if (!cachedRecords.length) throw new Error("Vehicle specification data file is empty");
  return cachedRecords;
}
