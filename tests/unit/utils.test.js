import { describe, expect, test } from "bun:test";
import { toCSV, parseCSV } from "../../utils/csv.js";
import { resolveRange, dayKeys, zonedMidnight } from "../../utils/dates.js";
import { slugify, escapeRegex } from "../../utils/slug.js";

describe("CSV", () => {
  test("round-trips quoted values and blocks spreadsheet formula injection", () => {
    const csv = toCSV([{ name: 'Peak "Full" Milk, 400g', price: 5600, note: "=HYPERLINK(evil)" }], [
      { key: "name", label: "name" },
      { key: "price", label: "selling_price" },
      { key: "note", label: "note" },
    ]);
    expect(csv).toContain('"Peak ""Full"" Milk, 400g"');
    expect(csv).toContain("'=HYPERLINK(evil)");
    const rows = parseCSV(csv);
    expect(rows[0].name).toBe('Peak "Full" Milk, 400g');
    expect(rows[0].selling_price).toBe("5600");
  });

  test("normalises headers and ignores blank lines / BOM", () => {
    const rows = parseCSV("﻿Name,Selling Price\r\nIndomie,320\r\n\r\n");
    expect(rows).toEqual([{ name: "Indomie", selling_price: "320" }]);
  });
});

describe("Date ranges (Africa/Lagos)", () => {
  const now = new Date("2026-09-25T10:00:00Z"); // 11:00 in Lagos (Friday)
  test("today starts at Lagos midnight (23:00 UTC previous day)", () => {
    const r = resolveRange("today", { now });
    expect(r.from.toISOString()).toBe("2026-09-24T23:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-09-25T23:00:00.000Z");
  });
  test("this week starts on Monday", () => {
    expect(resolveRange("this_week", { now }).from.toISOString()).toBe("2026-09-20T23:00:00.000Z");
  });
  test("custom range is inclusive of the end day", () => {
    const r = resolveRange("custom", { from: "2026-09-01", to: "2026-09-03", now });
    expect(r.days).toBe(3);
    expect(dayKeys(r.from, r.to)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
  });
  test("zonedMidnight handles UTC", () => {
    expect(zonedMidnight(2026, 1, 1, "UTC").toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("Slug & regex safety", () => {
  test("slugify", () => expect(slugify("Mama Nkechi's Supermarket!")).toBe("mama-nkechi-s-supermarket"));
  test("escapeRegex neutralises special characters", () => {
    const rx = new RegExp(escapeRegex("a+(b)*"));
    expect(rx.test("a+(b)*")).toBe(true);
    expect(rx.test("aab")).toBe(false);
  });
});
