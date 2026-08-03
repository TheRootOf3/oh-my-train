import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /** GitHub numeric user id (as string) */
      id: string;
      /** GitHub login (handle) */
      login?: string;
    } & DefaultSession["user"];
  }
}

