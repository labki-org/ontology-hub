import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, GitBranch, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Dropdown to enter/switch drafts or exit draft mode.
 * Shows current state and allows entering draft mode via token.
 */
export function DraftSelector() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const draftId = searchParams.get('draft_id')

  const [isOpen, setIsOpen] = useState(false)
  const [tokenInput, setTokenInput] = useState('')

  const handleEnterDraft = (e: React.FormEvent) => {
    e.preventDefault()
    if (tokenInput.trim()) {
      navigate(`/?draft_id=${encodeURIComponent(tokenInput.trim())}`)
      setIsOpen(false)
      setTokenInput('')
    }
  }

  const handleExitDraft = () => {
    navigate('/', { replace: true })
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2"
      >
        <GitBranch className="h-4 w-4" />
        <span>{draftId ? `Draft: ${draftId.slice(0, 8)}...` : 'Browse canonical'}</span>
        <ChevronDown className="h-4 w-4" />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Dropdown menu */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-background border rounded-md shadow-lg z-20">
            <div className="p-4 space-y-3">
              {draftId && (
                <div className="pb-3 border-b">
                  <div className="text-sm text-muted-foreground mb-2">Current draft</div>
                  <div className="font-mono text-xs bg-muted p-2 rounded truncate">
                    {draftId}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleExitDraft}
                    className="w-full mt-2 gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Exit draft mode
                  </Button>
                </div>
              )}

              <div>
                <div className="text-sm text-muted-foreground mb-2">Enter draft mode</div>
                <form onSubmit={handleEnterDraft} className="space-y-2">
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Enter draft token..."
                    className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <Button type="submit" size="sm" className="w-full" disabled={!tokenInput.trim()}>
                    Enter Draft
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
