import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import appCss from '../styles.css?url'

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
    themeMeta.setAttribute('content', theme === 'dark' ? '#0f161d' : '#13212f');
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
        title: 'Workout Tracker',
      },
      {
        name: 'theme-color',
        content: '#0f161d',
      },
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-title',
        content: 'Workout Tracker',
      },
    ],
    links: [
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
    <html lang="en" data-theme="dark">
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
