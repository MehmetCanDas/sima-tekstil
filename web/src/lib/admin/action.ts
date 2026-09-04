import "server-only";

import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { PermissionError } from "@/lib/auth/dal";

/* ---------------------------------------------------------------------------
 * Server action sonuc sozlesmesi.
 *
 * Action'lar exception firlatmak yerine { ok, error } doner; formlar bu sonucu
 * useActionState ile okuyup toast/alan hatasi gosterir. Beklenmeyen hatalar
 * loglanir ve kullaniciya genel mesaj doner (ic detay sizmaz).
 * ------------------------------------------------------------------------ */

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data?: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(
  error: string,
  fieldErrors?: Record<string, string>,
): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** Zod hatalarini alan -> mesaj sozlugune cevirir. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * Her server action'i saran hata siniri. redirect() gibi Next'in kontrol akisi
 * icin kullandigi hatalar oldugu gibi yeniden firlatilir.
 */
export async function guard<T>(
  run: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await run();
  } catch (error) {
    // redirect()/notFound() gibi Next kontrol akisi hatalarini yutma.
    unstable_rethrow(error);
    if (error instanceof PermissionError) return fail(error.message);
    if (error instanceof z.ZodError) {
      return fail("Form eksik veya hatalı.", fieldErrorsOf(error));
    }
    if (isUniqueViolation(error)) {
      return fail("Bu kayıt zaten var (benzersiz alan çakışması).");
    }
    console.error("[action]", error);
    return fail("Beklenmeyen bir hata oluştu. Kayıt değiştirilmedi.");
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String((error as { code: unknown }).code).startsWith("SQLITE_CONSTRAINT")
  );
}
