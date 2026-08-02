(() => {
  const nativeClipboardWrite = navigator.clipboard?.writeText
    ? navigator.clipboard.writeText.bind(navigator.clipboard)
    : null;

  async function robustClipboardWrite(text) {
    const value = String(text || "");
    if (nativeClipboardWrite) {
      try {
        await nativeClipboardWrite(value);
        return;
      } catch { }
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.inset = "0 auto auto -9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    textarea.remove();
    if (!copied) throw new Error("COPY_NOT_ALLOWED");
  }

  try {
    if (navigator.clipboard) {
      try {
        navigator.clipboard.writeText = robustClipboardWrite;
      } catch { }
      if (navigator.clipboard.writeText !== robustClipboardWrite) {
        Object.defineProperty(navigator.clipboard, "writeText", {
          configurable: true,
          value: robustClipboardWrite
        });
      }
    } else {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: robustClipboardWrite }
      });
    }
  } catch { }

  const improveErrorToast = () => {
    document.querySelectorAll(".error-toast").forEach((toast) => {
      const title = toast.querySelector("span");
      const message = toast.querySelector("p");
      if (!title || !message) return;
      const text = message.textContent.trim();
      if (/^https?:\/\//i.test(text)) {
        title.textContent = "链接未自动复制";
        message.style.userSelect = "text";
        message.style.webkitUserSelect = "text";
        message.style.wordBreak = "break-all";
        message.title = "档案已成功收录，请长按复制此链接";
      } else if (title.textContent.trim() === "无法收录") {
        title.textContent = "档案提示";
      }
    });
  };

  const observer = new MutationObserver(improveErrorToast);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  improveErrorToast();
})();
