export type ClientSiteTheme = 'light' | 'dark';

export function listenForClientSiteTheme(onTheme: (theme: ClientSiteTheme) => void) {
  const apply = (theme: unknown) => {
    if (theme === 'light' || theme === 'dark') onTheme(theme);
  };
  const handleMessage = (event: MessageEvent) => {
    if (
      event.source === window.parent &&
      event.origin === window.location.origin &&
      event.data?.type === 'PF_SITE_BRANDING'
    ) apply(event.data.theme);
  };

  apply(document.documentElement.dataset.pfTheme);
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}
