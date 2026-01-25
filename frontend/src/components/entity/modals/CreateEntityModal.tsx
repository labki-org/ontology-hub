import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface CreateEntityModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when the modal is closed */
  onClose: () => void
  /** Modal title (e.g., "Create Category") */
  title: string
  /** Optional description for accessibility */
  description?: string
  /** The form component to render inside the modal */
  children: ReactNode
}

/**
 * Generic modal wrapper for entity creation.
 *
 * Features:
 * - Consistent styling across all entity creation forms
 * - Required fields legend with asterisk explanation
 * - Accessible dialog with title and description
 * - Closes on overlay click or escape key
 *
 * @example
 * ```tsx
 * <CreateEntityModal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   title="Create Category"
 * >
 *   <CategoryForm onSubmit={handleSubmit} onCancel={handleClose} />
 * </CreateEntityModal>
 * ```
 */
export function CreateEntityModal({
  isOpen,
  onClose,
  title,
  description,
  children,
}: CreateEntityModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">
              Fill out the form to create a new {title.toLowerCase().replace('create ', '')}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="mt-4">
          {/* Required fields legend */}
          <p className="text-sm text-muted-foreground mb-4">
            Fields marked with <span className="text-red-600 dark:text-red-500">*</span> are required
          </p>

          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
