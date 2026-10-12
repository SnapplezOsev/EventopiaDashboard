import "./globals.css";

export const metadata = {
  title: "Operativ Översikt — Eventopia Dashboard",
  description: "Interaktiv operativ dashboard för veckoplanering med Rentman-integrering",
};

export const viewport = {
  width: 1920,
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="sv">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#060918" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
