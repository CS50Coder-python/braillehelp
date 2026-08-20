import React from "react";
import { buildPassageSessionMetadata } from "@/lib/passageMeta";

type Props = {
  passage: { title?: string | null; detectedText?: string | null; expectedWordCount?: number | null; analysis?: { confidence: number; brailleStandard: string; warnings: string | null; cellCount: number; lineCount: number } | null } | null | undefined;
  studentName?: string | null;
};

export function PassageSessionMeta({ passage, studentName }: Props) {
  const metadata = buildPassageSessionMetadata(passage, studentName);
  const analysis = passage?.analysis;
  const warnings = analysis?.warnings ? (() => { try { const parsed = JSON.parse(analysis.warnings); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []; } catch { return [analysis.warnings]; } })() : [];
  return <div className="passage-meta session-meta"><span><strong>Analyzed length</strong> {metadata.expectedWordCount} words</span><span><strong>Student</strong> {metadata.studentName}</span>{analysis && <><span><strong>AI confidence</strong> {Math.round(analysis.confidence * 100)}%</span><span><strong>Reference</strong> {analysis.brailleStandard}</span><span><strong>Visible cells</strong> {analysis.cellCount} · {analysis.lineCount} lines</span></>}{warnings.length > 0 && <span className="analysis-warning"><strong>Review note</strong> {warnings[0]}</span>}<span className="sr-only">{metadata.detectedText}</span></div>;
}
