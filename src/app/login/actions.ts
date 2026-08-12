"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, authTokenFor } from "@/lib/auth";

export type LoginState = { error: string } | null;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = process.env.SITE_PASSWORD;
  // Gate is off (e.g. local dev) — nothing to check
  if (!password) redirect("/");

  const submitted = formData.get("password");
  if (typeof submitted !== "string" || submitted !== password) {
    return { error: "That’s not it — check the password and try again." };
  }

  (await cookies()).set(AUTH_COOKIE, await authTokenFor(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/");
}
