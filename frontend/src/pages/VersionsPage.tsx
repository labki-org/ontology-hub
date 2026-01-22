import { useState, useEffect } from 'react'
import { History, ArrowRight } from 'lucide-react'
import { useReleases, useVersionDiff } from '@/api/versions'
import { DiffViewer } from '@/components/version/DiffViewer'
import { VersionList } from '@/components/version/VersionList'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function VersionsPage() {
  const { data: releases, isLoading: releasesLoading, error: releasesError } = useReleases()

  // Default: compare latest (index 0) with previous (index 1)
  const [oldVersion, setOldVersion] = useState<string | null>(null)
  const [newVersion, setNewVersion] = useState<string | null>(null)

  // Set default versions when releases load
  useEffect(() => {
    if (releases && releases.length >= 2 && !oldVersion && !newVersion) {
      setNewVersion(releases[0].tag_name)
      setOldVersion(releases[1].tag_name)
    } else if (releases && releases.length === 1 && !newVersion) {
      setNewVersion(releases[0].tag_name)
    }
  }, [releases, oldVersion, newVersion])

  const {
    data: diff,
    isLoading: diffLoading,
    error: diffError,
  } = useVersionDiff(oldVersion, newVersion)

  const handleVersionSelect = (tagName: string) => {
    // If clicking on the same version that's already selected, do nothing
    if (tagName === oldVersion || tagName === newVersion) return

    // Find the index of the clicked version
    const clickedIndex = releases?.findIndex((r) => r.tag_name === tagName) ?? -1
    const oldIndex = releases?.findIndex((r) => r.tag_name === oldVersion) ?? -1
    const newIndex = releases?.findIndex((r) => r.tag_name === newVersion) ?? -1

    // If the clicked version is newer than current new, make it the new version
    if (clickedIndex < newIndex) {
      setNewVersion(tagName)
    }
    // If the clicked version is older than current old, make it the old version
    else if (clickedIndex > oldIndex) {
      setOldVersion(tagName)
    }
    // Otherwise, intelligently set based on which would make more sense
    else if (newVersion && clickedIndex < releases!.length - 1) {
      setOldVersion(tagName)
    } else {
      setNewVersion(tagName)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <History className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Version History</h1>
        </div>
        <p className="text-muted-foreground mt-2">
          Compare changes between different versions of the schema.
        </p>
      </div>

      {/* Error State */}
      {releasesError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load releases</p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {releasesLoading && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-6 w-6" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {/* Main Content */}
      {releases && !releasesLoading && (
        <>
          {releases.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No releases found in this repository.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Create a release on GitHub to enable version comparison.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
              <div className="space-y-6">
                {/* Version Comparison Selector */}
                <Card>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Compare</span>
                        <select
                          value={oldVersion || ''}
                          onChange={(e) => setOldVersion(e.target.value || null)}
                          className="px-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                          aria-label="Select old version"
                        >
                          <option value="">Select version...</option>
                          {releases.map((r) => (
                            <option
                              key={r.tag_name}
                              value={r.tag_name}
                              disabled={r.tag_name === newVersion}
                            >
                              {r.tag_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">with</span>
                        <select
                          value={newVersion || ''}
                          onChange={(e) => setNewVersion(e.target.value || null)}
                          className="px-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                          aria-label="Select new version"
                        >
                          <option value="">Select version...</option>
                          {releases.map((r) => (
                            <option
                              key={r.tag_name}
                              value={r.tag_name}
                              disabled={r.tag_name === oldVersion}
                            >
                              {r.tag_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Diff Viewer */}
                {diffError && (
                  <Card className="border-destructive">
                    <CardContent className="pt-6">
                      <p className="text-destructive">Failed to load diff</p>
                    </CardContent>
                  </Card>
                )}

                {diffLoading && (
                  <div className="space-y-4">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                )}

                {diff && !diffLoading && <DiffViewer diff={diff} />}

                {!diff && !diffLoading && !diffError && oldVersion && newVersion && (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      Select two versions to compare
                    </CardContent>
                  </Card>
                )}

                {!oldVersion || !newVersion ? (
                  releases.length < 2 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        At least 2 releases are needed to compare versions.
                      </CardContent>
                    </Card>
                  ) : null
                ) : null}
              </div>

              {/* Version List Sidebar */}
              <div className="lg:sticky lg:top-4 lg:h-fit">
                <VersionList
                  releases={releases}
                  selected={newVersion || oldVersion || undefined}
                  onSelect={handleVersionSelect}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
