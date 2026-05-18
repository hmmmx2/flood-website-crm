import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { cookies } from "next/headers";
import "./globals.css";
import AppShellWrapper from "@/components/layout/AppShellWrapper";
import { ThemeProvider } from "@/lib/ThemeContext";
import { AuthProvider } from "@/lib/AuthContext";
import { IoTEventProvider } from "@/components/providers/IoTEventProvider";
import { Toaster } from "react-hot-toast";
import { getThemeInitScript } from "@/lib/theme/themeScript";

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
    // Browser tab favicon. We removed app/favicon.ico (it had a stale,
    // non-brand glyph baked in from an earlier iteration). Next.js
    // auto-serves app/icon.png at /icon.png, which is the proper logo,
    // so we point every icon slot at it and let browsers rasterise it
    // to whatever size they need for the tab.
    icon: [{ url: "/icon.png", type: "image/png" }],
    shortcut: [{ url: "/icon.png" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const t = cookieStore.get("flood-theme")?.value;
  const htmlClassName =
    t === "dark" ? "dark" : t === "light" ? "" : undefined;

  return (
    <html lang="en" suppressHydrationWarning className={htmlClassName}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script
          id="flood-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: getThemeInitScript() }}
        />
        {/*
          Runs SYNCHRONOUSLY before React hydration.
          On /auth/callback, reads ?at=&rt=&u= from the URL and writes the
          correct CRM-shaped user into localStorage before AuthContext mounts.
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
              // Normalize JWT/API role string → canonical CRM display label.
              // Mirrors lib/permissions.ts → roleFromJwtOrApiRole. Inlined here
              // because this script runs before React hydration.
              var ROLE_MAP = {
                'ADMIN': 'Admin',
                'OPERATIONS_MANAGER': 'Operations Manager',
                'OPERATIONSMANAGER': 'Operations Manager',
                'FIELD_TECHNICIAN': 'Field Technician',
                'FIELDTECHNICIAN': 'Field Technician',
                'NGO_VOLUNTEER': 'NGO Volunteer',
                'NGOVOLUNTEER': 'NGO Volunteer',
                'VIEWER': 'Viewer',
                'CUSTOMER': 'Customer'
              };
              // Match the normalisation in isOperatorJwtRole + the
              // community login page: trim, uppercase, whitespace→
              // underscore, drop any Spring Security 'ROLE_' prefix.
              var roleKey = String(raw.role || 'CUSTOMER')
                .trim().toUpperCase()
                .replace(/\\s+/g, '_')
                .replace(/^ROLE_/, '');
              // ── Operator-class gate ──────────────────────────────
              // The CRM is for operator/admin staff only. If a community
              // end-user (Customer) or any unknown role hits this
              // callback, REFUSE to store tokens and redirect them to
              // the login page with a friendly error code.
              //
              // This list mirrors OPERATOR_JWT_KEYS in lib/permissions.ts.
              // It is duplicated here only because this script runs
              // before any module code (RSC strategy="beforeInteractive").
              var OPERATOR_KEYS = [
                'ADMIN',
                'OPERATIONS_MANAGER', 'OPERATIONSMANAGER',
                'FIELD_TECHNICIAN', 'FIELDTECHNICIAN',
                'NGO_VOLUNTEER', 'NGOVOLUNTEER',
                'VIEWER'
              ];
              if (OPERATOR_KEYS.indexOf(roleKey) === -1) {
                // Non-operator: wipe any stale session and redirect.
                try {
                  localStorage.removeItem('flood_access_token');
                  localStorage.removeItem('flood_refresh_token');
                  localStorage.removeItem('flood_auth_user');
                } catch (_) { /* localStorage may be unavailable */ }
                window.location.replace('/login?error=role');
                return;
              }
              var crmUser = {
                id: raw.id,
                name: raw.displayName || raw.name || raw.email,
                email: raw.email,
                role: ROLE_MAP[roleKey] || 'Customer',
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
              // Strip tokens from the URL bar so they don't linger in history.
              window.history.replaceState({}, '', '/auth/callback');
            } catch(e) {
              if (process.env.NODE_ENV !== 'production') console.error('[auth-callback] token init failed', e);
            }
          })();
        `}</Script>

        <ThemeProvider>
          <AuthProvider>
            <IoTEventProvider>
              <AppShellWrapper>{children}</AppShellWrapper>
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: { borderRadius: "10px", fontSize: "14px" },
                }}
              />
            </IoTEventProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
