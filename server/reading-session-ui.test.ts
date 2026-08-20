import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PassageSessionMeta } from "../client/src/components/PassageSessionMeta";

describe("reading session persisted-data bindings", () => {
  it("renders persisted passage metadata in the production session component", () => {
    const html = renderToStaticMarkup(createElement(PassageSessionMeta, {
      passage: { title: "The little seed", detectedText: "A seed waits under the soil.", expectedWordCount: 7 },
      studentName: "Ava Morgan",
    }));

    expect(html).toContain("7 words");
    expect(html).toContain("Ava Morgan");
    expect(html).toContain("A seed waits under the soil.");
    const analyzedHtml = renderToStaticMarkup(createElement(PassageSessionMeta, {
      passage: { title: "The little seed", detectedText: "A seed waits under the soil.", expectedWordCount: 7, analysis: { confidence: 0.84, brailleStandard: "UEB_UNCONTRACTED", warnings: JSON.stringify(["Low contrast on line 2"]), cellCount: 28, lineCount: 4 } },
      studentName: "Ava Morgan",
    }));
    expect(analyzedHtml).toContain("AI confidence");
    expect(analyzedHtml).toContain("84%");
    expect(analyzedHtml).toContain("UEB_UNCONTRACTED");
    expect(analyzedHtml).toContain("28");
    expect(analyzedHtml).toContain("Low contrast on line 2");
  });
});
