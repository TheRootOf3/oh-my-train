import { auth } from "@/auth";
import CalendarApp from "@/components/CalendarApp";
import Header from "@/components/Header";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);

  return (
    <>
      <TopBar />
      <Header />
      <main className="container">
        <CalendarApp signedIn={signedIn} />
      </main>
    </>
  );
}
