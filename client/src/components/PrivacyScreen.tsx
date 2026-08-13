import React from "react";
import { PrivacyControls } from "./PrivacyControls";

type Student = { id: number; displayName: string; gradeLevel?: string | null; retentionDays: number };

export function PrivacyScreen({ students, retentionDays, onRetentionDaysChange, onSaveRetention, onDeleteStudent, onPurgeExpired }: { students: Student[]; retentionDays: number; onRetentionDaysChange: (days: number) => void; onSaveRetention: (studentId: number) => void; onDeleteStudent: (studentId: number) => void; onPurgeExpired: () => void }) {
  return <section className="privacy-screen"><div className="eyebrow">HELP & PRIVACY · OWNER CONTROLS</div><h1>Keep student data <em>on purpose.</em></h1><p className="lede">Manage retention, purge expired records, and delete linked classroom data.</p><PrivacyControls students={students} retentionDays={retentionDays} onRetentionDaysChange={onRetentionDaysChange} onSaveRetention={onSaveRetention} onDeleteStudent={onDeleteStudent} onPurgeExpired={onPurgeExpired} /></section>;
}
