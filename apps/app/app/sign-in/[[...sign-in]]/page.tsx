import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";

/**
 * An ORG INVITATION carries a `__clerk_ticket`, and it must be consumed by
 * <SignUp /> (which creates the account and joins the org in one step), not by
 * <SignIn /> (the invitee has no account yet). If a ticket lands here anyway,
 * hand it to /sign-up, which lets an invitee straight through its beta gate.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const ticket = params.__clerk_ticket;
  if (typeof ticket === "string" && ticket.length > 0) {
    redirect(`/sign-up?__clerk_ticket=${encodeURIComponent(ticket)}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
