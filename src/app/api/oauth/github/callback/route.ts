import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { env, features } from "@/lib/env";
import { getCurrentUser, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";

/**
 * GitHub OAuth callback: verify state, exchange the code for an access token,
 * look up the connected account's login, and store both on the company.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", env.APP_URL));
  if (!can.manageCompany(user.role) || !features.github) {
    return NextResponse.redirect(new URL("/settings?error=forbidden", env.APP_URL));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = cookies().get("gh_oauth_state")?.value;
  cookies().delete("gh_oauth_state");

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(new URL("/settings?error=oauth_state", env.APP_URL));
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${env.APP_URL}/api/oauth/github/callback`,
      }),
    });
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
    };
    if (!tokenJson.access_token) {
      return NextResponse.redirect(
        new URL(`/settings?error=${tokenJson.error ?? "token_exchange"}`, env.APP_URL)
      );
    }

    const meRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        Accept: "application/vnd.github+json",
      },
    });
    const me = (await meRes.json()) as { login?: string };

    await db.company.update({
      where: { id: user.companyId },
      data: {
        githubConnected: true,
        githubLogin: me.login ?? null,
        githubAccessToken: encryptSecret(tokenJson.access_token), // encrypted at rest
      },
    });

    return NextResponse.redirect(new URL("/settings?connected=1", env.APP_URL));
  } catch {
    return NextResponse.redirect(new URL("/settings?error=oauth_failed", env.APP_URL));
  }
}
