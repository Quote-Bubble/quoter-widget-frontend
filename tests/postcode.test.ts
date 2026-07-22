import { describe, expect, it } from "vitest";

import {
  looksLikeUkPostcode,
  normalisePostcode,
  prettyPostcode,
} from "@/lib/postcode";
import { addressEntryReady } from "@/components/quote/AddressEntry";

describe("postcode helpers", () => {
  it("normalises and pretty-prints UK postcodes", () => {
    expect(normalisePostcode("sw1a 2aa")).toBe("SW1A2AA");
    expect(prettyPostcode("sw1a2aa")).toBe("SW1A 2AA");
    expect(looksLikeUkPostcode("SW1A 2AA")).toBe(true);
    expect(looksLikeUkPostcode("SW1A")).toBe(false);
    expect(looksLikeUkPostcode("not a postcode")).toBe(false);
  });

  it("requires house line + valid postcode before continue", () => {
    expect(addressEntryReady("12 Oakfield Road", "SW1A 2AA")).toBe(true);
    expect(addressEntryReady("12", "SW1A 2AA")).toBe(false);
    expect(addressEntryReady("12 Oakfield Road", "SW1A")).toBe(false);
  });
});
