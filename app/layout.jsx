import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Stroka Visual — Productora audiovisual",
  description:
    "Stroka Visual. Productora audiovisual para marcas, empresas, eventos e instituciones. Fotografía, video, drone, contenido y rebranding con mirada cinematográfica.",
  metadataBase: new URL("https://strokavisual.com"),
  openGraph: {
    title: "Stroka Visual",
    description: "Productora audiovisual. Imagen como protagonista.",
    type: "website",
  },
};

export const viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@300;400;500;600;700&family=Inter:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="grain min-h-screen font-sans antialiased">
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
