import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReadingEntryCta } from "../client/src/components/ReadingEntryCta";
import { getReadingEntryView, readSelectedPassageId, writeSelectedPassageId } from "../client/src/lib/selectedPassage";

describe("selected analyzed passage persistence", () => {
  it("round-trips a selected passage through storage", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
    writeSelectedPassageId(42, storage);
    expect(readSelectedPassageId(storage)).toBe(42);
    writeSelectedPassageId(undefined, storage);
    expect(readSelectedPassageId(storage)).toBeUndefined();
  });

  it("renders the real overview CTA for both passage states", () => {
    const analyzeCta = renderToStaticMarkup(createElement(ReadingEntryCta, { hasSelectedPassage: false, onClick: () => undefined }));
    const readCta = renderToStaticMarkup(createElement(ReadingEntryCta, { hasSelectedPassage: true, onClick: () => undefined }));
    expect(analyzeCta).toContain("Analyze a page first");
    expect(readCta).toContain("Start camera session");
    expect(getReadingEntryView(false)).toBe("analyze");
    expect(getReadingEntryView(true)).toBe("read");
  });

  it("ignores invalid stored passage ids", () => {
    const storage = { getItem: () => "not-a-passage" };
    expect(readSelectedPassageId(storage)).toBeUndefined();
  });
});
