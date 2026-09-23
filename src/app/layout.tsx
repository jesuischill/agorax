import "./globals.css";

export const metadata = {
  title: "AgoraX",
  description: "Réseau social AgoraX",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
