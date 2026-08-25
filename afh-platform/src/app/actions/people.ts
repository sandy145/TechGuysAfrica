"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireHome } from "@/lib/auth";
import { parseDateInput } from "@/lib/dates";
import { EMPLOYEE_ROLES, oneOf, type EmployeeRole } from "@/lib/constants";

function str(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "" ? null : text;
}

/** Keep the denormalised resident count on Home in step with reality. */
async function syncResidentCount(homeId: string): Promise<void> {
  const residentCount = await prisma.resident.count({
    where: { homeId, dischargedAt: null },
  });
  await prisma.home.update({ where: { id: homeId }, data: { residentCount } });
}

export async function saveResidentAction(formData: FormData): Promise<void> {
  const user = await requireHome();
  const id = str(formData.get("id"));

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  if (!firstName || !lastName) {
    redirect(`/residents?error=${encodeURIComponent("First and last name are required.")}`);
  }

  const data = {
    firstName,
    lastName,
    dateOfBirth: parseDateInput(formData.get("dateOfBirth")),
    admittedAt: parseDateInput(formData.get("admittedAt")),
    dischargedAt: parseDateInput(formData.get("dischargedAt")),
    hasDementiaDiagnosis: formData.get("hasDementiaDiagnosis") != null,
    hasMentalHealthDiagnosis: formData.get("hasMentalHealthDiagnosis") != null,
    hasDevelopmentalDisability: formData.get("hasDevelopmentalDisability") != null,
    isMedicaid: formData.get("isMedicaid") != null,
    selfAdministersMedication: formData.get("selfAdministersMedication") != null,
    notes: str(formData.get("notes")),
  };

  if (id) {
    // Scoping the update by homeId as well as id keeps one home from editing
    // another's records by guessing an identifier.
    const owned = await prisma.resident.findFirst({
      where: { id, homeId: user.homeId },
      select: { id: true },
    });
    if (!owned) redirect("/residents?error=Resident%20not%20found.");
    await prisma.resident.update({ where: { id }, data });
  } else {
    await prisma.resident.create({ data: { ...data, homeId: user.homeId } });
  }

  await syncResidentCount(user.homeId);
  revalidatePath("/residents");
  revalidatePath("/dashboard");
  redirect(id ? `/residents/${id}?saved=1` : "/residents?saved=1");
}

export async function deleteResidentAction(formData: FormData): Promise<void> {
  const user = await requireHome();
  const id = String(formData.get("id") ?? "");

  const owned = await prisma.resident.findFirst({
    where: { id, homeId: user.homeId },
    select: { id: true },
  });
  if (owned) {
    // Cascades to that resident's documents and form instances by design: a
    // deleted resident record should not leave orphaned PHI behind.
    await prisma.resident.delete({ where: { id } });
    await syncResidentCount(user.homeId);
  }

  revalidatePath("/residents");
  revalidatePath("/dashboard");
  redirect("/residents");
}

export async function saveEmployeeAction(formData: FormData): Promise<void> {
  const user = await requireHome();
  const id = str(formData.get("id"));

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  if (!firstName || !lastName) {
    redirect(`/employees?error=${encodeURIComponent("First and last name are required.")}`);
  }

  const data = {
    firstName,
    lastName,
    role: oneOf(EMPLOYEE_ROLES, formData.get("role"), "CAREGIVER" as EmployeeRole),
    email: str(formData.get("email")),
    phone: str(formData.get("phone")),
    hiredAt: parseDateInput(formData.get("hiredAt")),
    terminatedAt: parseDateInput(formData.get("terminatedAt")),
    credentialNumber: str(formData.get("credentialNumber")),
    hasDirectResidentContact: formData.get("hasDirectResidentContact") != null,
    notes: str(formData.get("notes")),
  };

  if (id) {
    const owned = await prisma.employee.findFirst({
      where: { id, homeId: user.homeId },
      select: { id: true },
    });
    if (!owned) redirect("/employees?error=Employee%20not%20found.");
    await prisma.employee.update({ where: { id }, data });
  } else {
    await prisma.employee.create({ data: { ...data, homeId: user.homeId } });
  }

  revalidatePath("/employees");
  revalidatePath("/dashboard");
  redirect(id ? `/employees/${id}?saved=1` : "/employees?saved=1");
}

export async function deleteEmployeeAction(formData: FormData): Promise<void> {
  const user = await requireHome();
  const id = String(formData.get("id") ?? "");

  const owned = await prisma.employee.findFirst({
    where: { id, homeId: user.homeId },
    select: { id: true },
  });
  if (owned) await prisma.employee.delete({ where: { id } });

  revalidatePath("/employees");
  revalidatePath("/dashboard");
  redirect("/employees");
}
