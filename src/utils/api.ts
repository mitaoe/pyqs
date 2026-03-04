/**
 * Default timeout for network requests (30 seconds)
 */
export const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Enhanced fetch that automatically aborts if it takes longer than the specified timeout
 * 
 * @param url The URL to fetch
 * @param options Standard RequestInit options
 * @param timeoutMs Timeout in milliseconds (defaults to 30s)
 * @returns Promise<Response>
 */
export async function fetchWithTimeout(
  url: string, 
  options: RequestInit = {}, 
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  const abortHandler = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', abortHandler);
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
    if (options.signal) {
      options.signal.removeEventListener('abort', abortHandler);
    }
  }
}
