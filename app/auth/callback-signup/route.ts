import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");

  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/auth/callback?${searchParams.toString()}`);
  }

  if (code) {
    const supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!profile) {
          await supabase.from("profiles").upsert({
            user_id: user.id,
            email: user.email || "",
            role: "viewer",
            status: "active",
            registration_complete: false,
          });
        }

        const finalResponse = NextResponse.redirect(`${origin}/onboarding/email-verified`);
        supabaseResponse.cookies.getAll().forEach((cookie) => {
          finalResponse.cookies.set(cookie.name, cookie.value);
        });
        return finalResponse;
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
