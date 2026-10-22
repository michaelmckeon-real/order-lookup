import { DefaultAzureCredential } from "@azure/identity";
import { BlobClient } from "@azure/storage-blob";
import { rules } from "@/lib/config";
import { readSnapshot } from "@/lib/data/snapshot-store";
import { ingestExport } from "@/lib/ingest/ingest";
import type { ParseCounts } from "@/lib/ingest/parse-export";

export type BlobProperties = {
  lastModified: Date;
  etag: string;
  contentLength: number;
};

export type BlobSource = {
  getProperties(): Promise<BlobProperties>;
  download(): Promise<Buffer>;
};

export type Clock = {
  now(): Date;
  setInterval(handler: () => void, ms: number): { clear(): void };
};

const defaultClock: Clock = {
  now: () => new Date(),
  setInterval(handler, ms) {
    const id = setInterval(handler, ms);
    return {
      clear() {
        clearInterval(id);
      },
    };
  },
};

type LogResult =
  | "loaded"
  | "missing_columns"
  | "no_orders"
  | "not_newer"
  | "too_few_orders"
  | "too_large"
  | "error";

function logIngest(entry: {
  result: LogResult;
  orders: number | null;
  asOf: string | null;
  counts: ParseCounts | null;
  error?: string;
}): void {
  const line: Record<string, string | number | null | ParseCounts> = {
    event: "ingest",
    time: new Date().toISOString(),
    result: entry.result,
    orders: entry.orders,
    asOf: entry.asOf,
    counts: entry.counts,
  };
  if (entry.error !== undefined) {
    line.error = entry.error;
  }
  console.info(JSON.stringify(line));
}

function logFeed(auth: "sas" | "entra", sasExpires: string | null): void {
  console.info(
    JSON.stringify({
      event: "feed",
      time: new Date().toISOString(),
      auth,
      sasExpires,
    }),
  );
}

function blobNameFromSasUrl(sasUrl: string): string {
  const url = new URL(sasUrl);
  const parts = url.pathname.split("/").filter((part) => part.length > 0);
  const name = parts[parts.length - 1];
  return name ? decodeURIComponent(name) : "blob";
}

export function sasExpiresIso(sasUrl: string): string | null {
  const se = new URL(sasUrl).searchParams.get("se");
  if (se === null || se.length === 0) {
    return null;
  }
  const date = new Date(se);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export function formatPollerError(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as { statusCode: unknown }).statusCode === "number" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return `${(error as { statusCode: number }).statusCode} ${(error as { code: string }).code}`;
  }
  if (error instanceof Error) {
    return error.name;
  }
  return "Error";
}

function wrapClient(client: BlobClient): BlobSource {
  return {
    async getProperties() {
      const props = await client.getProperties();
      return {
        lastModified: props.lastModified ?? new Date(0),
        etag: props.etag ?? "",
        contentLength: props.contentLength ?? 0,
      };
    },
    async download() {
      const response = await client.download();
      const chunks: Buffer[] = [];
      if (!response.readableStreamBody) {
        return Buffer.alloc(0);
      }
      for await (const chunk of response.readableStreamBody) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    },
  };
}

export function createSasBlobSource(sasUrl: string): BlobSource {
  return wrapClient(new BlobClient(sasUrl));
}

export function createAzureBlobSource(env: {
  account: string;
  container: string;
  name: string;
}): BlobSource {
  const url = `https://${env.account}.blob.core.windows.net/${env.container}/${env.name}`;
  return wrapClient(new BlobClient(url, new DefaultAzureCredential()));
}

export function startBlobPoller(
  source: BlobSource | null = null,
  clock: Clock = defaultClock,
): { stop(): void } | null {
  const sasUrl = process.env.ORDER_BLOB_SAS_URL?.trim() || "";
  const account = process.env.ORDER_BLOB_ACCOUNT;
  const container = process.env.ORDER_BLOB_CONTAINER;
  const name = process.env.ORDER_BLOB_NAME;

  let blobSource = source;
  let blobName = name ?? "blob";
  let auth: "sas" | "entra" | null = null;
  let sasExpires: string | null = null;

  if (blobSource === null) {
    if (sasUrl.length > 0) {
      blobSource = createSasBlobSource(sasUrl);
      blobName = blobNameFromSasUrl(sasUrl);
      auth = "sas";
      sasExpires = sasExpiresIso(sasUrl);
    } else if (account && container && name) {
      blobSource = createAzureBlobSource({ account, container, name });
      blobName = name;
      auth = "entra";
    }
  } else if (sasUrl.length > 0) {
    auth = "sas";
    sasExpires = sasExpiresIso(sasUrl);
    blobName = blobNameFromSasUrl(sasUrl);
  } else if (account && container && name) {
    auth = "entra";
    blobName = name;
  } else {
    auth = "entra";
  }

  if (blobSource === null || auth === null) {
    return null;
  }

  const activeSource: BlobSource = blobSource;
  logFeed(auth, sasExpires);

  let inFlight = false;
  let lastRefusedEtag: string | null = null;

  async function poll(): Promise<void> {
    if (inFlight) {
      return;
    }
    inFlight = true;
    try {
      const props = await activeSource.getProperties();
      const current = await readSnapshot();
      const asOfIso = props.lastModified.toISOString();

      if (
        current !== null &&
        !(props.lastModified.getTime() > new Date(current.asOf).getTime())
      ) {
        return;
      }

      if (lastRefusedEtag !== null && props.etag === lastRefusedEtag) {
        return;
      }

      const maxBytes = rules.ingest.maxMegabytes * 1024 * 1024;
      if (props.contentLength > maxBytes) {
        lastRefusedEtag = props.etag;
        logIngest({
          result: "too_large",
          orders: null,
          asOf: asOfIso,
          counts: null,
        });
        return;
      }

      const buffer = await activeSource.download();
      const text = buffer.toString("utf8");
      const outcome = await ingestExport({
        sourceFile: blobName,
        asOf: asOfIso,
        text,
      });

      if (outcome.result === "loaded") {
        lastRefusedEtag = null;
        logIngest({
          result: "loaded",
          orders: outcome.orderCount,
          asOf: asOfIso,
          counts: outcome.counts,
        });
        return;
      }

      lastRefusedEtag = props.etag;
      logIngest({
        result: outcome.result,
        orders: null,
        asOf: asOfIso,
        counts: outcome.result === "missing_columns" ? null : outcome.counts,
      });
    } catch (error) {
      logIngest({
        result: "error",
        orders: null,
        asOf: null,
        counts: null,
        error: formatPollerError(error),
      });
    } finally {
      inFlight = false;
    }
  }

  void poll();
  const timer = clock.setInterval(() => {
    void poll();
  }, rules.ingest.pollMinutes * 60 * 1000);

  return {
    stop() {
      timer.clear();
    },
  };
}
