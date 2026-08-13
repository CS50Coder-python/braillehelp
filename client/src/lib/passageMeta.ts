export type PassageSessionMetadata = {
  title: string;
  detectedText: string;
  expectedWordCount: number;
  studentName: string;
};

export function buildPassageSessionMetadata(input: { title?: string | null; detectedText?: string | null; expectedWordCount?: number | null } | null | undefined, studentName?: string | null): PassageSessionMetadata {
  const safeInput = input ?? {};
  return {
    title: safeInput.title?.trim() || "Untitled Braille passage",
    detectedText: safeInput.detectedText?.trim() || "No analyzed text is available yet.",
    expectedWordCount: Math.max(0, safeInput.expectedWordCount ?? 0),
    studentName: studentName?.trim() || "Classroom passage",
  };
}
