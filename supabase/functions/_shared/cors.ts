export function corsHeaders(req: Request, allowed: string | undefined): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allow = !allowed || allowed === '*' ? '*' : allowed.split(',').map((s) => s.trim()).includes(origin) ? origin : allowed.split(',')[0].trim();
  return {
    'Access-Control-Allow-Origin': allow, 'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}
export const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
