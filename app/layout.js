import { Source_Sans_3, Source_Code_Pro } from "next/font/google";
import "./globals.css";

const sourceSans = Source_Sans_3({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "600", "700"] });
const sourceCode = Source_Code_Pro({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata = {
  title: "Goldbridge",
  description: "Gestão de portfólio imobiliário",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className={`${sourceSans.variable} ${sourceCode.variable}`}>
        {children}
      </body>
    </html>
  );
}
