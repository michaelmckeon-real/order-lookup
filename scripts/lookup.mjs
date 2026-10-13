const baseUrl = (process.env.LOOKUP_BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);

async function printResponse(response) {
  const cacheControl = response.headers.get("cache-control");
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  console.log(response.status);
  console.log(cacheControl);
  console.log(JSON.stringify(body, null, 2));
}

async function main() {
  const arg = process.argv[2];

  if (arg === "--status") {
    const response = await fetch(`${baseUrl}/api/status`);
    await printResponse(response);
    return;
  }

  const query = arg === undefined ? "" : arg;
  const response = await fetch(`${baseUrl}/api/lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  await printResponse(response);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
