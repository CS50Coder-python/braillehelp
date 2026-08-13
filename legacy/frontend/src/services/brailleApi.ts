export interface BrailleScanResult {
  success: true;
  text: string;
  confidence: number;
  brailleStandard: 'UEB_UNCONTRACTED';
  lines: Array<{ lineIndex: number; text: string }>;
  warnings: string[];
}

export async function scanBrailleImage(imageFile: File): Promise<BrailleScanResult> {
  const formData = new FormData();
  formData.append('image', imageFile);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const response = await fetch(`${apiUrl}/api/braille/scan`, {
    method: 'POST',
    body: formData
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Braille scan failed');
  }

  return result;
}
