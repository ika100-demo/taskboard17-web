export const TITLE_ERROR = "Title must be 1 to 200 characters";

const MAX_TITLE_LENGTH = 200;

/** Trimmed title of 1..200 code points; shared by the browser and the Server Action. */
export function validateTitle(raw: string): { ok: true; title: string } | { ok: false } {
  const title = raw.trim();
  const length = [...title].length;
  if (length < 1 || length > MAX_TITLE_LENGTH) {
    return { ok: false };
  }
  return { ok: true, title };
}
