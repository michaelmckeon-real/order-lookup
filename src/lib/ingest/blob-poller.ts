import { DefaultAzureCredential } from "@azure/identity";
import { BlobClient } from "@azure/storage-blob";
import { rules } from "@/lib/config";
import { readSnapshot } from "@/lib/data/snapshot-store";
import { ingestExport } from "@/lib/ingest/ingest";

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
  error?: string;
}): void {
  const line: Record<string, string | number | null> = {
    event: "ingest",
    time: new Date().toISOString(),
    result: entry.result,
    orders: entry.orders,
    asOf: entry.asOf,
  };
  if (entry.error !== undefined) {
    line.error = entry.error;
  }
  console.info(JSON.stringify(line));
}

export function createAzureBlobSource(env: {
  account: string;
  container: string;
  name: string;
}): BlobSource {
  const url = `https://${env.account}.blob.core.windows.net/${env.container}/${env.name}`;
  const client = new BlobClient(url, new DefaultAzureCredential());
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

export function startBlobPoller(
  source: BlobSource | null = null,
  clock: Clock = defaultClock,
): { stop(): void } | null {
  const account = process.env.ORDER_BLOB_ACCOUNT;
  const container = process.env.ORDER_BLOB_CONTAINER;
  const name = process.env.ORDER_BLOB_NAME;

  const blobSource =
    source ??
    (account && container && name
      ? createAzureBlobSource({ account, container, name })
      : null);

  if (blobSource === null) {
    return null;
  }

  const activeSource: BlobSource = blobSource;
  const blobName = name ?? "blob";
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
        });
        return;
      }

      lastRefusedEtag = props.etag;
      logIngest({
        result: outcome.result,
        orders: null,
        asOf: asOfIso,
      });
    } catch (error) {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code: unknown }).code === "string"
          ? (error as { code: string }).code
          : error instanceof Error
            ? error.name
            : "Error";
      logIngest({
        result: "error",
        orders: null,
        asOf: null,
        error: code,
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
