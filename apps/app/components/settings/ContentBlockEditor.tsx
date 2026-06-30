"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { updateConfig } from "@/lib/actions/project"
import type { ContentBlock, ContentBlockType } from "@/lib/types/config"
import { nanoid } from "nanoid"
import { GripVertical, Trash2, Plus, ChevronDown, Loader2 } from "lucide-react"

const TITLE_MAX = 50

const BLOCK_TYPES: { value: ContentBlockType; label: string }[] = [
  { value: "video",  label: "Video" },
  { value: "text",   label: "Text / Announcement" },
  { value: "link",   label: "Link" },
  { value: "faq",    label: "FAQ" },
  { value: "image",  label: "Image" },
  { value: "social", label: "Social Links" },
  { value: "html",   label: "HTML" },
]

type FieldDef = { key: string; label: string; placeholder: string; multiline?: boolean }

const CONTENT_FIELDS: Partial<Record<ContentBlockType, FieldDef[]>> = {
  video: [
    { key: "url", label: "Video URL", placeholder: "https://youtube.com/watch?v=… or https://loom.com/share/…" },
  ],
  text: [
    { key: "body", label: "Content", placeholder: "Write your announcement, update, or description…", multiline: true },
  ],
  link: [
    { key: "url",         label: "URL",                    placeholder: "https://docs.yourprotocol.com" },
    { key: "description", label: "Description (optional)", placeholder: "View our documentation" },
  ],
  image: [
    { key: "url", label: "Image URL",           placeholder: "https://yourprotocol.com/banner.png" },
    { key: "alt", label: "Alt text (optional)", placeholder: "Protocol banner" },
  ],
  faq: [
    { key: "q1", label: "Question 1",           placeholder: "What is your most common question?" },
    { key: "a1", label: "Answer 1",             placeholder: "Your answer…", multiline: true },
    { key: "q2", label: "Question 2 (optional)", placeholder: "Another question?" },
    { key: "a2", label: "Answer 2",             placeholder: "Your answer…", multiline: true },
    { key: "q3", label: "Question 3 (optional)", placeholder: "Another question?" },
    { key: "a3", label: "Answer 3",             placeholder: "Your answer…", multiline: true },
  ],
  html: [
    { key: "code", label: "HTML", placeholder: "<p>Your custom content</p>", multiline: true },
  ],
  social: [
    { key: "twitter",  label: "X / Twitter (optional)", placeholder: "https://twitter.com/yourproject" },
    { key: "discord",  label: "Discord (optional)",     placeholder: "https://discord.gg/yourserver" },
    { key: "telegram", label: "Telegram (optional)",    placeholder: "https://t.me/yourgroup" },
    { key: "github",   label: "GitHub (optional)",      placeholder: "https://github.com/yourorg" },
    { key: "website",  label: "Website (optional)",     placeholder: "https://yourprotocol.com" },
  ],
}

function getContent(block: ContentBlock): Record<string, string> {
  if (block.content && typeof block.content === "object") return block.content as Record<string, string>
  return {}
}

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m?.[1] ?? null
}

async function fetchVideoTitle(url: string): Promise<string | null> {
  try {
    const isYt = url.includes("youtube.com") || url.includes("youtu.be")
    const isLoom = url.includes("loom.com")
    if (!isYt && !isLoom) return null
    const endpoint = isYt
      ? `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
      : `https://www.loom.com/v1/oembed?url=${encodeURIComponent(url)}`
    const res = await fetch(endpoint)
    if (!res.ok) return null
    const data = await res.json() as { title?: string }
    return data.title?.slice(0, TITLE_MAX) ?? null
  } catch {
    return null
  }
}

function contentPreview(block: ContentBlock): string | null {
  const c = getContent(block)
  if (block.type === "video")  return c.url ?? null
  if (block.type === "text")   return c.body ? c.body.slice(0, 80) : null
  if (block.type === "link")   return c.url ?? null
  if (block.type === "image")  return c.url ?? null
  if (block.type === "html")   return c.code ? c.code.slice(0, 60) : null
  if (block.type === "faq") {
    const count = [c.q1, c.q2, c.q3].filter(Boolean).length
    return count ? `${count} question${count !== 1 ? "s" : ""}` : null
  }
  if (block.type === "social") {
    const set = [c.twitter, c.discord, c.telegram, c.github, c.website].filter(Boolean)
    return set.length ? set.join(" · ") : null
  }
  return null
}

// ── Sortable block row ────────────────────────────────────────────────────────

function SortableBlock({
  block, isEditing, onToggleEdit, onUpdate, onRemove,
}: {
  block: ContentBlock
  isEditing: boolean
  onToggleEdit: () => void
  onUpdate: (id: string, updates: Partial<ContentBlock>) => void
  onRemove: (id: string) => void
}) {
  const [fetchingTitle, setFetchingTitle] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: block.id,
    disabled: isEditing,
  })

  const fields = CONTENT_FIELDS[block.type] ?? []
  const content = getContent(block)
  const preview = contentPreview(block)
  const ytId = block.type === "video" ? extractYouTubeId(content.url ?? "") : null

  async function autoFetchTitle(url: string) {
    if (!url || block.title.trim()) return
    setFetchingTitle(true)
    const title = await fetchVideoTitle(url)
    if (title) onUpdate(block.id, { title })
    setFetchingTitle(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="rounded-lg border border-border bg-background overflow-hidden"
    >
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          {...(isEditing ? {} : { ...attributes, ...listeners })}
          className={`text-muted-foreground shrink-0 ${isEditing ? "opacity-20 cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}`}
          tabIndex={isEditing ? -1 : undefined}
        >
          <GripVertical className="size-4" />
        </button>

        {/* YouTube thumbnail */}
        {ytId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
            alt=""
            className="size-10 rounded object-cover shrink-0"
          />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{block.title || "(untitled)"}</p>
          {preview
            ? <p className="text-[11px] text-muted-foreground truncate mt-0.5">{preview}</p>
            : <p className="text-[11px] text-muted-foreground/50 italic mt-0.5">No content — click to edit</p>
          }
        </div>

        <Badge variant="secondary" className="text-xs shrink-0">
          {BLOCK_TYPES.find(t => t.value === block.type)?.label ?? block.type}
        </Badge>
        <button
          type="button"
          onClick={onToggleEdit}
          title={isEditing ? "Collapse" : "Edit content"}
          className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className={`size-4 transition-transform duration-150 ${isEditing ? "rotate-180" : ""}`} />
        </button>
        <button
          type="button"
          onClick={() => onRemove(block.id)}
          title="Remove block"
          className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* Inline edit panel */}
      {isEditing && (
        <div className="border-t border-border bg-muted/20 px-3 py-3 space-y-3">
          {/* Title with character count */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted-foreground">Title</label>
              <span className={`text-[10px] tabular-nums ${block.title.length > 44 ? "text-amber-500" : "text-muted-foreground/50"}`}>
                {block.title.length}/{TITLE_MAX}
              </span>
            </div>
            <Input
              value={block.title}
              maxLength={TITLE_MAX}
              onChange={e => onUpdate(block.id, { title: e.target.value })}
              placeholder="Block title"
              className="h-8 text-sm"
            />
          </div>

          {fields.map(field => (
            <div key={field.key}>
              <label className="text-xs text-muted-foreground block mb-1">{field.label}</label>
              {block.type === "video" && field.key === "url" ? (
                <div className="relative">
                  <Input
                    value={content[field.key] ?? ""}
                    onChange={e => onUpdate(block.id, { content: { ...content, [field.key]: e.target.value } })}
                    onBlur={e => autoFetchTitle(e.target.value)}
                    placeholder={field.placeholder}
                    className={`h-8 text-sm ${fetchingTitle ? "pr-24" : ""}`}
                  />
                  {fetchingTitle && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-muted-foreground pointer-events-none">
                      <Loader2 className="size-3 animate-spin" /> Fetching…
                    </span>
                  )}
                </div>
              ) : field.multiline ? (
                <textarea
                  value={content[field.key] ?? ""}
                  onChange={e => onUpdate(block.id, { content: { ...content, [field.key]: e.target.value } })}
                  placeholder={field.placeholder}
                  rows={field.key.startsWith("a") ? 3 : 1}
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring resize-y"
                />
              ) : (
                <Input
                  value={content[field.key] ?? ""}
                  onChange={e => onUpdate(block.id, { content: { ...content, [field.key]: e.target.value } })}
                  placeholder={field.placeholder}
                  className="h-8 text-sm"
                />
              )}
            </div>
          ))}

          {fields.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No additional fields for this block type.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main editor ───────────────────────────────────────────────────────────────

interface ContentBlockEditorProps {
  projectId: string
  initialBlocks: ContentBlock[]
}

export function ContentBlockEditor({ projectId, initialBlocks }: ContentBlockEditorProps) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(
    [...initialBlocks].sort((a, b) => a.order - b.order)
  )
  const [newType, setNewType] = useState<ContentBlockType>("video")
  const [newTitle, setNewTitle] = useState("")
  const [newContent, setNewContent] = useState<Record<string, string>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [fetchingNewTitle, setFetchingNewTitle] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setBlocks(prev => {
        const oldIndex = prev.findIndex(b => b.id === active.id)
        const newIndex = prev.findIndex(b => b.id === over.id)
        return arrayMove(prev, oldIndex, newIndex).map((b, i) => ({ ...b, order: i }))
      })
    }
  }

  async function handleNewVideoUrlBlur(url: string) {
    if (!url || newTitle.trim()) return
    setFetchingNewTitle(true)
    const title = await fetchVideoTitle(url)
    if (title) setNewTitle(title)
    setFetchingNewTitle(false)
  }

  function addBlock() {
    if (blocks.length >= 10) { toast.error("Maximum 10 content blocks"); return }
    if (!newTitle.trim()) { toast.error("Enter a title first"); return }
    const block: ContentBlock = {
      id: nanoid(),
      type: newType,
      title: newTitle.trim(),
      content: newContent,
      order: blocks.length,
    }
    const updated = [...blocks, block]
    setBlocks(updated)
    setNewTitle("")
    setNewContent({})
    startTransition(async () => {
      try {
        await updateConfig(projectId, { contentBlocks: updated })
        toast.success("Block added")
      } catch {
        toast.error("Failed to save block")
      }
    })
  }

  function updateBlock(id: string, updates: Partial<ContentBlock>) {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
  }

  function removeBlock(id: string) {
    const updated = blocks.filter(b => b.id !== id).map((b, i) => ({ ...b, order: i }))
    setBlocks(updated)
    if (editingId === id) setEditingId(null)
    startTransition(async () => {
      try {
        await updateConfig(projectId, { contentBlocks: updated })
        toast.success("Block removed")
      } catch {
        toast.error("Failed to remove block")
      }
    })
  }

  function save() {
    startTransition(async () => {
      try {
        await updateConfig(projectId, { contentBlocks: blocks })
        toast.success("Content saved")
      } catch {
        toast.error("Failed to save content")
      }
    })
  }

  const newFields = CONTENT_FIELDS[newType] ?? []

  return (
    <div className="space-y-4">
      {blocks.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {blocks.map(block => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  isEditing={editingId === block.id}
                  onToggleEdit={() => setEditingId(prev => prev === block.id ? null : block.id)}
                  onUpdate={updateBlock}
                  onRemove={removeBlock}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">No content blocks yet.</p>
      )}

      {/* Add new block */}
      {blocks.length < 10 && (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex gap-2 items-center">
            <Select value={newType} onValueChange={v => { setNewType(v as ContentBlockType); setNewContent({}) }}>
              <SelectTrigger className="w-44 shrink-0">
                <SelectValue>
                  {BLOCK_TYPES.find(t => t.value === newType)?.label ?? newType}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {BLOCK_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1">
              <Input
                placeholder="Block title"
                value={newTitle}
                maxLength={TITLE_MAX}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && newFields.length === 0) addBlock() }}
                className={fetchingNewTitle ? "pr-24" : ""}
              />
              {fetchingNewTitle && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-muted-foreground pointer-events-none">
                  <Loader2 className="size-3 animate-spin" /> Fetching…
                </span>
              )}
            </div>

            <Button type="button" variant="outline" size="sm" onClick={addBlock} className="shrink-0">
              <Plus className="size-4 mr-1" /> Add
            </Button>
          </div>

          {/* Content fields for the new block */}
          {newFields.map(field => (
            <div key={field.key}>
              <label className="text-xs text-muted-foreground block mb-1">{field.label}</label>
              {newType === "video" && field.key === "url" ? (
                <Input
                  value={newContent[field.key] ?? ""}
                  onChange={e => setNewContent(prev => ({ ...prev, [field.key]: e.target.value }))}
                  onBlur={e => handleNewVideoUrlBlur(e.target.value)}
                  placeholder={field.placeholder}
                />
              ) : field.multiline ? (
                <textarea
                  value={newContent[field.key] ?? ""}
                  onChange={e => setNewContent(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  rows={field.key.startsWith("a") ? 3 : 1}
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring resize-none"
                />
              ) : (
                <Input
                  value={newContent[field.key] ?? ""}
                  onChange={e => setNewContent(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <Button onClick={save} disabled={isPending}>
        {isPending ? "Saving…" : "Save content"}
      </Button>
    </div>
  )
}
