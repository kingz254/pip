import { corsHeaders, json } from '../_shared/cors.ts';

Deno.serve((req) => {
  const cors = corsHeaders(req, Deno.env.get('ALLOWED_ORIGIN'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  return json({ error: 'Card and M-Pesa checkout are disabled. Use the USDT TRC20 checkout.' }, 410, cors);
});
