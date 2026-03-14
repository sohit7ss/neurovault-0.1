import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeuroVault — AI Knowledge Platform",
  description: "Your AI-powered second brain. Store documents, search with private AI, generate roadmaps, and visualize knowledge.",
  keywords: "AI, knowledge management, RAG, roadmaps, mind maps, document search",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
