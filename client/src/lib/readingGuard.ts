export function hasAnalyzedPassage(passageId: number | undefined, detectedText: string | null | undefined) {
  return Boolean(passageId && detectedText?.trim());
}

export const ANALYZED_PASSAGE_REQUIRED = "Analyze a Braille passage before comparing oral reading.";
