function stripPort(entry: string): string {
  const bracketed = /^\[([^\]]+)\]:\d+$/.exec(entry);
  if (bracketed) {
    return bracketed[1] ?? entry;
  }
  const withPort = /^([^:]+):\d+$/.exec(entry);
  if (withPort) {
    return withPort[1] ?? entry;
  }
  return entry;
}

export function clientIp(headers: Headers): string {
  const client = headers.get("x-client-ip");
  if (client !== null) {
    const trimmed = client.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded !== null) {
    const first = forwarded.split(",")[0]?.trim() ?? "";
    if (first.length > 0) {
      return stripPort(first);
    }
  }

  return "local";
}
