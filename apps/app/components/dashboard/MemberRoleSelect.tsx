"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { setMemberRole } from "@/lib/actions/team"
import { ROLES, ROLE_LABEL, ROLE_DESCRIPTION, type Role } from "@/lib/roles"

/**
 * Change a colleague's role.
 *
 * Disabled on your own row: an admin demoting themselves by accident locks the
 * organisation out of its own team settings, and there is no way back from
 * inside the product. The server refuses it too, because a disabled select is
 * presentation and a server action is a public endpoint.
 */
export function MemberRoleSelect({
  userId,
  role,
  isSelf,
}: {
  userId: string | null
  role: Role
  isSelf: boolean
}) {
  const [value, setValue] = useState<Role>(role)
  const [pending, startTransition] = useTransition()

  if (!userId) {
    return <span className="text-xs text-muted-foreground">{ROLE_LABEL[role]}</span>
  }

  const change = (next: Role) => {
    const previous = value
    setValue(next)
    startTransition(async () => {
      try {
        const res = await setMemberRole(userId, next)
        if (!res.ok) { setValue(previous); toast.error(res.reason); return }
        toast.success(`Now ${ROLE_LABEL[next]}`)
      } catch (err) {
        setValue(previous)
        toast.error(err instanceof Error ? err.message : "Could not change role")
      }
    })
  }

  return (
    <select
      value={value}
      disabled={isSelf || pending}
      onChange={e => change(e.target.value as Role)}
      title={isSelf ? "You cannot change your own role. Ask another Admin." : ROLE_DESCRIPTION[value]}
      aria-label="Role"
      className="shrink-0 rounded-md border border-input bg-transparent px-2 py-1 text-xs outline-none focus:border-ring disabled:opacity-50"
    >
      {ROLES.map(r => (
        <option key={r} value={r}>
          {ROLE_LABEL[r]}
        </option>
      ))}
    </select>
  )
}
