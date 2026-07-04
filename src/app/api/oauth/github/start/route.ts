import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { env, features } from "@/lib/env";
import { getCurrentUser, can } from "@/lib/auth";

/**
 * Kick off the GitHub OAuth web flow. We store a random `state` in a cookie to
 * defend against CSRF and verify it on callback.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", env.APP_URL));
  if (!can.manageCompany(user.role)) {
    return NextResponse.redirect(new URL("/settings?error=forbidden", env.APP_URL));
  }
  if (!features.github) {
    return NextResponse.redirect(new URL("/settings?error=github_not_configured", env.APP_URL));
  }

  const state = crypto.randomBytes(16).toString("hex");
  cookies().set("gh_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorize.searchParams.set(
    "redirect_uri",
    `${env.APP_URL}/api/oauth/github/callback`
  );
  authorize.searchParams.set("scope", "repo read:user");
  authorize.searchParams.set("state", state);

  return NextResponse.redirect(authorize.toString());
}
