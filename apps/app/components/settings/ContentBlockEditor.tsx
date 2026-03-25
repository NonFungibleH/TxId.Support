"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { updateConfig } from "@/lib/actions/project"
import type { ContentBlock, ContentBlockType } from "@/lib/types/config"
import { nanoid } from "nanoid"
import { GripVertical, Trash2, Plus } from "lucide-react"

const BLOCK_TYPES: { value: ContentBlockType; label: string }[] = [
  { value: "video",      label: "Video" },
  { value: "text",       label: "Announcement" },
  { value: "tokenomics", label: "Tokenomics" },
  { value: "link",       label: "Link" },
  { value: "image",      label: "Image" },
  { value: "html",       label: "HTML" },
]

function SortableBlock({
  block,
  onRemove,
}: {
  block: ContentBlock
  onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 bg-background"
    >
      <button type="button" {...attributes} {...listeners} className="text-muted-foreground cursor-grab active:cursor-grabbing">
        <GripVertical className="size-4" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{block.title || "(untitled)"}</p>
      </div>
      <Badge variant="secondary" className="text-xs shrink-0">{block.type}</Badge>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onRemove(block.id)}
        className="text-destructive hover:text-destructive shrink-0"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}

interface ContentBlockEditorProps {
  projectId: string
  initialBlocks: ContentBlock[]
}

export function ContentBlockEditor({ projectId, initialBlocks }: ContentBlockEditorProps) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(
    [...initialBlocks].sort((a, b) => a.order - b.order)
  )
  const [newType, setNewType] = useState<ContentBlockType>("text")
  const [newTitle, setNewTitle] = useState("")
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
    const block: ContentBlock = {
      id: nanoid(),
      type: newType,
      title: newTitle.trim() || newType,
      content: "",
      order: blocks.length,
    }
    setBlocks(prev => [...prev, block])
    setNewTitle("")
  }

  function removeBlock(id: string) {
    setBlocks(prev => prev.filter(b => b.id !== id).map((b, i) => ({ ...b, order: i })))
  }

  function save() {
    startTransition(async () => {
      try {
        await updateConfig(projectId, { contentBlocks: blocks })
        toast.success("Content blocks saved")
      } catch {
        toast.error("Failed to save content blocks")
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Block list */}
      {blocks.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {blocks.map(block => (
                <SortableBlock key={block.id} block={block} onRemove={removeBlock} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">No content blocks yet.</p>
      )}

      {/* Add new block */}
      {blocks.length < 10 && (
        <div className="flex gap-2 items-center border-t border-border pt-4">
          <Select value={newType} onValueChange={v => v && setNewType(v as ContentBlockType)}>
            <SelectTrigger className="w-36">
              <SelectValue />
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
            className="flex-1"
          />
          <Button type="button" variant="outline" size="sm" onClick={addBlock}>
            <Plus className="size-4 mr-1" /> Add
          </Button>
        </div>
      )}

      <Button onClick={save} disabled={isPending}>
        {isPending ? "Saving…" : "Save content"}
      </Button>
    </div>
  )
}
