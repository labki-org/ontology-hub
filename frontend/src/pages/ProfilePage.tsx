import { useParams } from 'react-router-dom'
import { Layers, Boxes, Tag, Package } from 'lucide-react'
import { useProfile, useProfileModules } from '@/api/modules'
import { ModuleCard } from '@/components/module/ModuleCard'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

export function ProfilePage() {
  const { profileId } = useParams<{ profileId: string }>()
  const { data: profile, isLoading: profileLoading, error: profileError } = useProfile(profileId!)
  const { data: modules, isLoading: modulesLoading } = useProfileModules(profileId!)

  if (profileLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (profileError || !profile) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <h1 className="text-xl font-semibold text-destructive">Profile Not Found</h1>
          <p className="text-muted-foreground mt-2">
            The profile "{profileId}" could not be found.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Calculate entity summary from modules
  const entitySummary = modules?.reduce(
    (acc, mod) => ({
      categories: acc.categories + (mod.category_ids?.length || 0),
      modules: acc.modules + 1,
    }),
    { categories: 0, modules: 0 }
  ) || { categories: 0, modules: 0 }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-6 w-6 text-muted-foreground" />
              <div>
                <CardTitle className="text-2xl">{profile.label}</CardTitle>
                <p className="text-sm text-muted-foreground font-mono mt-1">
                  {profile.profile_id}
                </p>
              </div>
            </div>
            <Badge variant="outline">
              {profile.module_ids?.length || 0} modules
            </Badge>
          </div>
        </CardHeader>
        {profile.description && (
          <CardContent>
            <CardDescription className="text-base">
              {profile.description}
            </CardDescription>
          </CardContent>
        )}
        <CardFooter className="text-xs text-muted-foreground">
          <div className="flex gap-4">
            {profile.commit_sha && (
              <span>Commit: {profile.commit_sha.slice(0, 7)}</span>
            )}
            <span>
              Updated: {new Date(profile.updated_at).toLocaleDateString()}
            </span>
          </div>
        </CardFooter>
      </Card>

      {/* Entity Summary */}
      {!modulesLoading && modules && modules.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Modules</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{entitySummary.modules}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <Boxes className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{entitySummary.categories}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Coverage</CardTitle>
              <Tag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Full module details below
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modules in Profile */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Included Modules</h2>
        {modulesLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6 space-y-3">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : modules && modules.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {modules.map((module) => (
              <ModuleCard key={module.id} module={module} compact />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              This profile contains no modules.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}
