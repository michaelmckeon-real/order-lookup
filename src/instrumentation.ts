export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  const { startBlobPoller } = await import("@/lib/ingest/blob-poller");
  startBlobPoller();
}
