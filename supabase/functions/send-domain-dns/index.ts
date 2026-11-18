import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import nodemailer from "npm:nodemailer@9.1.1";
import { corsHeaders, json } from "../_shared/cors.ts";

const SENDER = "Pipforge <pipforgeapp@gmail.com>";
const EMAIL = "pipforgeapp@gmail.com";
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

Deno.serve(async (req) => {
  const cors = corsHeaders(req, Deno.env.get("ALLOWED_ORIGIN"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405, cors);
  }

  let body: { site_id?: unknown; dns_records?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400, cors);
  }
  if (
    typeof body.site_id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.site_id)
  ) return json({ error: "invalid site" }, 400, cors);
  if (
    typeof body.dns_records !== "string" || !body.dns_records.trim() ||
    body.dns_records.length > 6000
  ) {
    return json(
      { error: "paste DNS records (maximum 6,000 characters)" },
      400,
      cors,
    );
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const authorization = req.headers.get("Authorization") ?? "";
  const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user: caller }, error: authError } = await user.auth
    .getUser();
  if (authError || !caller) {
    return json({ error: "sign in required" }, 401, cors);
  }
  const { data: isAdmin, error: adminError } = await user.rpc("is_admin");
  if (adminError || isAdmin !== true) {
    return json({ error: "admins only" }, 403, cors);
  }
  const password = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!password) {
    return json(
      {
        error:
          "DNS email is not configured. Ask the Pipforge admin to configure Gmail.",
      },
      503,
      cors,
    );
  }

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: site, error: siteError } = await admin.from("sites")
    .select("id,owner,name,domain").eq("id", body.site_id).maybeSingle();
  if (siteError || !site) {
    return json({ error: "client site not found" }, 404, cors);
  }
  if (
    !site.domain ||
    !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i
      .test(site.domain)
  ) {
    return json(
      { error: "client site does not have a valid domain" },
      409,
      cors,
    );
  }

  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("email,full_name").eq("id", site.owner).maybeSingle();
  if (
    profileError || !profile?.email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)
  ) return json({ error: "client email is missing or invalid" }, 409, cors);

  const name = profile.full_name || "Client";
  const records = body.dns_records.trim();
  const text =
    `Pipforge domain setup instructions\n\nHi ${name},\n\nAdd these Pipforge website DNS records in the DNS settings at your domain registrar. They route ${site.domain} to your Pipforge website:\n\n${records}\n\nBefore saving, review existing records for the same website host names (usually @ and www). Remove or replace only conflicting A, AAAA, or CNAME records that point those website names somewhere else. Do not delete MX records or email-related TXT records such as SPF, DKIM, or DMARC. Keep nameserver and other service records unless your registrar or Pipforge specifically tells you otherwise. If you are unsure, stop and ask before deleting a record.\n\nDeriv domain verification is separate from website routing. Open your Deriv Developer Dashboard and complete any domain ownership verification it requests. If Deriv gives you TXT or CNAME records, add those exact records as additional DNS records at your registrar. Keep them alongside the Pipforge website records; do not substitute them for the website records.\n\nDNS changes can take time to update. Once Vercel detects the website records, it will issue the site’s SSL certificate automatically. You own the domain and handle renewals directly with your registrar. Never send anyone your registrar password.\n\nNeed help? Contact ${EMAIL}.`;
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#20242b;line-height:1.6"><h1 style="color:#ef4c58">Connect your Pipforge website</h1><p>Hi ${
      escapeHtml(name)
    },</p><p>Add these Pipforge website DNS records in the DNS settings at your domain registrar. They route <b>${
      escapeHtml(site.domain)
    }</b> to your Pipforge website.</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;background:#f3f4f6;border:1px solid #d5d8dc;border-radius:8px;font:14px/1.5 monospace">${
      escapeHtml(records)
    }</pre><h2>Before changing existing records</h2><p>Review records for the same website host names, usually <b>@</b> and <b>www</b>. Remove or replace only conflicting A, AAAA, or CNAME records that point those website names somewhere else. <b>Do not delete MX records or email-related TXT records such as SPF, DKIM, or DMARC.</b> Keep nameserver and other service records unless your registrar or Pipforge specifically tells you otherwise. If you are unsure, stop and ask before deleting a record.</p><h2>Verify your domain with Deriv</h2><p>Deriv domain verification is separate from website routing. Open your Deriv Developer Dashboard and complete any domain ownership verification it requests. If Deriv gives you TXT or CNAME records, add those exact records as additional DNS records at your registrar. Keep them alongside the Pipforge website records; do not substitute them for the website records.</p><p>DNS changes can take time to update. Once Vercel detects the website records, it will issue the SSL certificate automatically. You own the domain and handle renewals directly with your registrar. Never send anyone your registrar password.</p><p>Need help? Contact <a href="mailto:${EMAIL}">${EMAIL}</a>.</p></div>`;
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: EMAIL, pass: password },
  });
  try {
    await transport.sendMail({
      from: SENDER,
      to: profile.email,
      subject: `Pipforge website DNS instructions for ${site.domain}`,
      text,
      html,
    });
    return json({ sent: true, to: profile.email }, 200, cors);
  } catch (error) {
    const detail = error instanceof Error
      ? error.message.slice(0, 300)
      : "mail delivery failed";
    console.error("Pipforge DNS instruction email failed:", detail);
    return json(
      {
        error:
          "DNS instructions could not be emailed. Check Gmail configuration and try again.",
      },
      502,
      cors,
    );
  } finally {
    transport.close();
  }
});
