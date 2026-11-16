import type { AuthConfig, AuthInfo, CallbackParams, TokenExchangeParams } from '../types';
import { restoreDerivSession } from './session';

export async function buildAuthorizationUrl(_config: AuthConfig): Promise<string> {
  const url = new URL('/api/deriv/login', window.location.origin);
  const target = window.top && window.top.location.origin === window.location.origin ? window.top.location.href : window.location.href;
  url.searchParams.set('return', target);
  return url.href;
}
export async function buildSignUpUrl(config: AuthConfig): Promise<string> {
  const url = new URL(await buildAuthorizationUrl(config)); url.searchParams.set('signup','1'); return url.href;
}
export async function initiateLogin(config: AuthConfig): Promise<void> { window.top!.location.href = await buildAuthorizationUrl(config); }
export async function initiateSignUp(config: AuthConfig): Promise<void> { window.top!.location.href = await buildSignUpUrl(config); }
export function parseCallbackParams(value: string): CallbackParams {
  const u=new URL(value);return {code:u.searchParams.get('code'),state:u.searchParams.get('state'),error:u.searchParams.get('error')};
}
export function validateCallback(_params: CallbackParams,_redirectUri:string): string { throw new Error('OAuth callbacks are handled by the server.'); }
export async function exchangeCodeForTokens(_params: TokenExchangeParams): Promise<AuthInfo> { throw new Error('OAuth exchange is server-only.'); }
export async function refreshAccessToken(_token:string,_clientId:string): Promise<AuthInfo> { throw new Error('Please sign in again when your session expires.'); }
export async function handleOAuthCallback(_url:string,_config:AuthConfig): Promise<AuthInfo> {
  const session=await restoreDerivSession();if(!session)throw new Error('Please sign in again.');return session;
}
export function cleanupUrl(_base:string): void {
  const u=new URL(window.location.href);for(const k of ['code','state','scope','error','error_description'])u.searchParams.delete(k);
  window.history.replaceState(window.history.state,'',u.pathname+u.search+u.hash);
}
export class OAuthError extends Error {}
