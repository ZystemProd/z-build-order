export function enableDragScroll(scrollElement, options = {}) {
  if (!scrollElement) return () => {};

  const ignoreSelector =
    options.ignoreSelector ??
    'a, button, input, select, textarea, label, summary, details, [contenteditable="true"], [data-no-drag]';

  const scrollXElement = options.scrollXElement ?? scrollElement;
  const scrollYElement = options.scrollYElement ?? scrollElement;
  const axisLock = options.axisLock ?? false;

  let activePointerId = null;
  let startClientX = 0;
  let startClientY = 0;
  let startScrollLeft = 0;
  let startScrollTop = 0;
  let didMove = false;
  let lockedAxis = null; // "x" | "y" | null

  const shouldIgnoreTarget = (target) => {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest(ignoreSelector));
  };

  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    if (event.pointerType === "touch") return; // native touch scrolling is better
    if (activePointerId !== null) return;
    if (shouldIgnoreTarget(event.target)) return;

    activePointerId = event.pointerId;
    didMove = false;
    lockedAxis = null;
    startClientX = event.clientX;
    startClientY = event.clientY;
    startScrollLeft = scrollXElement.scrollLeft;
    startScrollTop = scrollYElement.scrollTop;

    scrollElement.classList.add("is-dragging");
    if (scrollXElement !== scrollElement) scrollXElement.classList.add("is-dragging");
    if (scrollYElement !== scrollElement) scrollYElement.classList.add("is-dragging");
    scrollElement.setPointerCapture(activePointerId);
  };

  const onPointerMove = (event) => {
    if (activePointerId === null) return;
    if (event.pointerId !== activePointerId) return;

    const dx = event.clientX - startClientX;
    const dy = event.clientY - startClientY;

    if (!didMove && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) didMove = true;
    if (!didMove) return;

    if (axisLock && lockedAxis === null) {
      lockedAxis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
    }

    event.preventDefault();
    if (!axisLock || lockedAxis === "x") {
      scrollXElement.scrollLeft = startScrollLeft - dx;
    }
    if (!axisLock || lockedAxis === "y") {
      scrollYElement.scrollTop = startScrollTop - dy;
    }
  };

  const stopDrag = (event) => {
    if (activePointerId === null) return;
    if (event?.pointerId != null && event.pointerId !== activePointerId) return;

    scrollElement.classList.remove("is-dragging");
    if (scrollXElement !== scrollElement) scrollXElement.classList.remove("is-dragging");
    if (scrollYElement !== scrollElement) scrollYElement.classList.remove("is-dragging");
    try {
      scrollElement.releasePointerCapture(activePointerId);
    } catch {
      // ignore
    }
    activePointerId = null;

    if (didMove) {
      scrollElement.addEventListener(
        "click",
        (clickEvent) => {
          if (shouldIgnoreTarget(clickEvent.target)) return;
          clickEvent.preventDefault();
          clickEvent.stopPropagation();
        },
        { capture: true, once: true }
      );
    }
  };

  scrollElement.addEventListener("pointerdown", onPointerDown);
  scrollElement.addEventListener("pointermove", onPointerMove, { passive: false });
  scrollElement.addEventListener("pointerup", stopDrag);
  scrollElement.addEventListener("pointercancel", stopDrag);
  scrollElement.addEventListener("lostpointercapture", stopDrag);

  return () => {
    scrollElement.removeEventListener("pointerdown", onPointerDown);
    scrollElement.removeEventListener("pointermove", onPointerMove);
    scrollElement.removeEventListener("pointerup", stopDrag);
    scrollElement.removeEventListener("pointercancel", stopDrag);
    scrollElement.removeEventListener("lostpointercapture", stopDrag);
  };
}
