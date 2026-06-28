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
import { GripVertical, Trash2, Plus, ChevronDown } from "lucide-react"

const BLOCK_TYPES: { value: ContentBlockType; label: string }[] = [
  { value: "text",   label: "Text" },
  { value: "video",  label: "Video" },
  { value: "link",   label: "Link" },
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
    { key: "url", label: "URL", placeholder: "https://docs.yourprotocol.com" },
    { key: "description", label: "Description (optional)", placeholder: "View our documentation" },
  ],
  image: [
    { key: "url", label: "Image URL", placeholder: "https://yourprotocol.com/banner.png" },
    { key: "alt", label: "Alt text (optional)", placeholder: "Protocol banner" },
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

function contentPreview(block: ContentBlock): string | null {
  const c = getContent(block)
  if (block.type === "video") return c.url ?? null
  if (block.type === "text") return c.body ? c.body.slice(0, 80) : null
  if (block.type === "link") return c.url ?? null
  if (block.type === "image") return c.url ?? null
  if (block.type === "html") return c.code ? c.code.slice(0, 60) : null
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
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: block.id,
    disabled: isEditing,
  })

  const fields = CONTENT_FIELDS[block.type] ?? []
  const content = getContent(block)
  const preview = contentPreview(block)

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
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Title</label>
            <Input
              value={block.title}
              onChange={e => onUpdate(block.id, { title: e.target.value })}
              placeholder="Block title"
              className="h-8 text-sm"
            />
          </div>
          {fields.map(field => (
            <div key={field.key}>
              <label className="text-xs text-muted-foreground block mb-1">{field.label}</label>
              {field.multiline ? (
                <textarea
                  value={content[field.key] ?? ""}
                  onChange={e => onUpdate(block.id, { content: { ...content, [field.key]: e.target.value } })}
                  placeholder={field.placeholder}
                  rows={4}
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
    setBlocks(prev => [...prev, block])
    setNewTitle("")
    setNewContent({})
  }

  function updateBlock(id: string, updates: Partial<ContentBlock>) {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
  }

  function removeBlock(id: string) {
    setBlocks(prev => prev.filter(b => b.id !== id).map((b, i) => ({ ...b, order: i })))
    if (editingId === id) setEditingId(null)
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
              <SelectTrigger className="w-36 shrink-0">
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
            <Input
              placeholder="Block title"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && newFields.length === 0) addBlock() }}
              className="flex-1"
            />
            <Button type="button" variant="outline" size="sm" onClick={addBlock} className="shrink-0">
              <Plus className="size-4 mr-1" /> Add
            </Button>
          </div>

          {/* Content fields for the new block — shown inline below the header row */}
          {newFields.map(field => (
            <div key={field.key}>
              <label className="text-xs text-muted-foreground block mb-1">{field.label}</label>
              {field.multiline ? (
                <textarea
                  value={newContent[field.key] ?? ""}
                  onChange={e => setNewContent(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  rows={3}
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
