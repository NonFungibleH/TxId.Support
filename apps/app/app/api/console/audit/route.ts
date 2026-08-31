import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getProject } from "@/lib/actions/project"
import { recordCaseAccess } from "@/lib/case-access"

/**
 * Reply and export provenance for the Console.
 *
 * The copy button is where TxID's words become the company's words to their
 * customer, so the event is recorded with the SHA-256 of the exact text at the
 * moment it was taken. A dispute about "what were we told" then has an answer
 * that does not depend on anyone's memory.
 *
 * Clerk authenticates this route by default (it is deliberately absent from
 * the middleware's public list), so the unauthenticated review copy at
 * /console-demo cannot write here, and fixture browsing never pollutes the log.
 */
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 })

  const { project } = await getProject()
  if (!project) return NextResponse.json({ error: "No project" }, { status: 404 })

  let body: { action?: string; entity?: string; sha256?: string; characters?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 })
  }
  if (body.action !== "reply" && body.action !== "export") {
    return NextResponse.json({ error: "Bad action" }, { status: 400 })
  }
  if (typeof body.entity !== "string" || body.entity.length > 200) {
    return NextResponse.json({ error: "Bad entity" }, { status: 400 })
  }

  await recordCaseAccess({
    projectId: (project as { id: string }).id,
    actor: userId,
    action: body.action,
    detail: {
      surface: "console",
      entity: body.entity,
      ...(body.sha256 ? { sha256: String(body.sha256).slice(0, 64) } : {}),
      ...(typeof body.characters === "number" ? { characters: body.characters } : {}),
    },
  })
  return NextResponse.json({ ok: true })
}
