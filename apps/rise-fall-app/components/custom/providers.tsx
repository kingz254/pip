'use client';

import { useEffect } from 'react';
import { listenForClientSiteTheme } from '@deriv/core';
import { ThemeProvider, useTheme } from 'next-themes';

function ClientSiteThemeSync() {
  const { setTheme } = useTheme();
  useEffect(() => listenForClientSiteTheme(setTheme), [setTheme]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ClientSiteThemeSync />
      {children}
    </ThemeProvider>
  );
}
