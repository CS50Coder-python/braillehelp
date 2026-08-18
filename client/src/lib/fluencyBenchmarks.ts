export type FluencySeason = "fall" | "winter" | "spring";

export type FluencyBand = "below" | "within" | "above" | "unavailable";

export type FluencyBenchmark = {
  grade: number;
  season: FluencySeason;
  p25: number;
  p50: number;
  p75: number;
  sourceLabel: string;
};

// Hasbrouck & Tindal (2017) compiled ORF norms as reproduced by Reading Rockets.
// Values are words-correct-per-minute reference points, not diagnostic cutoffs.
const NORMS: Record<number, Record<FluencySeason, [number, number, number]>> = {
  1: { fall: [16, 29, 59], winter: [34, 60, 91], spring: [44, 73, 97] },
  2: { fall: [36, 50, 84], winter: [59, 84, 109], spring: [72, 100, 124] },
  3: { fall: [59, 83, 104], winter: [79, 97, 137], spring: [91, 112, 139] },
  4: { fall: [75, 94, 125], winter: [95, 120, 143], spring: [105, 133, 160] },
  5: { fall: [87, 121, 153], winter: [109, 133, 160], spring: [119, 146, 169] },
  6: { fall: [112, 132, 159], winter: [116, 145, 166], spring: [122, 146, 173] },
};

export function gradeFromAge(age: number): number | null {
  if (!Number.isFinite(age) || age < 6 || age > 14) return null;
  return Math.max(1, Math.min(6, Math.round(age - 6)));
}

export function getFluencyBenchmark(grade: number, season: FluencySeason): FluencyBenchmark | null {
  const values = NORMS[grade]?.[season];
  if (!values) return null;
  return { grade, season, p25: values[0], p50: values[1], p75: values[2], sourceLabel: "Hasbrouck–Tindal 2017 ORF reference" };
}

export function classifyFluency(speedWpm: number, benchmark: FluencyBenchmark | null): FluencyBand {
  if (!benchmark || !Number.isFinite(speedWpm)) return "unavailable";
  if (speedWpm < benchmark.p25) return "below";
  if (speedWpm >= benchmark.p75) return "above";
  return "within";
}

export function fluencyBandLabel(band: FluencyBand): string {
  return band === "below" ? "Below reference" : band === "above" ? "Above reference" : band === "within" ? "Within reference" : "Reference unavailable";
}
