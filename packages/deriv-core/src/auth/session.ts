import type { AuthInfo } from '../types';
import { storeAuthInfo, clearAuthInfo } from './storage';

export async function restoreDerivSession(): Promise<AuthInfo | null> {
  const response = await fetch('/api/deriv/session', { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not check your Deriv session.');
  const data = await response.json();
  if (!data.authenticated) { clearAuthInfo(); return null; }
  // Template compatibility marker, never a provider token or usable credential.
  const session: AuthInfo = { access_token: 'server-session', token_type: 'Session', expires_at: data.expires_at,
    expires_in: Math.max(0, data.expires_at - Math.floor(Date.now() / 1000)), scope: 'trade', refresh_token: '' };
  storeAuthInfo(session);
  return session;
}
