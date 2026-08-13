import React from "react";
import { buildPassageSessionMetadata } from "@/lib/passageMeta";

type Props = {
  passage: { title?: string | null; detectedText?: string | null; expectedWordCount?: number | null } | null | undefined;
  studentName?: string | null;
};

export function PassageSessionMeta({ passage, studentName }: Props) {
  const metadata = buildPassageSessionMetadata(passage, studentName);
  return <div className="passage-meta session-meta"><span><strong>Analyzed length</strong> {metadata.expectedWordCount} words</span><span><strong>Student</strong> {metadata.studentName}</span><span className="sr-only">{metadata.detectedText}</span></div>;
}
