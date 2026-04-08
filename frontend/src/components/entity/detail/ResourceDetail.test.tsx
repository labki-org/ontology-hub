import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ResourceDetail } from './ResourceDetail'

// Use vi.hoisted so mock data is available inside vi.mock factories (which are hoisted)
const { mockResourceData, mockMediaItems } = vi.hoisted(() => ({
  mockResourceData: {
    entity_key: 'SOP/Test_procedure',
    label: 'Test Procedure',
    description: 'A test SOP',
    category_keys: ['SOP'],
    dynamic_fields: {},
    wikitext: '== Steps ==\n1. Do the thing.',
    media_refs: ['setup.png', 'result.jpg'],
    modules: [],
    bundles: [],
  },
  mockMediaItems: {
    items: [
      {
        filename: 'setup.png',
        size_bytes: 1234,
        content_type: 'image/png',
        description: 'Equipment setup photo',
        source: 'Aharoni Lab, UCLA',
        license: 'CC-BY-4.0',
        author: 'Daniel Aharoni',
      },
      {
        filename: 'result.jpg',
        size_bytes: 5678,
        content_type: 'image/jpeg',
      },
    ],
  },
}))

vi.mock('@/api/entities', () => ({
  useResource: vi.fn(() => ({
    data: mockResourceData,
    isLoading: false,
    error: null,
  })),
  useAvailableEntities: vi.fn(() => []),
}))

vi.mock('@/api/client', () => ({
  apiFetch: vi.fn(() => Promise.resolve(mockMediaItems)),
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
  beforeEach(async () => {
    vi.clearAllMocks()
    // Re-apply mock implementations that may have been overridden by prior tests
    const { useResource, useAvailableEntities } = await import('@/api/entities')
    ;(useResource as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockResourceData,
      isLoading: false,
      error: null,
    })
    ;(useAvailableEntities as ReturnType<typeof vi.fn>).mockReturnValue([])

    const { apiFetch } = await import('@/api/client')
    ;(apiFetch as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve(mockMediaItems)
    )
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

  it('fetches media metadata on mount', async () => {
    const { apiFetch } = await import('@/api/client')

    renderWithProviders(
      <ResourceDetail entityKey="SOP/Test_procedure" isEditing={false} />
    )

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/media', { v2: true })
    })
  })

  it('displays media metadata from sidecar JSON', async () => {
    await act(async () => {
      renderWithProviders(
        <ResourceDetail entityKey="SOP/Test_procedure" isEditing={false} />
      )
    })

    // Flush microtasks so the apiFetch promise resolves and setState fires
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(screen.getByText('Equipment setup photo')).toBeInTheDocument()
    expect(screen.getByText('Source: Aharoni Lab, UCLA')).toBeInTheDocument()
    expect(screen.getByText('License: CC-BY-4.0')).toBeInTheDocument()
    expect(screen.getByText('Author: Daniel Aharoni')).toBeInTheDocument()
  })

  it('does not show metadata fields when sidecar has no extra fields', async () => {
    await act(async () => {
      renderWithProviders(
        <ResourceDetail entityKey="SOP/Test_procedure" isEditing={false} />
      )
    })

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    // result.jpg has no metadata fields - just the filename should be shown
    expect(screen.getByText('result.jpg')).toBeInTheDocument()
    // Verify setup.png has metadata but result.jpg does not
    expect(screen.getByText('Equipment setup photo')).toBeInTheDocument()
    expect(screen.queryByText('Source: undefined')).not.toBeInTheDocument()
  })
})
