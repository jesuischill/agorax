import "./globals.css";

export const metadata = {
  title: "AgoraX",
  description:
    "AgoraX — feed, reels, stories et messages dans un seul réseau."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
