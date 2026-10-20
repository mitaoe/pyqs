export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch (error) {
    console.warn(`Failed to read "${key}" from localStorage:`, error)
    return null
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch (error) {
    console.warn(`Failed to save "${key}" to localStorage:`, error)
  }
}

export function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.warn(`Failed to remove "${key}" from localStorage:`, error)
  }
}
