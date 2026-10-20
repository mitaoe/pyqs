export const SCROLL_CONTAINER_ID = "scrollable-content"

export function scrollContainer(): HTMLElement | null {
  return document.getElementById(SCROLL_CONTAINER_ID)
}

export function scrollToTop(): void {
  window.scrollTo(0, 0)
  const container = scrollContainer()
  if (container) container.scrollTop = 0
}
