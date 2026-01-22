import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Layers, Plus, X, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useModules, useProfiles } from '@/api/modules'
import { useDraftStore } from '@/stores/draftStore'
import { cn } from '@/lib/utils'
import type { EntityChange, ProfileDefinition } from '@/api/types'

interface ProfileEditorProps {
  profileChanges: EntityChange[]
}

interface NewProfileFormData {
  profile_id: string
  label: string
  description: string
  module_ids: string[]
}

function ProfileModuleSelector({
  profileId,
  currentModules,
  isNew = false,
}: {
  profileId: string
  currentModules: string[]
  isNew?: boolean
}) {
  const { data: modules } = useModules()
  const { updateProfileModules, profileEdits } = useDraftStore()

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Get edited modules or use current
  const editedModules = profileEdits.get(profileId) ?? currentModules

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  if (!modules) return null

  const selectedModules = modules.filter((m) =>
    editedModules.includes(m.module_id)
  )
  const availableModules = modules.filter(
    (m) => !editedModules.includes(m.module_id)
  )

  const handleAdd = (moduleId: string) => {
    updateProfileModules(profileId, [...editedModules, moduleId])
    setIsDropdownOpen(false)
  }

  const handleRemove = (moduleId: string) => {
    updateProfileModules(
      profileId,
      editedModules.filter((id) => id !== moduleId)
    )
  }

  // Check for missing dependencies
  const missingDeps: string[] = []
  for (const moduleId of editedModules) {
    const mod = modules.find((m) => m.module_id === moduleId)
    if (mod) {
      for (const dep of mod.dependencies) {
        if (!editedModules.includes(dep)) {
          missingDeps.push(`${mod.label} requires ${modules.find((m) => m.module_id === dep)?.label || dep}`)
        }
      }
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 items-center">
        {selectedModules.map((mod) => (
          <Badge key={mod.module_id} variant="secondary" className="gap-1 pr-1">
            {mod.label}
            <button
              onClick={() => handleRemove(mod.module_id)}
              className="ml-1 hover:bg-muted rounded-full p-0.5"
              title="Remove module"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        <div className="relative" ref={dropdownRef}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="h-7 gap-1"
            disabled={availableModules.length === 0}
          >
            <Plus className="h-3 w-3" />
            Add Module
            <ChevronDown
              className={cn(
                'h-3 w-3 transition-transform',
                isDropdownOpen && 'rotate-180'
              )}
            />
          </Button>

          {isDropdownOpen && availableModules.length > 0 && (
            <Card className="absolute top-full left-0 mt-1 z-50 w-64 p-1 shadow-lg">
              <div className="max-h-48 overflow-y-auto">
                {availableModules.map((mod) => (
                  <button
                    key={mod.module_id}
                    onClick={() => handleAdd(mod.module_id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-sm transition-colors"
                  >
                    <div className="font-medium">{mod.label}</div>
                    {mod.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {mod.description}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {missingDeps.length > 0 && (
        <div className="flex items-start gap-2 rounded-md p-2 text-sm bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-medium">Missing Dependencies: </span>
            {missingDeps.join(', ')}
          </div>
        </div>
      )}

      {isNew && selectedModules.length === 0 && (
        <div className="text-sm text-muted-foreground italic">
          Add at least one module to this profile
        </div>
      )}
    </div>
  )
}

function NewProfileDialog({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: NewProfileFormData) => void
}) {
  const [formData, setFormData] = useState<NewProfileFormData>({
    profile_id: '',
    label: '',
    description: '',
    module_ids: [],
  })
  const { data: modules } = useModules()
  const [isModuleDropdownOpen, setIsModuleDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsModuleDropdownOpen(false)
      }
    }

    if (isModuleDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isModuleDropdownOpen])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.profile_id && formData.label && formData.module_ids.length > 0) {
      onSubmit(formData)
      setFormData({ profile_id: '', label: '', description: '', module_ids: [] })
      onClose()
    }
  }

  const selectedModules = modules?.filter((m) =>
    formData.module_ids.includes(m.module_id)
  ) || []
  const availableModules = modules?.filter(
    (m) => !formData.module_ids.includes(m.module_id)
  ) || []

  const addModule = (moduleId: string) => {
    setFormData({
      ...formData,
      module_ids: [...formData.module_ids, moduleId],
    })
    setIsModuleDropdownOpen(false)
  }

  const removeModule = (moduleId: string) => {
    setFormData({
      ...formData,
      module_ids: formData.module_ids.filter((id) => id !== moduleId),
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Create New Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Profile ID</label>
              <input
                type="text"
                value={formData.profile_id}
                onChange={(e) =>
                  setFormData({ ...formData, profile_id: e.target.value })
                }
                className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                placeholder="e.g., research-lab"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium">Label</label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) =>
                  setFormData({ ...formData, label: e.target.value })
                }
                className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                placeholder="e.g., Research Laboratory"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full mt-1 px-3 py-2 border rounded-md bg-background resize-y"
                placeholder="Optional description..."
                rows={2}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Modules</label>
              <div className="mt-1 flex flex-wrap gap-1 items-center">
                {selectedModules.map((mod) => (
                  <Badge key={mod.module_id} variant="secondary" className="gap-1 pr-1">
                    {mod.label}
                    <button
                      type="button"
                      onClick={() => removeModule(mod.module_id)}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}

                <div className="relative" ref={dropdownRef}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsModuleDropdownOpen(!isModuleDropdownOpen)}
                    className="h-7 gap-1"
                    disabled={availableModules.length === 0}
                  >
                    <Plus className="h-3 w-3" />
                    Add
                    <ChevronDown
                      className={cn(
                        'h-3 w-3 transition-transform',
                        isModuleDropdownOpen && 'rotate-180'
                      )}
                    />
                  </Button>

                  {isModuleDropdownOpen && availableModules.length > 0 && (
                    <Card className="absolute top-full left-0 mt-1 z-50 w-56 p-1 shadow-lg">
                      <div className="max-h-32 overflow-y-auto">
                        {availableModules.map((mod) => (
                          <button
                            key={mod.module_id}
                            type="button"
                            onClick={() => addModule(mod.module_id)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-sm"
                          >
                            {mod.label}
                          </button>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              </div>
              {formData.module_ids.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  At least one module is required
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !formData.profile_id ||
                  !formData.label ||
                  formData.module_ids.length === 0
                }
              >
                Create Profile
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export function ProfileEditor({ profileChanges }: ProfileEditorProps) {
  const { data: existingProfiles } = useProfiles()
  const { newProfiles, addNewProfile, profileEdits } = useDraftStore()

  const [showNewProfileDialog, setShowNewProfileDialog] = useState(false)

  const handleCreateProfile = (data: NewProfileFormData) => {
    const profile: ProfileDefinition = {
      profile_id: data.profile_id,
      label: data.label,
      description: data.description || undefined,
      module_ids: data.module_ids,
    }
    addNewProfile(profile)
  }

  // Combine existing, changed, and new profiles
  const addedProfiles = profileChanges.filter(
    (c) => c.new && !c.old
  )
  const modifiedProfiles = profileChanges.filter(
    (c) => c.new && c.old
  )

  const hasAnyProfiles =
    (existingProfiles?.length || 0) > 0 ||
    addedProfiles.length > 0 ||
    newProfiles.length > 0

  if (!hasAnyProfiles && modifiedProfiles.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layers className="h-5 w-5" />
            Profiles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <p className="mb-4">No profiles to edit</p>
            <Button
              variant="outline"
              onClick={() => setShowNewProfileDialog(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Create New Profile
            </Button>
          </div>

          <NewProfileDialog
            isOpen={showNewProfileDialog}
            onClose={() => setShowNewProfileDialog(false)}
            onSubmit={handleCreateProfile}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg">
            <Layers className="h-5 w-5" />
            Profiles
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewProfileDialog(true)}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            New Profile
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing profiles */}
        {existingProfiles?.map((profile) => (
          <div
            key={profile.profile_id}
            className="border rounded-lg p-3 space-y-2"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium">{profile.label}</h4>
                <p className="text-sm text-muted-foreground">
                  {profile.profile_id}
                </p>
              </div>
              {profileEdits.has(profile.profile_id) && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                  Modified
                </Badge>
              )}
            </div>
            <ProfileModuleSelector
              profileId={profile.profile_id}
              currentModules={profile.module_ids}
            />
          </div>
        ))}

        {/* Profiles added in this draft */}
        {addedProfiles.map((change) => (
          <div
            key={change.entity_id}
            className="border rounded-lg p-3 space-y-2 border-green-200 dark:border-green-900"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium">
                  {(change.new?.label as string) || change.entity_id}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {change.entity_id}
                </p>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700">
                New in draft
              </Badge>
            </div>
            <ProfileModuleSelector
              profileId={change.entity_id}
              currentModules={((change.new?.module_ids as string[]) || [])}
            />
          </div>
        ))}

        {/* New profiles created during this review */}
        {newProfiles.map((profile) => (
          <div
            key={profile.profile_id}
            className="border rounded-lg p-3 space-y-2 border-blue-200 dark:border-blue-900"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium">{profile.label}</h4>
                <p className="text-sm text-muted-foreground">
                  {profile.profile_id}
                </p>
              </div>
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                Created in review
              </Badge>
            </div>
            <ProfileModuleSelector
              profileId={profile.profile_id}
              currentModules={profile.module_ids}
              isNew
            />
          </div>
        ))}

        <NewProfileDialog
          isOpen={showNewProfileDialog}
          onClose={() => setShowNewProfileDialog(false)}
          onSubmit={handleCreateProfile}
        />
      </CardContent>
    </Card>
  )
}
