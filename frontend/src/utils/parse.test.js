import { describe, it, expect } from "vitest";
import { safeArr, parseAmenities, parseUrls } from "./parse.js";

describe("parse utils", () => {
  describe("safeArr", () => {
    it("returns array as-is", () => {
      expect(safeArr([1, 2])).toEqual([1, 2]);
      expect(safeArr([])).toEqual([]);
    });
    it("returns empty array for non-array", () => {
      expect(safeArr(null)).toEqual([]);
      expect(safeArr(undefined)).toEqual([]);
      expect(safeArr("x")).toEqual([]);
      expect(safeArr(0)).toEqual([]);
    });
  });

  describe("parseAmenities", () => {
    it("returns array as-is", () => {
      expect(parseAmenities(["wifi", "ac"])).toEqual(["wifi", "ac"]);
    });
    it("parses valid JSON string", () => {
      expect(parseAmenities('["wifi"]')).toEqual(["wifi"]);
      expect(parseAmenities("[]")).toEqual([]);
    });
    it("returns [] for invalid or empty", () => {
      expect(parseAmenities("")).toEqual([]);
      expect(parseAmenities("invalid")).toEqual([]);
      expect(parseAmenities(null)).toEqual([]);
    });
  });

  describe("parseUrls", () => {
    it("returns array as-is", () => {
      expect(parseUrls(["/a", "/b"])).toEqual(["/a", "/b"]);
    });
    it("parses valid JSON string", () => {
      expect(parseUrls('["/uploads/1.jpg"]')).toEqual(["/uploads/1.jpg"]);
      expect(parseUrls("[]")).toEqual([]);
    });
    it("returns [] for invalid or empty", () => {
      expect(parseUrls("")).toEqual([]);
      expect(parseUrls("x")).toEqual([]);
    });
  });
});
