import { normaliseJavaApiBase } from "@/lib/normaliseJavaApiBase";

describe("normaliseJavaApiBase", () => {
  it("adds https when scheme missing", () => {
    expect(normaliseJavaApiBase("api.example.com", "http://localhost:4002")).toBe(
      "https://api.example.com",
    );
  });

  it("strips trailing slashes", () => {
    expect(
      normaliseJavaApiBase("http://kong-gateway:8000/crm/", "http://localhost:4002"),
    ).toBe("http://kong-gateway:8000/crm");
  });

  it("uses fallback when raw empty", () => {
    expect(normaliseJavaApiBase(undefined, "http://localhost:4002")).toBe(
      "http://localhost:4002",
    );
  });
});
