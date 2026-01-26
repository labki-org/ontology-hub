const API_V1_BASE = import.meta.env.VITE_API_URL || '/api/v1'
const API_V2_BASE = '/api/v2'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface ApiFetchOptions extends RequestInit {
  /** Use v2 API base instead of v1 */
  v2?: boolean
}

export async function apiFetch<T>(
  endpoint: string,
  options?: ApiFetchOptions
): Promise<T> {
  const { v2, ...fetchOptions } = options ?? {}
  const base = v2 ? API_V2_BASE : API_V1_BASE
  const url = `${base}${endpoint}`

  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new ApiError(response.status, errorText || `HTTP ${response.status}`)
  }

  // Handle empty responses (e.g., 204 No Content from DELETE)
  const contentLength = response.headers.get('content-length')
  if (response.status === 204 || contentLength === '0') {
    return undefined as T
  }

  const text = await response.text()
  if (!text) {
    return undefined as T
  }

  return JSON.parse(text)
}
