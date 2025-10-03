import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "Z-Build Order Migration Guide",
    template: "%s | Z-Build Order Migration",
  },
  description:
    "Guidance for migrating the Z-Build Order planner from Vite + Firebase to Next.js 15 with the App Router.",
  metadataBase: new URL("https://zbuildorder.com"),
  openGraph: {
    title: "Z-Build Order Next.js Migration",
    description:
      "Step-by-step plan to bring build orders, Firebase auth, and community pages into Next.js.",
    url: "https://zbuildorder.com",
    siteName: "Z-Build Order",
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="bg-slate-950">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-slate-100`}
      >
        <div className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
