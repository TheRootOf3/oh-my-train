import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

type GhToken = { ghId?: string; ghLogin?: string };

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Vercel sets AUTH_TRUST_HOST automatically; this also covers `next start` on localhost.
  trustHost: true,
  // App-specific cookie name: the default "authjs.session-token" is shared by every
  // Auth.js app on localhost, so a stale cookie from another project spams
  // JWTSessionError ("no matching decryption secret") on every request.
  cookies: {
    sessionToken: {
      name: "oh-my-train.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [GitHub],
  callbacks: {
    jwt({ token, profile }) {
      const p = profile as { id?: number | string; login?: string } | undefined;
      const t = token as GhToken;
      if (p?.id !== undefined) {
        t.ghId = String(p.id);
        t.ghLogin = typeof p.login === "string" ? p.login : undefined;
      }
      return token;
    },
    session({ session, token }) {
      const t = token as GhToken;
      if (t.ghId) session.user.id = t.ghId;
      session.user.login = t.ghLogin;
      return session;
    },
  },
});
