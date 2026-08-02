(() => {
  const root = document.getElementById("scene");
  const appRoot = document.getElementById("app");
  const brandButton = document.getElementById("brandButton");
  const topStatus = document.querySelector(".top-status");
  const params = new URLSearchParams(location.search);
  const path = location.pathname.replace(/\/+$/, "") || "/";

  function ensureStyles() {
    if (document.querySelector("link[data-play-styles]")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/play-mode.css?v=1";
    link.dataset.playStyles = "true";
    document.head.appendChild(link);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-src="${src}"]`);
      if (existing) return resolve();
      const script = document.createElement("script");
      script.src = src;
      script.dataset.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`资源读取失败：${src}`));
      document.body.appendChild(script);
    });
  }

  function resetShell() {
    appRoot.className = "game-root stage-landing";
    root.innerHTML = "";
  }

  function useSharedHeader() {
    if (topStatus) topStatus.style.display = "none";
    if (brandButton) brandButton.onclick = () => showModeHome();
  }

  function useCreatorHeader() {
    if (topStatus) topStatus.style.display = "";
    if (brandButton) brandButton.onclick = null;
  }

  function showModeHome() {
    if (location.pathname !== "/" || location.search) {
      location.href = "/";
      return;
    }
    resetShell();
    useSharedHeader();
    root.innerHTML = `
      <section class="mode-shell">
        <span class="mode-kicker">THIRTEENTH SENTENCE · TWO MODES</span>
        <h1 class="mode-title">规则写下来以后，必须有人真正走进去。</h1>
        <p class="mode-lead">一个模式负责让世界诞生，另一个模式负责验证这些规则究竟能不能让人活着离开。两边的玩家会持续给彼此留下后果。</p>
        <div class="mode-grid">
          <button class="mode-card" data-mode="create">
            <span class="mode-index">01</span>
            <h2>共创档案</h2>
            <p>写下规则、制造矛盾、决定世界机制。你的句子会成为别人进入现场时必须面对的生存条件。</p>
            <div class="mode-features"><span>1–4 人同屏</span><span>共同建立规则</span><span>世界持续扩充</span></div>
          </button>
          <button class="mode-card" data-mode="play">
            <span class="mode-index">02</span>
            <h2>进入档案</h2>
            <p>拿到别人已经建立的规则，进入五个连续场景。选择的后果可能隔几幕才出现，最终揭开身份、规则与完整真相。</p>
            <div class="mode-features"><span>蝴蝶效应选择</span><span>身份隐藏</span><span>规则逐条解读</span></div>
          </button>
        </div>
      </section>`;
    root.querySelector("[data-mode='create']")?.addEventListener("click", openCreator);
    root.querySelector("[data-mode='play']")?.addEventListener("click", () => openPlay());
  }

  function openCreator() {
    location.href = "/?mode=create";
  }

  function openPlay(slug = "") {
    location.href = slug ? `/play/${encodeURIComponent(slug)}` : "/?mode=play";
  }

  async function mountPlay(slug = "") {
    resetShell();
    useSharedHeader();
    try {
      await loadScript("/play-mode.js?v=1");
      await loadScript("/play-mode-patch.js?v=1");
      await window.ThirteenthPlay.mount({ slug });
    } catch (error) {
      root.innerHTML = `<section class="survival-shell"><div class="error-panel"><h2>进入模式没有成功加载</h2><p>${String(error.message || error)}</p><button class="primary-action" onclick="location.reload()">重新加载</button></div></section>`;
    }
  }

  async function mountCreator() {
    resetShell();
    useCreatorHeader();
    try {
      await loadScript("/loader.js?v=8");
    } catch (error) {
      root.innerHTML = `<section class="survival-shell"><div class="error-panel"><h2>共创模式没有成功加载</h2><p>${String(error.message || error)}</p><button class="primary-action" onclick="location.reload()">重新加载</button></div></section>`;
    }
  }

  window.ThirteenthModeRouter = { showModeHome, openCreator, openPlay, mountPlay, mountCreator };
  ensureStyles();

  const playMatch = path.match(/^\/play\/([^/]+)$/);
  const shouldPlay = params.get("mode") === "play" || Boolean(playMatch);
  const shouldCreate = params.get("mode") === "create" || params.has("archive") || /^\/(archive|world|share|shared|continue|branch)\//.test(path);

  if (shouldPlay) {
    mountPlay(playMatch ? decodeURIComponent(playMatch[1]) : "");
  } else if (shouldCreate) {
    mountCreator();
  } else {
    showModeHome();
  }
})();
