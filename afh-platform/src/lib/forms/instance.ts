import "server-only";
import type { FormInstance, FormTemplate } from "@prisma/client";
import { prisma } from "../db";
import { parseJsonArray, parseJsonObject } from "../constants";
import { fillTokens, missingRequired, renderBody } from "./render";
import type { FieldDef, FormValues, SignerDef } from "./types";

/**
 * Helpers shared by the form server actions and the pages that render forms.
 * Kept out of the "use server" module because everything exported from one of
 * those becomes a callable server action.
 */

export function templateFields(template: FormTemplate): FieldDef[] {
  return parseJsonArray<FieldDef>(template.fieldsJson);
}

export function templateSigners(template: FormTemplate): SignerDef[] {
  return parseJsonArray<SignerDef>(template.signersJson);
}

export function instanceValues(instance: FormInstance): FormValues {
  return parseJsonObject<FormValues>(instance.dataJson);
}

/** Tokens every template can use on top of its own fields. */
export async function contextTokens(
  instance: FormInstance,
): Promise<Record<string, string>> {
  const [home, resident, employee] = await Promise.all([
    prisma.home.findUnique({ where: { id: instance.homeId } }),
    instance.residentId
      ? prisma.resident.findUnique({ where: { id: instance.residentId } })
      : null,
    instance.employeeId
      ? prisma.employee.findUnique({ where: { id: instance.employeeId } })
      : null,
  ]);

  return {
    home_name: home?.name ?? "",
    home_license: home?.licenseNumber ?? "",
    home_address:
      [home?.addressLine1, home?.city, home?.zip].filter(Boolean).join(", ") || "",
    home_phone: home?.phone ?? "",
    resident_name: resident ? `${resident.firstName} ${resident.lastName}` : "",
    employee_name: employee ? `${employee.firstName} ${employee.lastName}` : "",
    today: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  };
}

/**
 * Rendered document body. A completed instance returns its stored snapshot, so
 * a later edit to the template can never change what somebody signed.
 */
export async function renderInstance(
  instance: FormInstance & { template: FormTemplate },
): Promise<string> {
  if (instance.renderedBody) return instance.renderedBody;
  return renderBody(
    fillTokens(
      instance.template.bodyTemplate,
      instanceValues(instance),
      templateFields(instance.template),
      await contextTokens(instance),
    ),
  );
}

export function checkMissingFields(
  instance: FormInstance & { template: FormTemplate },
): FieldDef[] {
  return missingRequired(instanceValues(instance), templateFields(instance.template));
}
