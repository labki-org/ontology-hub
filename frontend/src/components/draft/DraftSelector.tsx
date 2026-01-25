import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, GitBranch, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useDraftV2 } from '@/api/draftApiV2'

/**
 * Dropdown to enter/switch drafts or exit draft mode.
 * Shows current state and allows entering draft mode via token.
 * Supports both v1 (draft_id) and v2 (draft_token) workflows.
 */
export function DraftSelector() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const draftId = searchParams.get('draft_id')
  const draftToken = searchParams.get('draft_token')

  // Fetch v2 draft data if token is present
  const { data: draftV2 } = useDraftV2(draftToken || undefined)

  const [isOpen, setIsOpen] = useState(false)
  const [tokenInput, setTokenInput] = useState('')

  const handleEnterDraft = (e: React.FormEvent) => {
    e.preventDefault()
    if (tokenInput.trim()) {
      // Use draft_token for v2 workflow (new default)
      navigate(`/browse?draft_token=${encodeURIComponent(tokenInput.trim())}`)
      setIsOpen(false)
      setTokenInput('')
    }
  }

  const handleExitDraft = () => {
    navigate('/browse', { replace: true })
    setIsOpen(false)
  }

  // Status badge for v2 drafts
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="outline" className="uppercase text-xs">{status}</Badge>
      case 'VALIDATED':
        return <Badge className="bg-green-500 hover:bg-green-600 border-green-600 text-white uppercase text-xs">{status}</Badge>
      case 'SUBMITTED':
        return <Badge className="bg-blue-500 hover:bg-blue-600 border-blue-600 text-white uppercase text-xs">{status}</Badge>
      case 'MERGED':
        return <Badge className="bg-purple-500 hover:bg-purple-600 border-purple-600 text-white uppercase text-xs">{status}</Badge>
      case 'REJECTED':
        return <Badge className="bg-red-500 hover:bg-red-600 border-red-600 text-white uppercase text-xs">{status}</Badge>
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>
    }
  }

  // Determine display text
  const currentDraft = draftToken || draftId
  const displayText = currentDraft
    ? `Draft: ${currentDraft.slice(0, 8)}...`
    : 'Browse canonical'

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2"
      >
        <GitBranch className="h-4 w-4" />
        <span>{displayText}</span>
        {draftV2 && getStatusBadge(draftV2.status)}
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
              {currentDraft && (
                <div className="pb-3 border-b">
                  <div className="text-sm text-muted-foreground mb-2">Current draft</div>
                  <div className="font-mono text-xs bg-muted p-2 rounded truncate">
                    {currentDraft}
                  </div>
                  {draftV2 && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Status:</span>
                      {getStatusBadge(draftV2.status)}
                    </div>
                  )}
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
