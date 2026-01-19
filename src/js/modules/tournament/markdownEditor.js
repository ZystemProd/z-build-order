const quillRegistry = new Map();

const defaultModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link"],
  ],
};

const sanitizeHtml = (html = "") => {
  const trimmed = (html || "").trim();
  return trimmed === "<p><br></p>" ? "" : trimmed;
};

const getQuill = (textareaId) => quillRegistry.get(textareaId) || null;

export function initQuillEditor({ editorId, textareaId, placeholder = "" }) {
  const editorEl = document.getElementById(editorId);
  const textarea = document.getElementById(textareaId);
  if (!editorEl || !textarea || typeof window.Quill !== "function") return null;

  const stripImageOps = (delta) => {
    const Delta = window.Quill.import("delta");
    const ops = (delta?.ops || []).filter(
      (op) => !(op.insert && typeof op.insert === "object" && op.insert.image)
    );
    return new Delta(ops);
  };

  const assignEditorInputNames = () => {
    const container = editorEl.closest(".markdown-editor") || editorEl;
    const inputs = container.querySelectorAll("input, select, textarea");
    let idx = 0;
    inputs.forEach((input) => {
      if (input.name) return;
      const baseName = input.id || `${textareaId}-${idx++}`;
      input.name = `markdown-${baseName}`;
    });
  };

  const quill = new window.Quill(editorEl, {
    theme: "snow",
    modules: defaultModules,
    placeholder,
  });
  const clipboard = quill.getModule("clipboard");
  clipboard?.addMatcher("IMG", () => stripImageOps());
  clipboard?.addMatcher(Node.ELEMENT_NODE, (_node, delta) => stripImageOps(delta));
  const toolbar = quill.getModule("toolbar");
  const toolbarContainer = toolbar?.container || null;
  let focusOrigin = null;

  // Seed initial content from textarea
  const initialHtml = textarea.value || "";
  const initialDelta = quill.clipboard.convert(initialHtml);
  quill.setContents(initialDelta, "silent");

  quill.on("text-change", () => {
    const html = sanitizeHtml(editorEl.querySelector(".ql-editor")?.innerHTML);
    textarea.value = html;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const clearToolbarActive = () => {
    if (!toolbarContainer) return;
    toolbarContainer.querySelectorAll(".ql-active").forEach((el) => {
      el.classList.remove("ql-active");
    });
  };

  const markFocusOrigin = (origin) => {
    focusOrigin = origin;
  };

  toolbarContainer?.addEventListener("mousedown", () => {
    markFocusOrigin("toolbar");
  });

  quill.container?.addEventListener("mousedown", () => {
    markFocusOrigin("editor");
  });

  quill.on("selection-change", (range) => {
    if (!range) return;
    const isEmpty = quill.getText().trim().length === 0;
    if (!isEmpty) {
      focusOrigin = null;
      return;
    }
    if (focusOrigin !== "toolbar") {
      quill.format("bold", false, "silent");
      quill.format("italic", false, "silent");
      quill.format("list", false, "silent");
      quill.format("header", false, "silent");
      clearToolbarActive();
    }
    focusOrigin = null;
  });

  assignEditorInputNames();

  quillRegistry.set(textareaId, quill);
  return quill;
}

export function initQuillEditors(configs = []) {
  return configs.map((cfg) => initQuillEditor(cfg)).filter(Boolean);
}

export function syncQuillSurfaceForInput(input) {
  if (!input) return;
  const quill = getQuill(input.id);
  if (!quill) return;
  const nextHtml = input.value || "";
  const currentHtml = quill.root?.innerHTML || "";
  if (sanitizeHtml(currentHtml) === sanitizeHtml(nextHtml)) return;
  const delta = quill.clipboard.convert(nextHtml);
  quill.setContents(delta, "silent");
}

// Backward compatibility for legacy imports
export const syncMarkdownSurfaceForInput = syncQuillSurfaceForInput;

export function syncQuillById(textareaId, value) {
  const quill = getQuill(textareaId);
  if (!quill) return;
  const nextHtml = value || "";
  const currentHtml = quill.root?.innerHTML || "";
  if (sanitizeHtml(currentHtml) === sanitizeHtml(nextHtml)) return;
  const delta = quill.clipboard.convert(nextHtml);
  quill.setContents(delta, "silent");
}
