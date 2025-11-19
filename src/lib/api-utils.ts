/**
 * Utility function untuk fetch dengan retry logic dan exponential backoff
 * Supports AbortController for request cancellation
 * @param url - URL untuk fetch
 * @param options - Fetch options (RequestInit), can include signal for AbortController
 * @param maxRetries - Maximum number of retries (default: 3)
 * @returns Promise<Response>
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Check if request was aborted before attempting fetch
      if (options.signal?.aborted) {
        throw new DOMException('Request aborted', 'AbortError')
      }

      const response = await fetch(url, options)

      // If response is ok, return immediately
      if (response.ok) {
        return response
      }

      // If it's the last attempt, throw error
      if (attempt === maxRetries) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // For non-ok responses, wait before retry (except for client errors 4xx)
      if (response.status >= 400 && response.status < 500) {
        // Don't retry client errors (4xx)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // For server errors (5xx) or network errors, retry with exponential backoff
      lastError = new Error(`HTTP error! status: ${response.status}`)
    } catch (err) {
      // Check if it's an AbortError - don't retry aborted requests
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err
      }

      // Check if request was aborted during retry delay
      if (options.signal?.aborted) {
        throw new DOMException('Request aborted', 'AbortError')
      }

      // If it's the last attempt, throw the error
      if (attempt === maxRetries) {
        throw err instanceof Error ? err : new Error('Unknown error')
      }

      // Store error for potential re-throw
      lastError = err instanceof Error ? err : new Error('Unknown error')

      // Calculate delay with exponential backoff: 2^attempt * 1000ms
      const delay = Math.pow(2, attempt) * 1000
      
      // Wait before retrying, but check for abort during delay
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (options.signal?.aborted) {
            reject(new DOMException('Request aborted', 'AbortError'))
          } else {
            resolve()
          }
        }, delay)

        // Listen for abort signal
        options.signal?.addEventListener('abort', () => {
          clearTimeout(timeout)
          reject(new DOMException('Request aborted', 'AbortError'))
        })
      })
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Max retries exceeded')
}

