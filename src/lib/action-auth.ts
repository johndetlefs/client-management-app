"use client";

import { auth } from "@/lib/firebase";

/** Pass the current credential explicitly; a tenant/user/role argument is never a credential. */
export async function requireActionIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in before continuing");
  return user.getIdToken();
}
