import "./globals.css";

export const metadata = {
  title: "Goldbridge",
  description: "Gestão de portfólio imobiliário",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
      </body>
    </html>
  );
}
