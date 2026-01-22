import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { ReleasePublic, VersionDiffResponse } from './types'

async function fetchReleases(): Promise<ReleasePublic[]> {
  return apiFetch('/versions/')
}

async function fetchVersionDiff(
  oldVersion: string,
  newVersion: string
): Promise<VersionDiffResponse> {
  const params = new URLSearchParams({ old: oldVersion, new: newVersion })
  return apiFetch(`/versions/diff?${params.toString()}`)
}

export function useReleases() {
  return useQuery({
    queryKey: ['releases'],
    queryFn: fetchReleases,
  })
}

export function useVersionDiff(
  oldVersion: string | null,
  newVersion: string | null
) {
  return useQuery({
    queryKey: ['version-diff', oldVersion, newVersion],
    queryFn: () => fetchVersionDiff(oldVersion!, newVersion!),
    enabled: !!oldVersion && !!newVersion,
  })
}
