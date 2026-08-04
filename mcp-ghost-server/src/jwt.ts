import { createHmac, timingSafeEqual } from "node:crypto";

// Minimal HS256 JWT sign/verify — enough for this server's own access tokens.
// Not a general-purpose JWT library: no alg negotiation, no JWK support.

export function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

export function signJwt(payload: Record<string, unknown>, secret: Buffer, expiresInSeconds: number): string {
  const header = { alg: "HS256", typ: "JWT" };
  const iat = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat, exp: iat + expiresInSeconds };
  const encodedHeader = base64url(Buffer.from(JSON.stringify(header)));
  const encodedBody = base64url(Buffer.from(JSON.stringify(body)));
  const signingInput = `${encodedHeader}.${encodedBody}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest();
  return `${signingInput}.${base64url(signature)}`;
}

export function verifyJwt(token: string, secret: Buffer): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedBody, encodedSignature] = parts;

  const signingInput = `${encodedHeader}.${encodedBody}`;
  const expected = createHmac("sha256", secret).update(signingInput).digest();
  let actual: Buffer;
  try {
    actual = base64urlDecode(encodedSignature);
  } catch {
    return null;
  }
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(base64urlDecode(encodedBody).toString("utf8"));
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
