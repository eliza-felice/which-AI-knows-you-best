import type { Metadata, Viewport } from "next";
import { DM_Sans, Gochi_Hand } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { InkFilters } from "@/components/Doodles";
import { MODELS, numberWord } from "@/lib/models";
import "./globals.css";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], weight: ["400", "500", "700"] });
const gochiHand = Gochi_Hand({ variable: "--font-gochi-hand", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "Which AI Knows You Best?",
  description:
    `${numberWord(MODELS.length, true)} AIs guess your personality from a few facts about you. Take the test and see which one came closest, and what that says about AI.`,
};

export const viewport: Viewport = {
  themeColor: "#EFEDE8",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSans.variable} ${gochiHand.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <InkFilters />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
