/** Field and signer definitions stored as JSON on FormTemplate. */

export const FIELD_TYPES = [
  "text",
  "textarea",
  "date",
  "number",
  "select",
  "radio",
  "checkbox",
  "checklist",
  "heading",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  placeholder?: string;
  /** For select/radio/checklist. */
  options?: string[];
  /** Layout hint for the form grid. */
  width?: "full" | "half";
  defaultValue?: string;
};

export type SignerDef = {
  key: string;
  label: string;
  required?: boolean;
  /**
   * Signers marked remote are the ones who get a tokenized link — resident
   * representatives and family members who will never have a platform login.
   */
  remote?: boolean;
};

export type FormValues = Record<string, string | string[] | boolean>;

export function isFieldDef(value: unknown): value is FieldDef {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.key === "string" &&
    typeof v.label === "string" &&
    FIELD_TYPES.includes(v.type as FieldType)
  );
}

export function isSignerDef(value: unknown): value is SignerDef {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.key === "string" && typeof v.label === "string";
}
