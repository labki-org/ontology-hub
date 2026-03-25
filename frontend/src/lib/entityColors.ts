export type EntityType =
  | 'category'
  | 'property'
  | 'subobject'
  | 'template'
  | 'dashboard'
  | 'resource'
  | 'module'
  | 'bundle'

export interface EntityColorScheme {
  sectionBg: string
  sectionBorder: string
  chipBg: string
  chipText: string
  chipBorder: string
}

const neutral: EntityColorScheme = {
  sectionBg: 'bg-muted/50',
  sectionBorder: 'border-border',
  chipBg: '',
  chipText: '',
  chipBorder: '',
}

const colorMap: Record<EntityType, EntityColorScheme> = {
  category: {
    sectionBg: 'bg-slate-50 dark:bg-slate-900/20',
    sectionBorder: 'border-slate-200 dark:border-slate-800',
    chipBg: 'bg-slate-100 dark:bg-slate-800/40',
    chipText: 'text-slate-700 dark:text-slate-300',
    chipBorder: 'border-slate-300 dark:border-slate-600',
  },
  property: {
    sectionBg: 'bg-emerald-50 dark:bg-emerald-950/20',
    sectionBorder: 'border-emerald-200 dark:border-emerald-800',
    chipBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    chipText: 'text-emerald-700 dark:text-emerald-300',
    chipBorder: 'border-emerald-300 dark:border-emerald-700',
  },
  subobject: {
    sectionBg: 'bg-violet-50 dark:bg-violet-950/20',
    sectionBorder: 'border-violet-200 dark:border-violet-800',
    chipBg: 'bg-violet-100 dark:bg-violet-900/30',
    chipText: 'text-violet-700 dark:text-violet-300',
    chipBorder: 'border-violet-300 dark:border-violet-700',
  },
  template: {
    sectionBg: 'bg-amber-50 dark:bg-amber-950/20',
    sectionBorder: 'border-amber-200 dark:border-amber-800',
    chipBg: 'bg-amber-100 dark:bg-amber-900/30',
    chipText: 'text-amber-700 dark:text-amber-300',
    chipBorder: 'border-amber-300 dark:border-amber-700',
  },
  dashboard: {
    sectionBg: 'bg-red-50 dark:bg-red-950/20',
    sectionBorder: 'border-red-200 dark:border-red-800',
    chipBg: 'bg-red-100 dark:bg-red-900/30',
    chipText: 'text-red-700 dark:text-red-300',
    chipBorder: 'border-red-300 dark:border-red-700',
  },
  resource: {
    sectionBg: 'bg-cyan-50 dark:bg-cyan-950/20',
    sectionBorder: 'border-cyan-200 dark:border-cyan-800',
    chipBg: 'bg-cyan-100 dark:bg-cyan-900/30',
    chipText: 'text-cyan-700 dark:text-cyan-300',
    chipBorder: 'border-cyan-300 dark:border-cyan-700',
  },
  module: {
    sectionBg: 'bg-slate-50 dark:bg-slate-900/20',
    sectionBorder: 'border-slate-200 dark:border-slate-800',
    chipBg: 'bg-slate-100 dark:bg-slate-800/40',
    chipText: 'text-slate-700 dark:text-slate-300',
    chipBorder: 'border-slate-300 dark:border-slate-600',
  },
  bundle: {
    sectionBg: 'bg-slate-50 dark:bg-slate-900/20',
    sectionBorder: 'border-slate-200 dark:border-slate-800',
    chipBg: 'bg-slate-100 dark:bg-slate-800/40',
    chipText: 'text-slate-700 dark:text-slate-300',
    chipBorder: 'border-slate-300 dark:border-slate-600',
  },
}

export function getEntityColors(type?: EntityType): EntityColorScheme {
  if (!type) return neutral
  return colorMap[type] ?? neutral
}
