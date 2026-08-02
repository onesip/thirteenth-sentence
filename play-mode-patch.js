(() => {
  const app = window.ThirteenthPlay;
  if (!app || typeof app.renderCatalog !== "function") return;
  const originalRenderCatalog = app.renderCatalog;
  app.renderCatalog = function patchedRenderCatalog(note = "") {
    if (this.requestedSlug && !this.catalog.some((item) => item.slug === this.requestedSlug)) {
      this.catalog = [{
        slug: this.requestedSlug,
        code: "SHARED",
        title: "朋友分享的封存档案",
        preface: "这份档案不在最近目录里，但分享入口仍然有效。进入后会读取它的真实规则与世界。",
        ruleCount: 0,
        worldChange: "等待后来者进入"
      }, ...this.catalog];
    }
    return originalRenderCatalog.call(this, note);
  };
})();
