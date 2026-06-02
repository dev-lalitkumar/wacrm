import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { getGmailTokens, sendEmail } from "@/lib/gmail/client";

const SUPPORT_EMAIL = "support.crm@tundla.com";

/**
 * POST /api/contact
 *
 * Public contact / demo-request form. Validates the payload then makes a
 * best-effort attempt to email the support inbox via the connected Gmail
 * account. If Gmail isn't configured, we log and still return success so the
 * visitor gets a friendly confirmation — the submission is never lost to them.
 *
 * Body: { name, email, company?, message, website? (honeypot) }
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const company = String(body.company ?? "").trim();
  const message = String(body.message ?? "").trim();
  const honeypot = String(body.website ?? "").trim();

  // Bot trap: a filled hidden "website" field means a bot — accept silently.
  if (honeypot) {
    return NextResponse.json({ ok: true });
  }

  if (!name || name.length > 120) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
  }
  if (!message || message.length < 5 || message.length > 5000) {
    return NextResponse.json({ error: "Please enter a message." }, { status: 400 });
  }

  const subject = `New demo request from ${name}${company ? ` (${company})` : ""}`;
  const bodyText = [
    "New contact / demo request from the Tundla CRM website:",
    "",
    `Name:    ${name}`,
    `Email:   ${email}`,
    `Company: ${company || "—"}`,
    "",
    "Message:",
    message,
  ].join("\n");

  // Best-effort delivery — never block the user on email config.
  try {
    const admin = supabaseAdmin();
    const tokens = await getGmailTokens(admin);
    await sendEmail(tokens.accessToken, {
      from: tokens.email,
      to: [SUPPORT_EMAIL],
      subject,
      bodyText,
    });
  } catch (err) {
    console.error("[api/contact] could not send email:", err);
    // Swallow — still return success to the visitor.
  }

  return NextResponse.json({ ok: true });
}
