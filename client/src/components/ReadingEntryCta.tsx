import React from "react";
import { ArrowRight, Camera } from "lucide-react";

export function ReadingEntryCta({ hasSelectedPassage, onClick }: { hasSelectedPassage: boolean; onClick: () => void }) {
  return <button className="primary-button" onClick={onClick}><Camera size={16} /> {hasSelectedPassage ? "Start camera session" : "Analyze a page first"} <ArrowRight size={16} /></button>;
}
