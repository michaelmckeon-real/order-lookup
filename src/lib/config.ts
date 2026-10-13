import locationsJson from "../../config/locations.json";
import rulesJson from "../../config/rules.json";

type NonStoreKind = "finding_stock" | "supplier";

type NonStoreEntry = {
  kind: NonStoreKind;
  label: string;
  detail: string;
};

type LocationsConfig = {
  stores: string[];
  nonStoreLocations: Record<string, NonStoreEntry>;
  displayNames: Record<string, string>;
};

type RulesConfig = {
  timeZone: string;
  windowDays: number;
  staleAfterHours: number;
  deliveryShippingTitles: string[];
  collectionTitlePrefixes: string[];
  carrierNames: Record<string, string>;
  locationFromTag: { Delivery: boolean; Collection: boolean };
  ingest: { pollMinutes: number; maxMegabytes: number };
};

function isNonStoreKind(value: unknown): value is NonStoreKind {
  return value === "finding_stock" || value === "supplier";
}

function validateLocations(value: unknown): LocationsConfig {
  if (typeof value !== "object" || value === null) {
    throw new Error("config/locations.json must be an object");
  }
  const record = value as Record<string, unknown>;
  if (
    !Array.isArray(record.stores) ||
    !record.stores.every((item) => typeof item === "string")
  ) {
    throw new Error("config/locations.json stores must be a string array");
  }
  if (
    typeof record.nonStoreLocations !== "object" ||
    record.nonStoreLocations === null ||
    Array.isArray(record.nonStoreLocations)
  ) {
    throw new Error("config/locations.json nonStoreLocations must be an object");
  }
  const nonStoreLocations: Record<string, NonStoreEntry> = {};
  for (const [name, entry] of Object.entries(record.nonStoreLocations)) {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(
        `config/locations.json nonStoreLocations["${name}"] must be an object`,
      );
    }
    const item = entry as Record<string, unknown>;
    if (!isNonStoreKind(item.kind)) {
      throw new Error(
        `config/locations.json nonStoreLocations["${name}"].kind is invalid`,
      );
    }
    if (typeof item.label !== "string" || typeof item.detail !== "string") {
      throw new Error(
        `config/locations.json nonStoreLocations["${name}"] needs label and detail strings`,
      );
    }
    nonStoreLocations[name] = {
      kind: item.kind,
      label: item.label,
      detail: item.detail,
    };
  }
  if (
    typeof record.displayNames !== "object" ||
    record.displayNames === null ||
    Array.isArray(record.displayNames)
  ) {
    throw new Error("config/locations.json displayNames must be an object");
  }
  const displayNames: Record<string, string> = {};
  for (const [key, mapped] of Object.entries(record.displayNames)) {
    if (typeof mapped !== "string") {
      throw new Error(
        `config/locations.json displayNames["${key}"] must be a string`,
      );
    }
    displayNames[key] = mapped;
  }
  return {
    stores: record.stores,
    nonStoreLocations,
    displayNames,
  };
}

function validateRules(value: unknown): RulesConfig {
  if (typeof value !== "object" || value === null) {
    throw new Error("config/rules.json must be an object");
  }
  const record = value as Record<string, unknown>;
  if (typeof record.timeZone !== "string") {
    throw new Error("config/rules.json timeZone must be a string");
  }
  if (typeof record.windowDays !== "number") {
    throw new Error("config/rules.json windowDays must be a number");
  }
  if (typeof record.staleAfterHours !== "number") {
    throw new Error("config/rules.json staleAfterHours must be a number");
  }
  if (
    !Array.isArray(record.deliveryShippingTitles) ||
    !record.deliveryShippingTitles.every((item) => typeof item === "string")
  ) {
    throw new Error(
      "config/rules.json deliveryShippingTitles must be a string array",
    );
  }
  if (
    !Array.isArray(record.collectionTitlePrefixes) ||
    !record.collectionTitlePrefixes.every((item) => typeof item === "string")
  ) {
    throw new Error(
      "config/rules.json collectionTitlePrefixes must be a string array",
    );
  }
  if (
    typeof record.carrierNames !== "object" ||
    record.carrierNames === null ||
    Array.isArray(record.carrierNames)
  ) {
    throw new Error("config/rules.json carrierNames must be an object");
  }
  const carrierNames: Record<string, string> = {};
  for (const [key, mapped] of Object.entries(record.carrierNames)) {
    if (typeof mapped !== "string") {
      throw new Error(
        `config/rules.json carrierNames["${key}"] must be a string`,
      );
    }
    carrierNames[key] = mapped;
  }
  if (
    typeof record.locationFromTag !== "object" ||
    record.locationFromTag === null
  ) {
    throw new Error("config/rules.json locationFromTag must be an object");
  }
  const tags = record.locationFromTag as Record<string, unknown>;
  if (
    typeof tags.Delivery !== "boolean" ||
    typeof tags.Collection !== "boolean"
  ) {
    throw new Error(
      "config/rules.json locationFromTag needs Delivery and Collection booleans",
    );
  }
  if (typeof record.ingest !== "object" || record.ingest === null) {
    throw new Error("config/rules.json ingest must be an object");
  }
  const ingest = record.ingest as Record<string, unknown>;
  if (typeof ingest.pollMinutes !== "number") {
    throw new Error("config/rules.json ingest.pollMinutes must be a number");
  }
  if (typeof ingest.maxMegabytes !== "number") {
    throw new Error("config/rules.json ingest.maxMegabytes must be a number");
  }
  return {
    timeZone: record.timeZone,
    windowDays: record.windowDays,
    staleAfterHours: record.staleAfterHours,
    deliveryShippingTitles: record.deliveryShippingTitles,
    collectionTitlePrefixes: record.collectionTitlePrefixes,
    carrierNames,
    locationFromTag: {
      Delivery: tags.Delivery,
      Collection: tags.Collection,
    },
    ingest: {
      pollMinutes: ingest.pollMinutes,
      maxMegabytes: ingest.maxMegabytes,
    },
  };
}

const locations = validateLocations(locationsJson);
const rulesConfig = validateRules(rulesJson);

export const rules = {
  timeZone: rulesConfig.timeZone,
  windowDays: rulesConfig.windowDays,
  staleAfterHours: rulesConfig.staleAfterHours,
  deliveryShippingTitles: rulesConfig.deliveryShippingTitles,
  collectionTitlePrefixes: rulesConfig.collectionTitlePrefixes,
  carrierNames: rulesConfig.carrierNames,
  locationFromTag: rulesConfig.locationFromTag,
  ingest: rulesConfig.ingest,
};

function normKey(value: string): string {
  return value.trim().toLowerCase();
}

export type MatchedLocation = {
  name: string;
  kind: "store" | "finding_stock" | "supplier";
  label: string;
  detail: string | null;
};

export function matchLocation(name: string): MatchedLocation | null {
  const key = normKey(name);
  if (key.length === 0) {
    return null;
  }
  const store = locations.stores.find((item) => normKey(item) === key);
  if (store) {
    return { name: store, kind: "store", label: store, detail: null };
  }
  for (const [configured, entry] of Object.entries(locations.nonStoreLocations)) {
    if (normKey(configured) === key) {
      return {
        name: configured,
        kind: entry.kind,
        label: entry.label,
        detail: entry.detail,
      };
    }
  }
  return null;
}

export function hasDisplayName(raw: string): boolean {
  return Object.prototype.hasOwnProperty.call(locations.displayNames, raw);
}

export function displayLocation(raw: string): string {
  if (hasDisplayName(raw)) {
    return locations.displayNames[raw];
  }
  const key = normKey(raw);
  const store = locations.stores.find((item) => normKey(item) === key);
  if (store) {
    return store;
  }
  return raw;
}

export function matchStore(title: string): string | null {
  const key = normKey(title);
  if (key.length === 0) {
    return null;
  }
  return locations.stores.find((item) => normKey(item) === key) ?? null;
}

export function matchCollectionStore(title: string): string | null {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const lower = trimmed.toLowerCase();
  for (const prefix of rulesConfig.collectionTitlePrefixes) {
    const prefixLower = prefix.toLowerCase();
    if (lower.startsWith(prefixLower)) {
      return matchStore(trimmed.slice(prefixLower.length));
    }
  }
  return null;
}

export function isCollectionTitle(title: string): boolean {
  return (
    matchStore(title) !== null || matchCollectionStore(title) !== null
  );
}

export function isDeliveryTitle(title: string): boolean {
  const key = normKey(title);
  if (key.length === 0) {
    return false;
  }
  return rulesConfig.deliveryShippingTitles.some(
    (item) => normKey(item) === key,
  );
}

export function displayCarrier(raw: string | null): string | null {
  if (raw === null) {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const key = Object.keys(rulesConfig.carrierNames).find(
    (name) => normKey(name) === normKey(trimmed),
  );
  if (key) {
    return rulesConfig.carrierNames[key];
  }
  return trimmed;
}
