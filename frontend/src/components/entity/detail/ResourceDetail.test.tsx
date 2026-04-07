import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ResourceDetail } from './ResourceDetail'
import type { ResourceDetailV2 } from '@/api/types'

// Mock the API hooks
const mockResourceData: ResourceDetailV2 = {
  entity_key: 'SOP/Test_procedure',
  label: 'Test Procedure',
  description: 'A test SOP',
  category_keys: ['SOP'],
  dynamic_fields: {},
  wikitext: '== Steps ==\n1. Do the thing.',
  media_refs: ['setup.png', 'result.jpg'],
  modules: [],
  bundles: [],
}

vi.mock('@/api/entities', () => ({
  useResource: vi.fn(() => ({
    data: mockResourceData,
    isLoading: false,
    error: null,
  })),
  useAvailableEntities: vi.fn(() => []),
}))

vi.mock('@/stores/graphStore', () => ({
  useGraphStore: vi.fn(() => vi.fn()),
}))

vi.mock('@/hooks/useAutoSave', () => ({
  useAutoSave: vi.fn(() => ({
    saveChange: vi.fn(),
    isSaving: false,
  })),
}))

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe('ResourceDetail Media Section', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders media section when media_refs is present', () => {
    renderWithProviders(
      <ResourceDetail entityKey="SOP/Test_procedure" isEditing={false} />
    )

    expect(screen.getByText('Media')).toBeInTheDocument()
    expect(screen.getByText('setup.png')).toBeInTheDocument()
    expect(screen.getByText('result.jpg')).toBeInTheDocument()
  })

  it('renders images with correct src attributes', () => {
    renderWithProviders(
      <ResourceDetail entityKey="SOP/Test_procedure" isEditing={false} />
    )

    const images = screen.getAllByRole('img')
    const mediaSrcs = images.map((img) => img.getAttribute('src'))
    expect(mediaSrcs).toContain('/api/v2/media/setup.png')
    expect(mediaSrcs).toContain('/api/v2/media/result.jpg')
  })

  it('does not render media section when media_refs is empty', async () => {
    const { useResource } = await import('@/api/entities')
    ;(useResource as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { ...mockResourceData, media_refs: [] },
      isLoading: false,
      error: null,
    })

    renderWithProviders(
      <ResourceDetail entityKey="SOP/Test_procedure" isEditing={false} />
    )

    expect(screen.queryByText('Media')).not.toBeInTheDocument()
  })

  it('does not render media section when media_refs is undefined', async () => {
    const { useResource } = await import('@/api/entities')
    const dataWithoutMedia = { ...mockResourceData }
    delete (dataWithoutMedia as Record<string, unknown>).media_refs
    ;(useResource as ReturnType<typeof vi.fn>).mockReturnValue({
      data: dataWithoutMedia,
      isLoading: false,
      error: null,
    })

    renderWithProviders(
      <ResourceDetail entityKey="SOP/Test_procedure" isEditing={false} />
    )

    expect(screen.queryByText('Media')).not.toBeInTheDocument()
  })
})
