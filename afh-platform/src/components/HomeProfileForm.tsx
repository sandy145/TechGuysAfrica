import type { Home } from "@prisma/client";
import { saveHomeAction } from "@/app/actions/auth";
import {
  parseJsonArray,
  SPECIALTIES,
  SPECIALTY_LABELS,
  WA_COUNTIES,
  type Specialty,
} from "@/lib/constants";
import { toDateInput } from "@/lib/dates";

/**
 * The home profile is not administrative trivia — every answer here switches
 * rules on or off in the compliance engine, so each toggle says what it drives.
 */
const PROFILE_FLAGS: Array<{
  name: keyof Home;
  label: string;
  help: string;
}> = [
  {
    name: "employsStaff",
    label: "I employ caregivers or other staff",
    help: "Turns on employee-file requirements: background checks, training, TB screening.",
  },
  {
    name: "providerIsResident",
    label: "The provider lives in the home",
    help: "Affects staffing-coverage and absence-notification expectations.",
  },
  {
    name: "hasResidentManager",
    label: "A resident manager runs the home day to day",
    help: "Adds resident-manager qualification and documentation requirements.",
  },
  {
    name: "servesMedicaid",
    label: "We serve Medicaid clients",
    help: "Adds contract, rate, and Medicaid-specific record requirements.",
  },
  {
    name: "usesNurseDelegation",
    label: "We use nurse delegation",
    help: "Adds delegation consent, RN visit, and caregiver delegation-training records.",
  },
  {
    name: "multipleFacilities",
    label: "I operate more than one adult family home",
    help: "Adds oversight documentation expected of multi-home providers.",
  },
];

export function HomeProfileForm({
  home,
  submitLabel,
}: {
  home: Home | null;
  submitLabel: string;
}) {
  const specialties = parseJsonArray<Specialty>(home?.specialties);

  return (
    <form action={saveHomeAction} className="space-y-8">
      <fieldset className="space-y-4">
        <legend className="text-sm font-bold uppercase tracking-wide text-slate-500">
          The home
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="name">
              Home name <span className="text-red-600">*</span>
            </label>
            <input id="name" name="name" required defaultValue={home?.name ?? ""} className="input" />
          </div>

          <div>
            <label className="label" htmlFor="licenseNumber">
              License number
            </label>
            <input
              id="licenseNumber"
              name="licenseNumber"
              defaultValue={home?.licenseNumber ?? ""}
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="licensedAt">
              Initially licensed
            </label>
            <input
              id="licensedAt"
              name="licensedAt"
              type="date"
              defaultValue={toDateInput(home?.licensedAt)}
              className="input"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label" htmlFor="addressLine1">
              Street address
            </label>
            <input
              id="addressLine1"
              name="addressLine1"
              defaultValue={home?.addressLine1 ?? ""}
              className="input"
            />
          </div>

          <div>
            <label className="label" htmlFor="city">
              City
            </label>
            <input id="city" name="city" defaultValue={home?.city ?? ""} className="input" />
          </div>

          <div>
            <label className="label" htmlFor="zip">
              ZIP
            </label>
            <input id="zip" name="zip" defaultValue={home?.zip ?? ""} className="input" />
          </div>

          <div>
            <label className="label" htmlFor="county">
              County
            </label>
            <select id="county" name="county" defaultValue={home?.county ?? ""} className="input">
              <option value="">Select a county…</option>
              {WA_COUNTIES.map((county) => (
                <option key={county} value={county}>
                  {county}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Used to filter the citation board. Never shown with your identity attached.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="phone">
              Phone
            </label>
            <input id="phone" name="phone" defaultValue={home?.phone ?? ""} className="input" />
          </div>

          <div>
            <label className="label" htmlFor="bedCapacity">
              Licensed bed capacity
            </label>
            <input
              id="bedCapacity"
              name="bedCapacity"
              type="number"
              min={1}
              max={8}
              defaultValue={home?.bedCapacity ?? 6}
              className="input"
            />
            <p className="mt-1 text-xs text-slate-500">
              Homes licensed for seven or eight beds carry extra requirements.
            </p>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Specialty designations
        </legend>
        <p className="text-sm text-slate-600">
          Each designation adds its own training and care-plan requirements.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {SPECIALTIES.map((specialty) => (
            <label
              key={specialty}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm hover:bg-slate-50"
            >
              <input
                type="checkbox"
                name="specialties"
                value={specialty}
                defaultChecked={specialties.includes(specialty)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span>{SPECIALTY_LABELS[specialty]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-bold uppercase tracking-wide text-slate-500">
          How the home operates
        </legend>
        <div className="space-y-2">
          {PROFILE_FLAGS.map((flag) => (
            <label
              key={String(flag.name)}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-2.5 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                name={String(flag.name)}
                defaultChecked={
                  home ? Boolean(home[flag.name]) : flag.name === "employsStaff"
                }
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span>
                <span className="block text-sm font-medium text-slate-800">{flag.label}</span>
                <span className="block text-xs text-slate-500">{flag.help}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <button type="submit" className="btn-primary">
        {submitLabel}
      </button>
    </form>
  );
}
