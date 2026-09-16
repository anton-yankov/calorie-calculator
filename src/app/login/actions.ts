"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase-session";

type LoginState = { error: string; email: string } | null;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Enter your email and password.", email };
  }

  // On success the session client writes the session cookies onto this response
  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // One message for a wrong email or a wrong password, so the form never
    // reveals which emails have accounts
    if (error.code === "invalid_credentials") {
      return { error: "That email and password don’t match — try again.", email };
    }
    if (error.code === "over_request_rate_limit") {
      return { error: "Too many attempts — wait a minute and try again.", email };
    }
    if (error.code === "user_banned") return { error: "This account is disabled.", email };
    // A server or network problem, rather than anything the user typed
    if (!error.status || error.status >= 500) {
      return { error: "Couldn’t reach the login service — try again in a moment.", email };
    }
    return { error: "Couldn’t log you in — try again.", email };
  }
  redirect("/");
}

export async function logout() {
  const supabase = await createSessionClient();
  // "local" ends only this device's session — the default "global" would also
  // sign the user out on every other phone or laptop
  await supabase.auth.signOut({ scope: "local" });
  // Clears the cached pages of the user who just left, so pressing Back after
  // the next login can't show their data
  revalidatePath("/", "layout");
  redirect("/login");
}
