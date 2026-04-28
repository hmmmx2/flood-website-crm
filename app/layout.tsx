import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import AppShellWrapper from "@/components/layout/AppShellWrapper";
import { ThemeProvider } from "@/lib/ThemeContext";
import { AuthProvider } from "@/lib/AuthContext";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flood Management CRM",
  description:
    "Command center for IoT flood sensors, live alerts, and predictive analytics.",
  icons: {
    icon: "/images/logo.png",
    shortcut: "/images/logo.png",
    apple: "/images/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/*
          Runs SYNCHRONOUSLY before React hydration.
          On /auth/callback, reads ?at=&rt=&u= from the URL and writes the
          correct CRM-shaped user into localStorage before AuthContext mounts.
          This prevents AuthContext from reading stale/undefined tokens and
          triggering a failed silentRefresh that redirects back to /login.
        */}
        <Script id="auth-callback-init" strategy="beforeInteractive">{`
          (function() {
            try {
              if (window.location.pathname !== '/auth/callback') return;
              var params = new URLSearchParams(window.location.search);
              var at = params.get('at');
              var rt = params.get('rt');
              var u  = params.get('u');
              if (!at || !rt || !u || at === 'undefined' || rt === 'undefined') return;
              var raw = JSON.parse(decodeURIComponent(u));
              var role = raw.role || 'admin';
              var crmUser = {
                id: raw.id,
                name: raw.displayName || raw.name || raw.email,
                email: raw.email,
                role: role.charAt(0).toUpperCase() + role.slice(1).toLowerCase(),
                status: 'active',
                twoFactorEnabled: false,
                passwordLastChanged: new Date().toISOString(),
                notifications: true,
                emailAlerts: true,
                smsAlerts: false
              };
              localStorage.setItem('flood_access_token',  decodeURIComponent(at));
              localStorage.setItem('flood_refresh_token', decodeURIComponent(rt));
              localStorage.setItem('flood_auth_user',     JSON.stringify(crmUser));
            } catch(e) {
              if (process.env.NODE_ENV !== 'production') console.error('[auth-callback] token init failed', e);
            }
          })();
        `}</Script>

        <ThemeProvider>
          <AuthProvider>
            <AppShellWrapper>{children}</AppShellWrapper>
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: { borderRadius: '10px', fontSize: '14px' },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
