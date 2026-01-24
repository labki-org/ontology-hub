import { type ReactNode, useCallback, useState, useEffect } from 'react'
import { Group, Panel, Separator, type Layout } from 'react-resizable-panels'

const STORAGE_KEY = 'browse-layout-v4'
const GRAPH_PANEL_ID = 'graph-panel'
const DETAIL_PANEL_ID = 'detail-panel'

interface SplitLayoutProps {
  children: [ReactNode, ReactNode]
  className?: string
}

export function SplitLayout({ children, className }: SplitLayoutProps) {
  const [graphPanel, detailPanel] = children

  // Load saved layout from localStorage
  const [defaultLayout, setDefaultLayout] = useState<Layout | undefined>()

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

  const onLayoutChange = useCallback((layout: Layout) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  }, [])

  // Default: 80% graph, 20% detail
  const initialLayout: Layout = defaultLayout ?? {
    [GRAPH_PANEL_ID]: 80,
    [DETAIL_PANEL_ID]: 20,
  }

  return (
    <div className={`${className} w-full`}>
      <Group
        orientation="vertical"
        id="browse-layout"
        defaultLayout={initialLayout}
        onLayoutChange={onLayoutChange}
        style={{ height: '100%' }}
      >
        <Panel id={GRAPH_PANEL_ID} minSize={50}>
          {graphPanel}
        </Panel>
        <Separator className="h-1.5 bg-border hover:bg-primary transition cursor-row-resize" />
        <Panel id={DETAIL_PANEL_ID} minSize={10} collapsible collapsedSize={0}>
          {detailPanel}
        </Panel>
      </Group>
    </div>
  )
}
