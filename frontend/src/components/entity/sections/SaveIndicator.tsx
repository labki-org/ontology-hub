interface SaveIndicatorProps {
  isSaving: boolean
}

/**
 * Fixed-position save indicator shown during auto-save operations.
 * Shared across all detail panel components.
 */
export function SaveIndicator({ isSaving }: SaveIndicatorProps) {
  if (!isSaving) return null

  return (
    <div className="fixed top-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded text-sm z-50">
      Saving...
    </div>
  )
}
