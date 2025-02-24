import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { PaperProvider } from "@/contexts/PaperContext";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MITAOE PYQs",
  description: "Access MITAOE previous year question papers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <PaperProvider>
          {children}
        </PaperProvider>
      </body>
    </html>
  );
}
