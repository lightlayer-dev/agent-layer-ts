import { describe, it, expect } from "vitest";
import { generateSecurityHeaders } from "./security-headers.js";

describe("generateSecurityHeaders", () => {
  it("generates all default headers", () => {
    const headers = generateSecurityHeaders();
    expect(headers["Strict-Transport-Security"]).toContain("max-age=31536000");
    expect(headers["Strict-Transport-Security"]).toContain("includeSubDomains");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Content-Security-Policy"]).toBe("default-src 'self'");
  });

  it("does not include Permissions-Policy by default", () => {
    const headers = generateSecurityHeaders();
    expect(headers["Permissions-Policy"]).toBeUndefined();
  });

  it("allows custom HSTS max-age", () => {
    const headers = generateSecurityHeaders({ hstsMaxAge: 86400 });
    expect(headers["Strict-Transport-Security"]).toBe(
      "max-age=86400; includeSubDomains",
    );
  });

  it("can disable HSTS", () => {
    const headers = generateSecurityHeaders({ hstsMaxAge: 0 });
    expect(headers["Strict-Transport-Security"]).toBeUndefined();
  });

  it("can disable individual headers", () => {
    const headers = generateSecurityHeaders({
      frameOptions: false,
      contentTypeOptions: false,
      referrerPolicy: false,
      csp: false,
    });
    expect(headers["X-Frame-Options"]).toBeUndefined();
    expect(headers["X-Content-Type-Options"]).toBeUndefined();
    expect(headers["Referrer-Policy"]).toBeUndefined();
    expect(headers["Content-Security-Policy"]).toBeUndefined();
  });

  it("supports SAMEORIGIN frame option", () => {
    const headers = generateSecurityHeaders({ frameOptions: "SAMEORIGIN" });
    expect(headers["X-Frame-Options"]).toBe("SAMEORIGIN");
  });

  it("supports custom CSP", () => {
    const headers = generateSecurityHeaders({
      csp: "default-src 'self'; script-src 'self' cdn.example.com",
    });
    expect(headers["Content-Security-Policy"]).toContain("cdn.example.com");
  });

  it("supports permissions policy", () => {
    const headers = generateSecurityHeaders({
      permissionsPolicy: "camera=(), microphone=()",
    });
    expect(headers["Permissions-Policy"]).toBe("camera=(), microphone=()");
  });

  it("can disable includeSubDomains on HSTS", () => {
    const headers = generateSecurityHeaders({
      hstsIncludeSubdomains: false,
    });
    expect(headers["Strict-Transport-Security"]).toBe("max-age=31536000");
    expect(headers["Strict-Transport-Security"]).not.toContain(
      "includeSubDomains",
    );
  });
});
