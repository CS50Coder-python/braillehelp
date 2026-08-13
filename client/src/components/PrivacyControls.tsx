import React from "react";
import { Users } from "lucide-react";

type Student = { id: number; displayName: string; gradeLevel?: string | null; retentionDays: number };

export function PrivacyControls({ students, retentionDays, onRetentionDaysChange, onSaveRetention, onDeleteStudent, onPurgeExpired }: { students: Student[]; retentionDays: number; onRetentionDaysChange: (days: number) => void; onSaveRetention: (studentId: number) => void; onDeleteStudent: (studentId: number) => void; onPurgeExpired: () => void }) {
  return <div className="privacy-controls panel"><div className="panel-heading"><div><div className="eyebrow">RETENTION WINDOW</div><h2>Student data policy</h2></div><button className="secondary-button" onClick={onPurgeExpired}>Purge expired data</button></div><label>Retention days<input type="number" min="1" max="3650" value={retentionDays} onChange={(event) => onRetentionDaysChange(Number(event.target.value))} /></label><div className="attention-list">{students.map((student) => <div className="attention-item" key={student.id}><div className="avatar avatar-teal"><Users size={16} /></div><div className="attention-copy"><strong>{student.displayName}</strong><span>{student.gradeLevel ?? "Student"} · {student.retentionDays} day policy</span></div><button className="secondary-button" onClick={() => onSaveRetention(student.id)}>Save policy</button><button className="danger-button" onClick={() => onDeleteStudent(student.id)}>Delete</button></div>)}</div><p className="form-note">Deleting is immediate for database records owned by this account.</p></div>;
}
