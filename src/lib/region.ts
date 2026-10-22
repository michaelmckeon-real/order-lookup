export type Region = "IE" | "UK";

export interface RegionConfig {
  region: Region;
  name: "Ireland" | "United Kingdom";
  titleSuffix: "Ireland" | "UK";
  timeZone: "Europe/Dublin" | "Europe/London";
}

const regions: Record<Region, RegionConfig> = {
  IE: {
    region: "IE",
    name: "Ireland",
    titleSuffix: "Ireland",
    timeZone: "Europe/Dublin",
  },
  UK: {
    region: "UK",
    name: "United Kingdom",
    titleSuffix: "UK",
    timeZone: "Europe/London",
  },
};

export function getRegionConfig(): RegionConfig {
  const configured = process.env.ORDER_REGION?.trim();
  if (configured === "IE" || configured === "UK") {
    return regions[configured];
  }
  throw new Error("ORDER_REGION must be set to IE or UK");
}
