import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes bypass Clerk's auth().protect(). Every /api entry here is
// called by an unauthenticated third party (embedded widget, Telegram's
// servers, Stripe) and authenticates itself: the widget routes validate a
// publishable key, Telegram validates its secret-token header, Stripe
// verifies its webhook signature, the actions routes resolve a publishable key
// and validate the request against their own action_events audit row, and
// /api/v1/diagnose requires the project's secret key as a bearer token.
// Dashboard-only routes (/api/conversations/*) are deliberately NOT listed so
// they stay behind Clerk.
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/widget(.*)",
  "/preview(.*)",
  "/api/chat(.*)",
  "/api/check(.*)",
  "/api/widget-config(.*)",
  "/api/widget/protocol-account(.*)",
  "/api/widget/opener(.*)",
  "/api/feedback(.*)",
  "/api/tickets(.*)",
  "/api/telegram(.*)",
  "/api/cron(.*)",
  "/api/stripe(.*)",
  "/api/actions/rebuild(.*)",
  "/api/actions/ack(.*)",
  "/api/v1/diagnose(.*)",
  // /api/v1/resolve shipped without this line, so Clerk intercepted every call
  // and the Resolution API was unreachable by the API clients it exists for:
  // it validated secret keys perfectly well and never ran. Invisible in the
  // route's own code, and invisible in a browser where a dashboard session
  // sails through. Like /diagnose it authenticates itself with the secret key.
  "/api/v1/resolve(.*)",
  "/api/v1/status(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth().protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
