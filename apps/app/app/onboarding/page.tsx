import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { OnboardingForm } from "@/components/onboarding/OnboardingForm"

/**
 * If the user already has a project, skip onboarding and go straight to the dashboard.
 * This handles the case where a returning user clicks "Get Started" on the marketing site.
 */
export default async function OnboardingPage() {
  const { project } = await getProject()
  if (project) redirect("/dashboard")

  return <OnboardingForm />
}
