"use client"

import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { Loader2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { inviteTeamMember } from "@/lib/actions/team"

export function TeamInviteForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [role, setRole] = useState("org:member")
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set("role", role)
    startTransition(async () => {
      try {
        await inviteTeamMember(fd)
        toast.success("Invitation sent")
        formRef.current?.reset()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to send invitation")
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex items-end gap-3 flex-wrap">
      <div className="space-y-1.5 flex-1 min-w-48">
        <Label htmlFor="email" className="text-xs text-muted-foreground">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="colleague@yourprotocol.com"
          required
          disabled={isPending}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Role</Label>
        <Select value={role} onValueChange={(v) => { if (v) setRole(v) }} disabled={isPending}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="org:member">Member</SelectItem>
            <SelectItem value="org:admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={isPending} className="gap-2 shrink-0">
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
        Send invite
      </Button>
    </form>
  )
}
