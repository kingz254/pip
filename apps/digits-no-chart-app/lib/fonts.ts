import localFont from 'next/font/local';

/**
 * Inter is the default font for all template apps.
 *
 * Font family and background color are now baked into globals.css at
 * generation time by the app builder (via CSS variable patching and a
 * Google Fonts @import). There is no longer a runtime env-var path for
 * these values — branding is applied consistently in both deployed and
 * preview modes through CSS variables.
 *
 * Preview mode applies font dynamically via postMessage in
 * hooks/use-preview-branding.ts by switching the next/font className
 * on a wrapper element (see FONT_CLASS_MAP below).
 *
 * Every font is self-hosted so `next build` never fetches from Google Fonts.
 * `../app/fonts/` resolves to the root `app/fonts/` in the monorepo and to the
 * template's own `app/fonts/` in an assembled partner app, so both must hold the files.
 */
export const inter = localFont({
  src: [{ path: '../app/fonts/inter-latin-variable.woff2', weight: '100 900', style: 'normal' }],
});

const roboto = localFont({
  src: [{ path: '../app/fonts/roboto-latin-variable.woff2', weight: '100 900', style: 'normal' }],
});

const poppins = localFont({
  src: [
    { path: '../app/fonts/poppins-latin-400.woff2', weight: '400', style: 'normal' },
    { path: '../app/fonts/poppins-latin-500.woff2', weight: '500', style: 'normal' },
    { path: '../app/fonts/poppins-latin-600.woff2', weight: '600', style: 'normal' },
    { path: '../app/fonts/poppins-latin-700.woff2', weight: '700', style: 'normal' },
  ],
});

const dmSans = localFont({
  src: [{ path: '../app/fonts/dm-sans-latin-variable.woff2', weight: '100 1000', style: 'normal' }],
});

const lato = localFont({
  src: [
    { path: '../app/fonts/lato-latin-400.woff2', weight: '400', style: 'normal' },
    { path: '../app/fonts/lato-latin-700.woff2', weight: '700', style: 'normal' },
  ],
});

const nunito = localFont({
  src: [{ path: '../app/fonts/nunito-latin-variable.woff2', weight: '200 1000', style: 'normal' }],
});

const openSans = localFont({
  src: [{ path: '../app/fonts/open-sans-latin-variable.woff2', weight: '300 800', style: 'normal' }],
});

const montserrat = localFont({
  src: [{ path: '../app/fonts/montserrat-latin-variable.woff2', weight: '100 900', style: 'normal' }],
});

const raleway = localFont({
  src: [{ path: '../app/fonts/raleway-latin-variable.woff2', weight: '100 900', style: 'normal' }],
});

const sourceSans3 = localFont({
  src: [{ path: '../app/fonts/source-sans-3-latin-variable.woff2', weight: '200 900', style: 'normal' }],
});

/**
 * Maps app-builder font display names to their next/font className.
 * Apply the className to a wrapper element to switch the preview font —
 * font-family is inherited by all children via normal CSS inheritance.
 */
export const FONT_CLASS_MAP: Record<string, string> = {
  Inter:           inter.className,
  Roboto:          roboto.className,
  Poppins:         poppins.className,
  'DM Sans':       dmSans.className,
  Lato:            lato.className,
  Nunito:          nunito.className,
  'Open Sans':     openSans.className,
  Montserrat:      montserrat.className,
  Raleway:         raleway.className,
  'Source Sans 3': sourceSans3.className,
};
