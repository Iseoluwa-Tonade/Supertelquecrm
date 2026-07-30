import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const flow = searchParams.get("flow");

  console.log("[AUTH] Callback GET: started", { hasCode: !!code, type, flow, origin });

  if (type === "recovery") {
    const supabaseResponse = NextResponse.next({ request });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    if (code) {
      console.log("[AUTH] Callback: exchanging code for recovery session");
      await supabase.auth.exchangeCodeForSession(code);
    }

    const finalResponse = NextResponse.redirect(`${origin}/auth/reset-password`);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      finalResponse.cookies.set(cookie.name, cookie.value);
    });
    console.log("[AUTH] Callback: redirecting to reset-password");
    return finalResponse;
  }

  if (code) {
    let redirectUrl = `${origin}/login?error=auth_failed`;
    const supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    console.log("[AUTH] Callback: exchangeCodeForSession result", { error: error?.message });
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      console.log("[AUTH] Callback: getUser result", { userId: user?.id, email: user?.email });

      if (flow === "signup") {
        console.log("[AUTH] Callback: signup flow detected, redirecting to email-verified");
        redirectUrl = `${origin}/onboarding/email-verified`;
      } else if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("organisation_id, registration_complete")
          .eq("user_id", user.id)
          .maybeSingle();

        console.log("[AUTH] Callback: profile lookup", { profile: profile ? { orgId: profile.organisation_id, regComplete: profile.registration_complete } : null });

        if (!profile) {
          console.log("[AUTH] Callback: no profile, upserting and redirecting to /profile");
          await supabase.from("profiles").upsert({
            user_id: user.id,
            email: user.email || "",
            role: "viewer",
            status: "active",
            registration_complete: false,
          });
          redirectUrl = `${origin}/profile`;
        } else if (!profile.registration_complete) {
          console.log("[AUTH] Callback: registration incomplete, redirecting to /profile");
          redirectUrl = `${origin}/profile`;
        } else {
          console.log("[AUTH] Callback: registration complete, redirecting to /overview");
          redirectUrl = `${origin}/overview`;
        }
      }
    } else {
      console.log("[AUTH] Callback: exchange failed, redirecting with error");
    }

    const finalResponse = NextResponse.redirect(redirectUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      finalResponse.cookies.set(cookie.name, cookie.value);
    });
    return finalResponse;
  }

  console.log("[AUTH] Callback: no code provided, redirecting with auth_failed");
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
