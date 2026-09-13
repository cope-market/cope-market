import type {Metadata, Viewport} from "next";
import {Providers} from "./providers";
import {AppChrome} from "@/components/AppChrome";
import "./globals.css";

export const metadata: Metadata = {
  title: {default: "Cope Market", template: "%s · Cope Market"},
  description:
    "Social trading of real-world events. Post a thesis, back it with a real position, copy one you believe.",
  applicationName: "Cope Market",
  manifest: "/manifest.webmanifest",
  appleWebApp: {capable: true, statusBarStyle: "black-translucent", title: "Cope"},
  icons: {
    icon: [{url: "/icons/icon-192.png", sizes: "192x192", type: "image/png"}],
    apple: [{url: "/icons/apple-touch-icon.png", sizes: "180x180"}],
  },
  formatDetection: {telephone: false},
};

export const viewport: Viewport = {
  themeColor: "#08090b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppChrome>{children}</AppChrome>
        </Providers>
      </body>
    </html>
  );
}
