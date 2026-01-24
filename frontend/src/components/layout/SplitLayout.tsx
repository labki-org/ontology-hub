import { ReactNode, useCallback, useState, useEffect } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'

const STORAGE_KEY = 'browse-layout'

interface SplitLayoutProps {
  children: [ReactNode, ReactNode]
  className?: string
}

export function SplitLayout({ children, className }: SplitLayoutProps) {
  const [graphPanel, detailPanel] = children

  // Load saved layout from localStorage
  const [defaultLayout, setDefaultLayout] = useState<number[] | undefined>()

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        setDefaultLayout(JSON.parse(saved))
      } catch {
        // Ignore parse errors
      }
    }
  }, [])

  const onLayoutChange = useCallback((sizes: number[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes))
  }, [])

  return (
    <div className={className}>
      <Group
        direction="vertical"
        id="browse-layout"
        defaultLayout={defaultLayout ?? [60, 40]}
        onLayoutChange={onLayoutChange}
      >
        <Panel minSize={30}>
          {graphPanel}
        </Panel>
        <Separator className="h-1.5 bg-border hover:bg-primary transition" />
        <Panel minSize={20}>
          {detailPanel}
        </Panel>
      </Group>
    </div>
  )
}
