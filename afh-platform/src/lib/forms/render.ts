import { formatDate } from "../dates";
import type { FieldDef, FormValues } from "./types";

/**
 * Rendering for generated forms.
 *
 * Templates are plain text with {{token}} placeholders and a deliberately small
 * markup subset — headings, bullets, bold, and paragraphs. The output is a
 * printable document, not a web page, so there is no reason to accept arbitrary
 * HTML from a template. Everything is escaped and only the recognised markers
 * become tags.
 */

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Human-readable rendering of one stored field value. */
export function displayValue(value: unknown, field?: FieldDef): string {
  if (value == null || value === "") return "____________________";

  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "____________________";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";

  const text = String(value);
  if (field?.type === "date") {
    const parsed = new Date(`${text}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) return formatDate(parsed);
  }
  if (field?.type === "checkbox") {
    return text === "true" || text === "on" ? "Yes" : "No";
  }
  return text;
}

/**
 * Substitute {{token}} placeholders. Unknown tokens render as a blank rule so a
 * partially filled draft still prints as a usable paper form.
 */
export function fillTokens(
  template: string,
  values: FormValues,
  fields: FieldDef[],
  extra: Record<string, string> = {},
): string {
  const byKey = new Map(fields.map((f) => [f.key, f]));

  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    if (key in extra) return extra[key];
    if (key in values) return displayValue(values[key], byKey.get(key));
    return "____________________";
  });
}

/**
 * Convert the filled template body into printable HTML.
 * Supported markers: `## Heading`, `### Subheading`, `- bullet`, `**bold**`,
 * `---` rule, and blank-line-separated paragraphs.
 */
export function renderBody(filled: string): string {
  const blocks = filled.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const html: string[] = [];

  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;

    if (block === "---") {
      html.push('<hr class="my-4 border-slate-300" />');
      continue;
    }

    const lines = block.split("\n");

    if (lines.every((l) => l.trim().startsWith("- "))) {
      const items = lines
        .map((l) => `<li>${inline(l.trim().slice(2))}</li>`)
        .join("");
      html.push(`<ul class="list-disc pl-6 space-y-1">${items}</ul>`);
      continue;
    }

    if (block.startsWith("### ")) {
      html.push(
        `<h3 class="mt-5 mb-1 text-sm font-semibold uppercase tracking-wide text-slate-600">${inline(block.slice(4))}</h3>`,
      );
      continue;
    }
    if (block.startsWith("## ")) {
      html.push(
        `<h2 class="mt-6 mb-2 border-b border-slate-300 pb-1 text-base font-bold text-slate-900">${inline(block.slice(3))}</h2>`,
      );
      continue;
    }

    html.push(
      `<p class="mb-3 leading-relaxed">${lines.map((l) => inline(l)).join("<br />")}</p>`,
    );
  }

  return html.join("\n");
}

function inline(text: string): string {
  return escapeHtml(text).replace(
    /\*\*(.+?)\*\*/g,
    '<strong class="font-semibold text-slate-900">$1</strong>',
  );
}

/** Read submitted FormData into the value shape stored in FormInstance.dataJson. */
export function collectValues(formData: FormData, fields: FieldDef[]): FormValues {
  const values: FormValues = {};

  for (const field of fields) {
    if (field.type === "heading") continue;

    if (field.type === "checklist") {
      values[field.key] = formData.getAll(`field.${field.key}`).map(String);
      continue;
    }
    if (field.type === "checkbox") {
      values[field.key] = formData.get(`field.${field.key}`) != null;
      continue;
    }
    const raw = formData.get(`field.${field.key}`);
    values[field.key] = typeof raw === "string" ? raw : "";
  }

  return values;
}

/** Which required fields are still blank. Empty array means ready to sign. */
export function missingRequired(values: FormValues, fields: FieldDef[]): FieldDef[] {
  return fields.filter((field) => {
    if (!field.required || field.type === "heading") return false;
    const value = values[field.key];
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "boolean") return !value;
    return value == null || String(value).trim() === "";
  });
}
