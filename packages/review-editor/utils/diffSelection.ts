export function getLineNumberFromNode(node: Node | null): number | null {
  let current: Node | null = node;
  if (current?.nodeType === Node.TEXT_NODE) current = current.parentNode;
  while (current) {
    if (current instanceof HTMLElement) {
      const line = current.closest('[data-line]')?.getAttribute('data-line');
      if (line) {
        const parsed = Number(line);
        return Number.isFinite(parsed) ? parsed : null;
      }
    }
    current = current.parentNode;
  }
  return null;
}

export function getSideFromNode(node: Node | null): 'additions' | 'deletions' {
  let current: Node | null = node;
  if (current?.nodeType === Node.TEXT_NODE) current = current.parentNode;
  while (current) {
    if (current instanceof HTMLElement) {
      if (current.hasAttribute('data-deletions')) return 'deletions';
      if (current.hasAttribute('data-additions')) return 'additions';
    }
    current = current.parentNode;
  }
  return 'additions';
}

export function getDiffSelection(root: HTMLElement | null): Selection | null {
  const shadowRoot = root?.querySelector('diffs-container')?.shadowRoot;
  const shadowSelection = (shadowRoot as (ShadowRoot & { getSelection?: () => Selection | null }) | null)
    ?.getSelection?.();
  return shadowSelection && !shadowSelection.isCollapsed
    ? shadowSelection
    : window.getSelection();
}
