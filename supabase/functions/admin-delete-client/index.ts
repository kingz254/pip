import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { corsHeaders, json } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const cors = corsHeaders(req, Deno.env.get("ALLOWED_ORIGIN"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405, cors);

  let body: { user_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400, cors);
  }
  if (typeof body.user_id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.user_id)) {
    return json({ error: "invalid client" }, 400, cors);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const authorization = req.headers.get("Authorization") ?? "";
  const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user: caller }, error: authError } = await user.auth.getUser();
  if (authError || !caller) return json({ error: "sign in required" }, 401, cors);
  const { data: isAdmin, error: adminError } = await user.rpc("is_admin");
  if (adminError || isAdmin !== true) return json({ error: "admins only" }, 403, cors);
  if (caller.id === body.user_id) return json({ error: "cannot delete the signed-in admin" }, 400, cors);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: protectedAdmin, error: protectedError } = await admin.from("admins")
    .select("user_id").eq("user_id", body.user_id).maybeSingle();
  if (protectedError) return json({ error: "could not verify client account" }, 500, cors);
  if (protectedAdmin) return json({ error: "admin accounts cannot be deleted here" }, 409, cors);

  const { error: ordersError } = await admin.from("orders").delete().eq("owner", body.user_id);
  if (ordersError) return json({ error: "could not remove client orders and payment records" }, 500, cors);
  const { error: deleteError } = await admin.auth.admin.deleteUser(body.user_id);
  if (deleteError) return json({ error: "could not delete client account and linked site records" }, 500, cors);
  return json({ deleted: true }, 200, cors);
});
