"use client"

import React, { createContext, useContext, useState } from "react"
import type { ProjectConfig } from "@/lib/types/config"

interface ProjectContextValue {
  projectId: string
  config: ProjectConfig
  setConfig: (config: ProjectConfig) => void
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectProvider({
  projectId,
  initialConfig,
  children,
}: {
  projectId: string
  initialConfig: ProjectConfig
  children: React.ReactNode
}) {
  const [config, setConfig] = useState<ProjectConfig>(initialConfig)

  return (
    <ProjectContext.Provider value={{ projectId, config, setConfig }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error("useProject must be used within ProjectProvider")
  return ctx
}
