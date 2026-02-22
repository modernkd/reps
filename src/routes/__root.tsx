import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import appCss from '../styles.css?url'

const appTitle = 'Workout Tracker'
const appDescription = 'Track workouts, follow plans, and recover skipped days.'
const socialImagePath = '/og-image.png'
const socialImageAlt = 'Workout Tracker dashboard preview'
const siteUrl = import.meta.env.VITE_SITE_URL?.trim().replace(/\/+$/, '') || undefined
const canonicalUrl = siteUrl ? `${siteUrl}/` : '/'
const socialImageUrl = siteUrl ? `${siteUrl}${socialImagePath}` : socialImagePath

const themeInitializationScript = `
(function () {
  var theme = 'dark';
  try {
    var storedTheme = window.localStorage.getItem('workout-tracker-theme');
    if (storedTheme === 'light' || storedTheme === 'dark') {
      theme = storedTheme;
    }
  } catch (_) {
    // Ignore read errors.
  }

  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;

  var themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', theme === 'dark' ? '#1a1c24' : '#fbfcff');
  }
})();
`

const serviceWorkerRegistrationScript = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {
      // Best-effort registration only.
    });
  });
}
`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: appTitle,
      },
      {
        name: 'description',
        content: appDescription,
      },
      {
        name: 'theme-color',
        content: '#1a1c24',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:site_name',
        content: appTitle,
      },
      {
        property: 'og:locale',
        content: 'en_US',
      },
      {
        property: 'og:title',
        content: appTitle,
      },
      {
        property: 'og:description',
        content: appDescription,
      },
      {
        property: 'og:url',
        content: canonicalUrl,
      },
      {
        property: 'og:image',
        content: socialImageUrl,
      },
      {
        property: 'og:image:width',
        content: '1200',
      },
      {
        property: 'og:image:height',
        content: '630',
      },
      {
        property: 'og:image:alt',
        content: socialImageAlt,
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:title',
        content: appTitle,
      },
      {
        name: 'twitter:description',
        content: appDescription,
      },
      {
        name: 'twitter:image',
        content: socialImageUrl,
      },
      {
        name: 'twitter:image:alt',
        content: socialImageAlt,
      },
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-title',
        content: appTitle,
      },
    ],
    links: [
      {
        rel: 'canonical',
        href: canonicalUrl,
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
      {
        rel: 'icon',
        href: '/favicon.ico',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16.png',
      },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
        {children}
        <script dangerouslySetInnerHTML={{ __html: serviceWorkerRegistrationScript }} />
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
