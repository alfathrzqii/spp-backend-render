import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../../../main/app.js";
import prisma from "../../database/prisma.js";

vi.mock("../../database/prisma.js", () => ({
  default: {
    $queryRaw: vi.fn(),
  },
}));

describe("Health Check Endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 200 OK and status ok when database is healthy", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ "?column?": 1 }]);

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("status", "ok");
    expect(response.body).toHaveProperty("timestamp");
    expect(response.body).toHaveProperty("uptime");
    expect(response.body.checks).toEqual({ database: "up" });
  });

  it("should return 200 OK for /api/health when database is healthy", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ "?column?": 1 }]);

    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("status", "ok");
    expect(response.body.checks).toEqual({ database: "up" });
  });

  it("should return 503 Service Unavailable when database query fails", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error("Database connection failed"));

    const response = await request(app).get("/health");

    expect(response.status).toBe(503);
    expect(response.body).toHaveProperty("status", "error");
    expect(response.body).toHaveProperty("timestamp");
    expect(response.body).toHaveProperty("uptime");
    expect(response.body.checks).toEqual({ database: "down" });
  });
});
