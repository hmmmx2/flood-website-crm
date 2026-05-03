/**
 * @jest-environment node
 */
jest.mock("@/lib/redis", () => ({
  withCache: jest.fn((_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
  CACHE_TTL: { nodes: 30 },
}));

jest.mock("@/lib/javaApi", () => ({
  javaFetch: jest.fn(),
}));

import { NextRequest } from "next/server";

import { GET } from "@/app/api/nodes/route";
import type { JavaSensorDto } from "@/lib/javaApi";
import { javaFetch } from "@/lib/javaApi";

function baseSensor(overrides: Partial<JavaSensorDto> = {}): JavaSensorDto {
  return {
    id: "sensor-id-1",
    nodeId: "102782478",
    name: "Node A",
    status: "active",
    distance: "0",
    coordinate: [110.357783, 1.531427],
    area: "Area",
    location: "Loc",
    state: "SK",
    currentLevel: 0,
    isDead: false,
    lastUpdated: "2025-12-01T12:07:19.857Z",
    createdAt: "2025-11-24T06:36:00.369Z",
    ...overrides,
  };
}

function makeRequest() {
  return new NextRequest("http://localhost/api/nodes");
}

describe("/api/nodes GET", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns nodes data successfully", async () => {
    (javaFetch as jest.Mock).mockResolvedValue([baseSensor()]);

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      success: boolean;
      data: { node_id: string }[];
      count: number;
    };

    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].node_id).toBe("102782478");
    expect(data.count).toBe(1);
  });

  it("handles Java API errors", async () => {
    (javaFetch as jest.Mock).mockRejectedValue(new Error("upstream failed"));

    const response = await GET(makeRequest());
    expect(response.status).toBe(500);
    const data = (await response.json()) as { success: boolean; error: string };

    expect(data.success).toBe(false);
    expect(data.error).toBe("Failed to fetch nodes data");
  });

  it("maps JavaSensorDto to NodeData", async () => {
    (javaFetch as jest.Mock).mockResolvedValue([
      baseSensor({ id: "uuid-2", currentLevel: 2 }),
    ]);

    const response = await GET(makeRequest());
    const data = (await response.json()) as {
      data: Array<{ _id: string; node_id: string; current_level: number }>;
    };

    expect(data.data[0]).toMatchObject({
      _id: "uuid-2",
      node_id: "102782478",
      current_level: 2,
    });
  });

  it("returns empty array when Java returns none", async () => {
    (javaFetch as jest.Mock).mockResolvedValue([]);

    const response = await GET(makeRequest());
    const data = (await response.json()) as {
      success: boolean;
      data: unknown[];
      count: number;
    };

    expect(data.success).toBe(true);
    expect(data.data).toEqual([]);
    expect(data.count).toBe(0);
  });
});
