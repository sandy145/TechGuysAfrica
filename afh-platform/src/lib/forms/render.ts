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
 *
 * Parsed line by line rather than by blank-line-delimited block, so a heading
 * immediately followed by its content stays a heading and the content below it
 * stays a paragraph. Grouping them would render an entire answer in heading
 * style, and template authors — including providers editing their own forms —
 * should not have to know about a blank-line rule to avoid that.
 */
export function renderBody(filled: string): string {
  const lines = filled.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];

  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(
      `<p class="mb-3 leading-relaxed">${paragraph.map((l) => inline(l)).join("<br />")}</p>`,
    );
    paragraph = [];
  };

  const flushList = () => {
    if (list.length === 0) return;
    const items = list.map((item) => `<li>${inline(item)}</li>`).join("");
    html.push(`<ul class="mb-3 list-disc space-y-1 pl-6">${items}</ul>`);
    list = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (line === "") {
      flushAll();
      continue;
    }

    if (line === "---") {
      flushAll();
      html.push('<hr class="my-4 border-slate-300" />');
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      list.push(line.slice(2));
      continue;
    }

    if (line.startsWith("### ")) {
      flushAll();
      html.push(
        `<h3 class="mb-1 mt-5 text-sm font-semibold uppercase tracking-wide text-slate-600">${inline(line.slice(4))}</h3>`,
      );
      continue;
    }

    if (line.startsWith("## ")) {
      flushAll();
      html.push(
        `<h2 class="mb-2 mt-6 border-b border-slate-300 pb-1 text-base font-bold text-slate-900">${inline(line.slice(3))}</h2>`,
      );
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushAll();
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
