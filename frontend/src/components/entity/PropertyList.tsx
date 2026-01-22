import { Link } from 'react-router-dom'
import { Tag, Package } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface PropertyListProps {
  properties: string[]
  subobjects: string[]
}

export function PropertyList({ properties, subobjects }: PropertyListProps) {
  if (properties.length === 0 && subobjects.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">
            No properties or subobjects defined
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <ul className="space-y-2">
          {properties.map((propertyId) => (
            <li key={propertyId}>
              <Link
                to={`/property/${propertyId}`}
                className="flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors"
              >
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-sm">{propertyId}</span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  declared
                </Badge>
              </Link>
            </li>
          ))}
          {subobjects.map((subobjectId) => (
            <li key={subobjectId}>
              <Link
                to={`/subobject/${subobjectId}`}
                className="flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors"
              >
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-sm">{subobjectId}</span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  declared
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
