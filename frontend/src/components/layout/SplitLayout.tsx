import { ReactNode } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

interface SplitLayoutProps {
  children: [ReactNode, ReactNode]
  className?: string
}

export function SplitLayout({ children, className }: SplitLayoutProps) {
  const [graphPanel, detailPanel] = children

  return (
    <div className={className}>
      <PanelGroup direction="vertical" autoSaveId="browse-layout">
        <Panel defaultSize={60} minSize={30}>
          {graphPanel}
        </Panel>
        <PanelResizeHandle className="h-1.5 bg-border hover:bg-primary transition" />
        <Panel defaultSize={40} minSize={20}>
          {detailPanel}
        </Panel>
      </PanelGroup>
    </div>
  )
}
