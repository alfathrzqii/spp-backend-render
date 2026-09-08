import type { CookieOptions, Request } from "express";

export function getAuthCookieOptions(req?: Request): CookieOptions {
  const isProduction =
    process.env["NODE_ENV"] === "production" ||
    req?.headers["x-forwarded-proto"] === "https";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 15 * 60 * 1000, // 15 menit
  };
}

export function getClearAuthCookieOptions(req?: Request): CookieOptions {
  const { maxAge: _, ...clearOptions } = getAuthCookieOptions(req);
  return clearOptions;
}
