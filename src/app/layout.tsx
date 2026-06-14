import "~/styles/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Navigation } from "./_components/navigation";
import { TransitionProvider } from "./_components/transition-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata = {
  title: "Continiuum — Autonomous AI SRE",
  description:
    "Continiuum watches your containerized services, diagnoses failures with AI, and heals them before your users notice.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
      >
        <body className="bg-bg text-fg min-h-screen font-sans antialiased">
          <TransitionProvider>
            <div className="relative flex min-h-screen flex-col">
              <div className="gradient-bg pointer-events-none fixed inset-0 -z-10" />
              <Navigation />
              <main className="flex flex-1 flex-col">{children}</main>
            </div>
          </TransitionProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
