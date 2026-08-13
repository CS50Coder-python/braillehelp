import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PrivacyControls } from "../client/src/components/PrivacyControls";

describe("privacy controls UI", () => {
  it("renders retention, purge, save, and delete actions for student data", () => {
    const html = renderToStaticMarkup(createElement(PrivacyControls, { students: [{ id: 7, displayName: "Ava Morgan", gradeLevel: "Grade 4", retentionDays: 365 }], retentionDays: 365, onRetentionDaysChange: () => undefined, onSaveRetention: () => undefined, onDeleteStudent: () => undefined, onPurgeExpired: () => undefined }));
    expect(html).toContain("Student data policy");
    expect(html).toContain("Purge expired data");
    expect(html).toContain("Ava Morgan");
    expect(html).toContain("Delete");
  });
});
