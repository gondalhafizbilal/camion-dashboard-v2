import './globals.css';
import 'summernote/dist/summernote-lite.css';
import GlobalImagePreview from '@/components/GlobalImagePreview';
import GlobalFirstErrorScroll from '@/components/GlobalFirstErrorScroll';

export const metadata = {
  title: 'Camion | Dashboard',
  description: 'Next.js admin dashboard for Camion',
  icons: {
    icon: [
      { url: '/images/logo-light.svg', media: '(prefers-color-scheme: light)', type: 'image/svg+xml' },
      { url: '/images/logo-dark.svg', media: '(prefers-color-scheme: dark)', type: 'image/svg+xml' },
    ],
    shortcut: [
      { url: '/images/logo-light.svg', media: '(prefers-color-scheme: light)', type: 'image/svg+xml' },
      { url: '/images/logo-dark.svg', media: '(prefers-color-scheme: dark)', type: 'image/svg+xml' },
    ],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/admin-assets/vendor/bootstrap-select/dist/css/bootstrap-select.min.css" />
        <link rel="stylesheet" href="/admin-assets/css/style.css" />
        <link rel="icon" href="/images/logo-light.svg" media="(prefers-color-scheme: light)" type="image/svg+xml" />
        <link rel="icon" href="/images/logo-dark.svg" media="(prefers-color-scheme: dark)" type="image/svg+xml" />
      </head>
      <body
        data-typography="poppins"
        data-theme-version="light"
        data-layout="vertical"
        data-nav-headerbg="color_1"
        data-headerbg="color_1"
        data-sidebar-style="full"
        data-sibebarbg="color_1"
        data-primary="color_1"
        data-sidebar-position="fixed"
        data-header-position="fixed"
        data-container="wide"
        direction="ltr"
      >
        {children}
        <GlobalFirstErrorScroll />
        <GlobalImagePreview />
      </body>
    </html>
  );
}
