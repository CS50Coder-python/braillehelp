const STORAGE_KEY = "braille-read-selected-passage";

export function readSelectedPassageId(storage: Pick<Storage, "getItem"> | undefined = typeof window === "undefined" ? undefined : window.localStorage) {
  const raw = storage?.getItem(STORAGE_KEY);
  const id = raw ? Number(raw) : NaN;
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

export function getReadingEntryView(hasSelectedPassage: boolean) {
  return hasSelectedPassage ? "read" : "analyze" as const;
}

export function writeSelectedPassageId(id: number | undefined, storage: Pick<Storage, "setItem" | "removeItem"> | undefined = typeof window === "undefined" ? undefined : window.localStorage) {
  if (!storage) return;
  if (id) storage.setItem(STORAGE_KEY, String(id));
  else storage.removeItem(STORAGE_KEY);
}
