import { describe, expect, it } from "vitest";
import { clientIp } from "@/lib/client-ip";

describe("clientIp", () => {
  it("returns X-Client-IP when that header is present", () => {
    const headers = new Headers({
      "X-Client-IP": "203.0.113.8",
      "X-Forwarded-For": "198.51.100.2:443, 203.0.113.1",
    });
    expect(clientIp(headers)).toBe("203.0.113.8");
  });

  it("uses the first X-Forwarded-For entry and removes any port", () => {
    const headers = new Headers({
      "X-Forwarded-For": "198.51.100.4:8443, 203.0.113.1",
    });
    expect(clientIp(headers)).toBe("198.51.100.4");
  });

  it("returns local when neither header is present", () => {
    expect(clientIp(new Headers())).toBe("local");
  });
});
