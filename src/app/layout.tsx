import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oh My Train — the communal British rail disappointment diary",
  description:
    "Log every delayed, cancelled and — occasionally — punctual train. Now with a database, so the despair is permanent.",
};

// Stamp the theme before first paint: ?theme= override, then the saved toggle choice.
const themeScript = `try{var p=new URLSearchParams(location.search).get("theme");var t=(p==="dark"||p==="light")?p:localStorage.getItem("omt-theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <footer className="footer">
          <p>This website has a 100% uptime record, which is more than can be said for the 07:43 to Euston.</p>
          <p>Not affiliated with National Rail, any train operating company, or the concept of punctuality.</p>
          <p>No trains were harmed in the making of this site. They never showed up.</p>
        </footer>
      </body>
    </html>
  );
}
