import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"

export default function TeamPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team</h1>
        <p className="text-muted-foreground mt-1">Invite team members to manage this project.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Team members</CardTitle>
          <CardDescription>Team management is handled via Clerk Organizations.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Invite members, manage roles (Admin / Editor / Viewer), and remove access from your Clerk organization dashboard.
          </p>
          <Button
            variant="outline"
            render={<a href="https://dashboard.clerk.com" target="_blank" rel="noopener noreferrer" />}
          >
            Open Clerk dashboard
            <ExternalLink className="ml-2 size-3.5" />
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
