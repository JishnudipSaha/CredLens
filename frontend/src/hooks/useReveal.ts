import { useEffect } from 'react'

/**
 * useReveal - marks all [data-reveal] descendants inside the given root
 * as `.is-revealed` once they enter the viewport.
 *
 * - Re-runs whenever children change (via MutationObserver) so elements
 *   that mount after the first render still get observed.
 * - Elements already in the viewport at mount time are revealed
 *   immediately so the user doesn't see a blank page.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(rootRef: React.RefObject<T | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const targets = () => root.querySelectorAll<HTMLElement>('[data-reveal]')

    const reveal = (el: HTMLElement) => el.classList.add('is-revealed')

    if (typeof IntersectionObserver === 'undefined') {
      targets().forEach(reveal)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target as HTMLElement)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.05, rootMargin: '0px 0px -10px 0px' },
    )

    // 1. Observe anything currently in the DOM
    targets().forEach((el) => {
      const rect = el.getBoundingClientRect()
      // Already on-screen at mount? Reveal immediately so the user sees content.
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        reveal(el)
      } else {
        observer.observe(el)
      }
    })

    // 2. Watch for newly added [data-reveal] children (e.g. when async
    //    data finishes loading and the page content is mounted after).
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return
          if (node.matches('[data-reveal]')) {
            const rect = node.getBoundingClientRect()
            if (rect.top < window.innerHeight && rect.bottom > 0) reveal(node)
            else observer.observe(node)
          }
          // also catch nested reveal targets
          node.querySelectorAll?.<HTMLElement>('[data-reveal]').forEach((child) => {
            const rect = child.getBoundingClientRect()
            if (rect.top < window.innerHeight && rect.bottom > 0) reveal(child)
            else observer.observe(child)
          })
        })
      }
    })
    mo.observe(root, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      mo.disconnect()
    }
  }, [rootRef])
}
