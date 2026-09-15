"use server";

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
    return error.code === "invalid_credentials"
      ? { error: "That email and password don’t match — try again.", email }
      : { error: "Couldn’t reach the login service — try again in a moment.", email };
  }
  redirect("/");
}

export async function logout() {
  const supabase = await createSessionClient();
  // "local" ends only this device's session — the default "global" would also
  // sign the user out on every other phone or laptop
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
