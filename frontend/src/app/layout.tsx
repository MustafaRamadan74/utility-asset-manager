import type { Metadata } from 'next';
import '@arcgis/core/assets/esri/themes/light/main.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Utility Asset Manager | Water Network GIS',
  description:
    'Web GIS application for viewing, querying, editing, and validating water utility network assets (pipes, valves, hydrants).',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
