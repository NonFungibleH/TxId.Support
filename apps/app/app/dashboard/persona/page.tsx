import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { BrandingPageClient } from "@/components/settings/BrandingPageClient"
import { SuggestedQuestionsEditor } from "@/components/settings/SuggestedQuestionsEditor"
import { BetaProgrammeForm } from "@/components/settings/BetaProgrammeForm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

/**
 * How the assistant SOUNDS, separated from how the widget LOOKS.
 *
 * Persona used to sit at the bottom of Branding, under the colour pickers, and
 * suggested questions sat on the Content page beside the widget's content tab.
 * They are the same job: deciding what the assistant says and what it offers
 * before anyone has typed anything. Colours are a different job entirely.
 *
 * Keeps the live preview, which already reflects agent name, avatar and the
 * opening message, so these fields are visible as they are edited.
 */
export default async function PersonaPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow
  const config = typedProject.config as unknown as ProjectConfig

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Persona</h1>
        <p className="text-muted-foreground mt-1">
          Define how your AI speaks and presents itself to users.
        </p>
      </div>
      <BrandingPageClient
        projectId={typedProject.id}
        projectName={typedProject.name}
        initial={config.branding}
        section="persona"
      >
        <Card>
          <CardHeader>
            <CardTitle>Suggested questions</CardTitle>
            <CardDescription>
              Starter questions shown as tappable chips in the chat. Set your own and they replace
              the AI&apos;s automatic suggestions, so users are only ever offered questions you know
              it can answer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <SuggestedQuestionsEditor
              projectId={typedProject.id}
              initial={config.suggestedQuestions ?? []}
            />
            {/* Directly under the starter questions, because the beta
                introduction and those questions are the same conversation:
                what a tester is greeted with, and what they are offered. */}
            <BetaProgrammeForm initial={config.beta} />
          </CardContent>
        </Card>
      </BrandingPageClient>
    </div>
  )
}
