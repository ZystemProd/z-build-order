let lockCount = 0;

function setBodyOverflow(next) {
  const body = document.body;
  if (!body) return;
  if (next !== null) {
    if (body.dataset.prevOverflow === undefined) {
      body.dataset.prevOverflow = body.style.overflow || "";
    }
    body.style.overflow = next;
    return;
  }
  const prev = body.dataset.prevOverflow || "";
  body.style.overflow = prev;
  delete body.dataset.prevOverflow;
}

export function lockBodyScroll() {
  lockCount += 1;
  if (lockCount === 1) {
    setBodyOverflow("hidden");
  }
}

export function unlockBodyScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    setBodyOverflow(null);
  }
}
