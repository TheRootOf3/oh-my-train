import { auth, signIn, signOut } from "@/auth";
import ThemeToggle from "@/components/ThemeToggle";

export default async function TopBar() {
  const session = await auth();

  return (
    <div className="topbar">
      <ThemeToggle />
      {session?.user ? (
        <>
          {session.user.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="avatar" src={session.user.image} alt="" width={24} height={24} />
          )}
          <span className="topbar-login">@{session.user.login ?? session.user.name}</span>
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button className="btn btn-small" type="submit">
              Sign out
            </button>
          </form>
        </>
      ) : (
        <form
          action={async () => {
            "use server";
            await signIn("github");
          }}
        >
          <button className="btn btn-small btn-primary" type="submit">
            Sign in with GitHub
          </button>
        </form>
      )}
    </div>
  );
}
