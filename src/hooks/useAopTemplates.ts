"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import type { FilterValue } from "@/components/filters/FilterBar"
import {
  buildTemplatePayload,
  mergeWithInitialFilter,
} from "@/lib/aop-templates"

export interface AopTemplate {
  id: string
  name: string
  payload: Record<string, unknown>
  created_at?: string
}

export interface UseAopTemplatesOptions {
  filterValue: FilterValue
  setFilterValue: React.Dispatch<React.SetStateAction<FilterValue>>
  initialFilter: FilterValue
  /** Templates API base, e.g. "/api/aop/templates" */
  templatesEndpoint?: string
}

export interface UseAopTemplatesReturn {
  templates: AopTemplate[]
  templatesLoading: boolean
  selectedTemplateId: string | null
  selectedTemplateName: string | null
  loadTemplateOpen: boolean
  setLoadTemplateOpen: React.Dispatch<React.SetStateAction<boolean>>
  createTemplateMode: boolean
  setCreateTemplateMode: React.Dispatch<React.SetStateAction<boolean>>
  fetchTemplates: (caller?: string) => Promise<void>
  handleLoadTemplate: (template: { id: string; payload: Record<string, unknown> } | null) => void
  openSaveTemplateModal: () => void
  exitCreateTemplateMode: () => void
  handleSaveTemplate: () => Promise<void>
  handleUpdateTemplate: () => Promise<void>
  handleDeleteTemplate: () => Promise<void>
  templateModalOpen: boolean
  setTemplateModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  templateName: string
  setTemplateName: React.Dispatch<React.SetStateAction<string>>
  templateSaveError: string | null
  templateUpdateError: string | null
  templateDeleteError: string | null
  deleteConfirmTemplate: { id: string; name: string } | null
  setDeleteConfirmTemplate: React.Dispatch<React.SetStateAction<{ id: string; name: string } | null>>
  templateUpdating: boolean
  setTemplateUpdateError: React.Dispatch<React.SetStateAction<string | null>>
  setTemplateDeleteError: React.Dispatch<React.SetStateAction<string | null>>
  setTemplateSaveError: React.Dispatch<React.SetStateAction<string | null>>
}

export function useAopTemplates({
  filterValue,
  setFilterValue,
  initialFilter,
  templatesEndpoint = "/api/aop/templates",
}: UseAopTemplatesOptions): UseAopTemplatesReturn {
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [templates, setTemplates] = useState<AopTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [loadTemplateOpen, setLoadTemplateOpen] = useState(false)
  const [createTemplateMode, setCreateTemplateMode] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [deleteConfirmTemplate, setDeleteConfirmTemplate] = useState<{
    id: string
    name: string
  } | null>(null)
  const [templateSaveError, setTemplateSaveError] = useState<string | null>(null)
  const [templateUpdateError, setTemplateUpdateError] = useState<string | null>(null)
  const [templateDeleteError, setTemplateDeleteError] = useState<string | null>(null)
  const [templateUpdating, setTemplateUpdating] = useState(false)
  const [, startTransition] = useTransition()

  const fetchTemplates = useCallback(async (_caller?: string) => {
    setTemplatesLoading(true)
    try {
      const res = await fetch(`${templatesEndpoint}?limit=50`)
      const json = await res.json()
      if (json.status === "success" && Array.isArray(json.data)) {
        setTemplates(json.data)
      } else {
        setTemplates([])
      }
    } catch {
      setTemplates([])
    } finally {
      setTemplatesLoading(false)
    }
  }, [templatesEndpoint])

  useEffect(() => {
    fetchTemplates("mount")
  }, [fetchTemplates])

  const handleLoadTemplate = useCallback(
    (template: { id: string; payload: Record<string, unknown> } | null) => {
      if (template === null) {
        startTransition(() => setFilterValue(initialFilter))
        setSelectedTemplateId(null)
      } else {
        startTransition(() =>
          setFilterValue(mergeWithInitialFilter(initialFilter, template.payload))
        )
        setSelectedTemplateId(template.id)
      }
      setLoadTemplateOpen(false)
    },
    [initialFilter, setFilterValue]
  )

  const openSaveTemplateModal = useCallback(() => {
    setTemplateName("")
    setTemplateSaveError(null)
    setTemplateModalOpen(true)
  }, [])

  const exitCreateTemplateMode = useCallback(() => {
    setCreateTemplateMode(false)
  }, [])

  const handleSaveTemplate = useCallback(async () => {
    const name = templateName.trim()
    if (!name) {
      setTemplateSaveError("Template name is required")
      return
    }
    setTemplateSaveError(null)
    const payload = buildTemplatePayload(filterValue)
    try {
      const res = await fetch(templatesEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, payload }),
      })
      const json = await res.json()
      if (json.status !== "success") {
        setTemplateSaveError(json.message || "Failed to save template")
        return
      }
      setTemplateModalOpen(false)
      setTemplateName("")
      await fetchTemplates("after_save")
    } catch (e) {
      setTemplateSaveError(e instanceof Error ? e.message : "Failed to save template")
    }
  }, [filterValue, templateName, fetchTemplates, templatesEndpoint])

  const handleUpdateTemplate = useCallback(async () => {
    if (!selectedTemplateId || templateUpdating) return
    setTemplateUpdateError(null)
    setTemplateUpdating(true)
    const payload = buildTemplatePayload(filterValue)
    try {
      const res = await fetch(`${templatesEndpoint}/${selectedTemplateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      })
      const json = await res.json()
      if (json.status !== "success") {
        setTemplateUpdateError(json.message || "Failed to update template")
        return
      }
      await fetchTemplates("after_update")
    } catch (e) {
      setTemplateUpdateError(e instanceof Error ? e.message : "Failed to update template")
    } finally {
      setTemplateUpdating(false)
    }
  }, [filterValue, selectedTemplateId, templateUpdating, fetchTemplates, templatesEndpoint])

  const handleDeleteTemplate = useCallback(async () => {
    const t = deleteConfirmTemplate
    if (!t) return
    setTemplateDeleteError(null)
    try {
      const res = await fetch(`${templatesEndpoint}/${t.id}`, { method: "DELETE" })
      const json = await res.json()
      if (json.status !== "success") {
        setTemplateDeleteError(json.message || "Failed to delete template")
        return
      }
      setDeleteConfirmTemplate(null)
      if (selectedTemplateId === t.id) {
        setSelectedTemplateId(null)
        startTransition(() => setFilterValue(initialFilter))
      }
      await fetchTemplates("after_delete")
    } catch (e) {
      setTemplateDeleteError(e instanceof Error ? e.message : "Failed to delete template")
    }
  }, [
    deleteConfirmTemplate,
    selectedTemplateId,
    initialFilter,
    setFilterValue,
    fetchTemplates,
    templatesEndpoint,
  ])

  const selectedTemplateName =
    selectedTemplateId != null
      ? templates.find((t) => t.id === selectedTemplateId)?.name ?? null
      : null

  return {
    templates,
    templatesLoading,
    selectedTemplateId,
    selectedTemplateName,
    loadTemplateOpen,
    setLoadTemplateOpen,
    createTemplateMode,
    setCreateTemplateMode,
    fetchTemplates,
    handleLoadTemplate,
    openSaveTemplateModal,
    exitCreateTemplateMode,
    handleSaveTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    templateModalOpen,
    setTemplateModalOpen,
    templateName,
    setTemplateName,
    templateSaveError,
    templateUpdateError,
    templateDeleteError,
    deleteConfirmTemplate,
    setDeleteConfirmTemplate,
    templateUpdating,
    setTemplateUpdateError,
    setTemplateDeleteError,
    setTemplateSaveError,
  }
}
