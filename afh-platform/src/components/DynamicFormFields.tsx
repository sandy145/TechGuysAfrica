import type { FieldDef, FormValues } from "@/lib/forms/types";

/**
 * Renders a FormTemplate's JSON field definitions as real inputs. Names are
 * prefixed `field.` so collectValues() can pick them out of the FormData
 * without colliding with the form's own control fields.
 */
export function DynamicFormFields({
  fields,
  values = {},
}: {
  fields: FieldDef[];
  values?: FormValues;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => {
        const name = `field.${field.key}`;
        const current = values[field.key];
        const span = field.width === "half" ? "sm:col-span-1" : "sm:col-span-2";

        if (field.type === "heading") {
          return (
            <h3
              key={field.key}
              className="sm:col-span-2 mt-2 border-b border-slate-200 pb-1 text-sm font-bold uppercase tracking-wide text-slate-600"
            >
              {field.label}
            </h3>
          );
        }

        return (
          <div key={field.key} className={span}>
            <label className="label" htmlFor={name}>
              {field.label}
              {field.required && <span className="text-red-600"> *</span>}
            </label>

            {field.type === "textarea" && (
              <textarea
                id={name}
                name={name}
                rows={4}
                required={field.required}
                placeholder={field.placeholder}
                defaultValue={asText(current) || field.defaultValue || ""}
                className="input"
              />
            )}

            {(field.type === "text" || field.type === "date" || field.type === "number") && (
              <input
                id={name}
                name={name}
                type={field.type === "text" ? "text" : field.type}
                required={field.required}
                placeholder={field.placeholder}
                defaultValue={asText(current) || field.defaultValue || ""}
                className="input"
              />
            )}

            {field.type === "select" && (
              <select
                id={name}
                name={name}
                required={field.required}
                defaultValue={asText(current) || field.defaultValue || ""}
                className="input"
              >
                <option value="">Select…</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}

            {field.type === "radio" && (
              <div className="flex flex-wrap gap-3 pt-1">
                {(field.options ?? []).map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name={name}
                      value={option}
                      required={field.required}
                      defaultChecked={asText(current) === option}
                      className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    {option}
                  </label>
                ))}
              </div>
            )}

            {field.type === "checkbox" && (
              <label className="flex items-center gap-2 pt-1 text-sm text-slate-700">
                <input
                  id={name}
                  type="checkbox"
                  name={name}
                  defaultChecked={current === true}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                {field.placeholder ?? "Yes"}
              </label>
            )}

            {field.type === "checklist" && (
              <div className="space-y-1.5 pt-1">
                {(field.options ?? []).map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name={name}
                      value={option}
                      defaultChecked={Array.isArray(current) && current.includes(option)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    {option}
                  </label>
                ))}
              </div>
            )}

            {field.help && <p className="mt-1 text-xs text-slate-500">{field.help}</p>}
          </div>
        );
      })}
    </div>
  );
}

function asText(value: string | string[] | boolean | undefined): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}
