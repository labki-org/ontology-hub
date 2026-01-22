import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { ModulePublic, ProfilePublic, ModuleEntitiesResponse } from './types'

// Fetch functions for modules
async function fetchModules(search?: string): Promise<ModulePublic[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  const queryString = params.toString()
  return apiFetch(`/modules${queryString ? `?${queryString}` : ''}`)
}

async function fetchModule(moduleId: string): Promise<ModulePublic> {
  return apiFetch(`/modules/${moduleId}`)
}

async function fetchModuleEntities(moduleId: string): Promise<ModuleEntitiesResponse> {
  return apiFetch(`/modules/${moduleId}/entities`)
}

async function fetchModuleOverlaps(moduleId: string): Promise<Record<string, string[]>> {
  return apiFetch(`/modules/${moduleId}/overlaps`)
}

// Fetch functions for profiles
async function fetchProfiles(search?: string): Promise<ProfilePublic[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  const queryString = params.toString()
  return apiFetch(`/profiles${queryString ? `?${queryString}` : ''}`)
}

async function fetchProfile(profileId: string): Promise<ProfilePublic> {
  return apiFetch(`/profiles/${profileId}`)
}

async function fetchProfileModules(profileId: string): Promise<ModulePublic[]> {
  return apiFetch(`/profiles/${profileId}/modules`)
}

// Query hooks for modules
export function useModules(search?: string) {
  return useQuery({
    queryKey: ['modules', search],
    queryFn: () => fetchModules(search),
  })
}

export function useModule(moduleId: string) {
  return useQuery({
    queryKey: ['module', moduleId],
    queryFn: () => fetchModule(moduleId),
    enabled: !!moduleId,
  })
}

export function useModuleEntities(moduleId: string) {
  return useQuery({
    queryKey: ['module-entities', moduleId],
    queryFn: () => fetchModuleEntities(moduleId),
    enabled: !!moduleId,
  })
}

export function useModuleOverlaps(moduleId: string) {
  return useQuery({
    queryKey: ['module-overlaps', moduleId],
    queryFn: () => fetchModuleOverlaps(moduleId),
    enabled: !!moduleId,
  })
}

// Query hooks for profiles
export function useProfiles(search?: string) {
  return useQuery({
    queryKey: ['profiles', search],
    queryFn: () => fetchProfiles(search),
  })
}

export function useProfile(profileId: string) {
  return useQuery({
    queryKey: ['profile', profileId],
    queryFn: () => fetchProfile(profileId),
    enabled: !!profileId,
  })
}

export function useProfileModules(profileId: string) {
  return useQuery({
    queryKey: ['profile-modules', profileId],
    queryFn: () => fetchProfileModules(profileId),
    enabled: !!profileId,
  })
}
