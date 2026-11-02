"use server";

import { initializeVerifiedAccount } from "@/lib/business/initialize-account";
import { BusinessError } from "@/lib/business/errors";

/** Compatibility entry point uses the same authenticated setup as the API route. */
export async function initializeNewUser(userId: string, email: string, idToken: string) {
  try {
    await initializeVerifiedAccount(userId, email, idToken);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof BusinessError ? error.message : "Unable to initialize account", code: error instanceof BusinessError ? error.code : "VALIDATION_ERROR" };
  }
}
