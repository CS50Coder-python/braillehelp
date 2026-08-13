import { describe, expect, it } from "vitest";
import { buildPassageSessionMetadata } from "../client/src/lib/passageMeta";

describe("passage session metadata", () => {
  it("surfaces persisted passage fields and linked student", () => {
    const metadata = buildPassageSessionMetadata({
      title: "The little seed",
      detectedText: "A seed waits under the soil.",
      expectedWordCount: 7,
    }, "Ava Morgan");

    expect(metadata).toEqual({
      title: "The little seed",
      detectedText: "A seed waits under the soil.",
      expectedWordCount: 7,
      studentName: "Ava Morgan",
    });
  });
});
