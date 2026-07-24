import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Public Law AI — Grounded Korean Legal Answers",
  description:
    "Ask Korean legal questions and get grounded, cited answers from an AI legal assistant backed by real statute retrieval.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html>
      <body>
        {children}
      </body>
    </html>
  );
}
