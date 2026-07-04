import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes bypass Clerk's auth().protect(). Every /api entry here is
// called by an unauthenticated third party (embedded widget, Telegram's
// servers, Stripe) and authenticates itself: the widget routes validate a
// publishable key, Telegram validates its secret-token header, Stripe
// verifies its webhook signature. Dashboard-only routes (/api/conversations/*)
// are deliberately NOT listed so they stay behind Clerk.
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/widget(.*)",
  "/preview(.*)",
  "/api/chat(.*)",
  "/api/widget-config(.*)",
  "/api/widget/feedback(.*)",
  "/api/tickets(.*)",
  "/api/telegram(.*)",
  "/api/stripe(.*)",
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
