(() => {
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const recentKey = "thirteenth-played-archives-v1";
  const partyText = {
    1: "你独自保管规则、观察现场并作出全部判断。",
    2: "规则保管者负责查阅规则，现场判断者负责选择行动；每幕轮换。",
    3: "规则保管者、现场判断者、异议见证人轮流掌握决定权。",
    4: "再加入最终裁决者。前三人留下证据，第四人承担最后判断。"
  };

  function recentSlugs() {
    try { return JSON.parse(localStorage.getItem(recentKey) || "[]"); }
    catch { return []; }
  }

  function rememberSlug(slug) {
    if (!slug) return;
    const next = [slug, ...recentSlugs().filter((item) => item !== slug)].slice(0, 8);
    localStorage.setItem(recentKey, JSON.stringify(next));
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    let data = null;
    try { data = await response.json(); }
    catch { data = { error: `档案返回了无法辨认的内容（${response.status}）。` }; }
    if (!response.ok) throw new Error(data?.error || `请求失败（${response.status}）`);
    return data;
  }

  async function copyOrShare(url, title) {
    if (navigator.share) {
      try { await navigator.share({ title, text: "进入这份已经建立完成的规则怪谈档案。", url }); return true; }
      catch (error) { if (error?.name === "AbortError") return false; }
    }
    try { await navigator.clipboard.writeText(url); return true; }
    catch { return false; }
  }

  function paragraphList(items, className = "") {
    return (items || []).map((item) => `<p class="${className}">${esc(item)}</p>`).join("");
  }

  const app = {
    root: null,
    partySize: 1,
    catalog: [],
    requestedSlug: "",
    sessionId: null,
    stateToken: null,
    archive: null,
    roleOrder: [],
    currentScene: null,
    metricsView: null,
    sceneIndex: 0,
    totalScenes: 5,
    busy: false,

    async mount({ slug = "" } = {}) {
      this.root = document.getElementById("scene");
      this.requestedSlug = slug;
      document.getElementById("app")?.classList.add("play-mode-active");
      await this.loadCatalog();
    },

    async loadCatalog() {
      this.renderLoading("正在翻找可以进入的封存档案……", "不是每一份规则都已经准备好承受后来者。 ");
      try {
        const data = await request("/api/play-catalog");
        this.catalog = data.archives || [];
        this.renderCatalog(data.note);
      } catch (error) {
        this.renderError("无法读取档案目录", error.message, () => this.loadCatalog());
      }
    },

    renderCatalog(note = "") {
      const requested = this.requestedSlug ? this.catalog.find((item) => item.slug === this.requestedSlug) : null;
      const ordered = requested ? [requested, ...this.catalog.filter((item) => item.slug !== requested.slug)] : this.catalog;
      this.root.innerHTML = `
        <section class="survival-shell">
          <div class="play-topline">
            <button class="play-back" data-action="mode-home">← 返回模式选择</button>
            <span class="survival-kicker">ENTER AN ARCHIVE</span>
          </div>
          <div class="catalog-heading">
            <h1>${requested ? "有人把这份世界交给了你" : "进入一份已经建立好的规则"}</h1>
            <p>${requested ? "你不会修改它的过去。你要带着现有规则进入现场，并用自己的判断决定它接下来发生什么。" : "这些规则已经由别的玩家留下。你将拿到一份不完全可靠的手册，在五个连续场景中判断它、试探它，并承担延迟出现的后果。"}</p>
          </div>
          <div class="party-panel">
            <strong>这次有几个人一起判断？</strong>
            <div class="party-options">
              ${[1,2,3,4].map((size) => `<button class="party-button ${this.partySize === size ? "active" : ""}" data-party="${size}">${size} 人</button>`).join("")}
            </div>
            <div class="party-description">${esc(partyText[this.partySize])} 同屏轮流，不需要等待其他设备。</div>
          </div>
          <div class="catalog-actions">
            <button class="primary-action" data-action="random-play">随机进入一份不同档案</button>
            <button class="secondary-action" data-action="open-creator">没有规则？去共创一份</button>
          </div>
          ${note ? `<div class="error-panel"><p>${esc(note)}</p></div>` : ""}
          <div class="archive-grid">
            ${ordered.map((item, index) => this.archiveCard(item, requested && index === 0)).join("") || `
              <div class="archive-card">
                <span class="archive-code">NO SEALED ARCHIVES</span>
                <h3>这里还没有能被真正进入的世界</h3>
                <p>完成一局共创并封存规则后，它就会出现在这里，成为另一位玩家可以实际经历的故事。</p>
                <button class="primary-action" data-action="open-creator">开始共创第一份档案</button>
              </div>`}
          </div>
        </section>`;
      this.bindCatalog();
    },

    archiveCard(item, highlighted) {
      return `<article class="archive-card ${highlighted ? "highlighted" : ""}">
        <span class="archive-code">${esc(item.code || "ARCHIVE")} · ${Number(item.ruleCount || 0)} 条规则</span>
        <h3>${esc(item.title)}</h3>
        <p>${esc(item.preface || "一份已经封存、但还没有被真正走过的档案。")}</p>
        <div class="archive-meta">
          <span class="party-chip">蝴蝶效应 5 幕</span>
          <span class="party-chip">身份隐藏</span>
          <span class="party-chip">结局解读</span>
        </div>
        <div class="archive-card-actions">
          <button class="primary-action" data-play-slug="${esc(item.slug)}">${highlighted ? "进入朋友分享的世界" : "进入这份档案"}</button>
          <button class="secondary-action" data-share-slug="${esc(item.slug)}" data-share-title="${esc(item.title)}">分享</button>
        </div>
      </article>`;
    },

    bindCatalog() {
      this.root.querySelectorAll("[data-party]").forEach((button) => button.addEventListener("click", () => {
        this.partySize = Number(button.dataset.party);
        this.renderCatalog();
      }));
      this.root.querySelectorAll("[data-play-slug]").forEach((button) => button.addEventListener("click", () => this.start(button.dataset.playSlug)));
      this.root.querySelectorAll("[data-share-slug]").forEach((button) => button.addEventListener("click", async () => {
        const url = `${location.origin}/play/${encodeURIComponent(button.dataset.shareSlug)}`;
        const ok = await copyOrShare(url, button.dataset.shareTitle || "第十三句");
        button.textContent = ok ? "已发送 / 已复制" : "长按复制地址栏";
      }));
      this.root.querySelector("[data-action='random-play']")?.addEventListener("click", () => this.start(""));
      this.root.querySelectorAll("[data-action='open-creator']").forEach((button) => button.addEventListener("click", () => window.ThirteenthModeRouter?.openCreator()));
      this.root.querySelector("[data-action='mode-home']")?.addEventListener("click", () => window.ThirteenthModeRouter?.showModeHome());
    },

    async start(slug) {
      if (this.busy) return;
      this.busy = true;
      this.renderLoading("正在把规则变成一个真实现场……", "身份会先被遮住。规则的真假也不会提前告诉你。");
      try {
        const data = await request("/api/play-session", {
          method: "POST",
          body: JSON.stringify({
            slug: slug || null,
            partySize: this.partySize,
            excludedSlugs: recentSlugs()
          })
        });
        this.sessionId = data.sessionId;
        this.stateToken = data.stateToken;
        this.archive = data.archive;
        this.roleOrder = data.roleOrder || [];
        this.currentScene = data.opening.firstScene;
        this.metricsView = data.metricsView;
        this.sceneIndex = 0;
        this.totalScenes = 5;
        this.opening = data.opening;
        this.renderOpening();
      } catch (error) {
        this.renderError("这份档案没有成功打开", error.message, () => this.loadCatalog());
      } finally {
        this.busy = false;
      }
    },

    renderOpening() {
      this.root.innerHTML = `
        <section class="survival-shell">
          <div class="play-topline">
            <button class="play-back" data-action="catalog">← 放弃进入</button>
            <span class="survival-kicker">${esc(this.archive.code || "LIVE ARCHIVE")}</span>
          </div>
          <div class="ending-section">
            <span class="survival-kicker">进入身份</span>
            <h2>${esc(this.opening.publicIdentity)}</h2>
            <div class="truth-box">${esc(this.opening.startingMemory)}</div>
            <p style="line-height:1.8;color:var(--play-muted)"><strong style="color:var(--play-text)">本次目标：</strong>${esc(this.opening.mission)}</p>
            <p style="line-height:1.8;color:var(--play-accent-strong)">${esc(this.opening.warning)}</p>
            ${this.partySize > 1 ? `<div class="identity-fragment">第一幕由「${esc(this.currentScene.turnRole || this.roleOrder[0])}」作决定。把设备交给负责这一幕的人，其他人可以提醒，但不要替他选择。</div>` : ""}
            <div class="ending-actions">
              <button class="primary-action" data-action="enter-first-scene">带着规则进入现场</button>
              <button class="secondary-action" data-action="catalog">换一份档案</button>
            </div>
          </div>
        </section>`;
      this.root.querySelector("[data-action='enter-first-scene']")?.addEventListener("click", () => this.renderScene());
      this.root.querySelectorAll("[data-action='catalog']").forEach((button) => button.addEventListener("click", () => this.renderCatalog()));
    },

    metricsMarkup() {
      const labels = { evidence: "证据", contamination: "污染", identity: "身份", trust: "规则信任" };
      return Object.entries(labels).map(([key, label]) => `<div class="metric-item"><small>${label}</small><strong>${esc(this.metricsView?.[key] || "未定")}</strong></div>`).join("");
    },

    rulesMarkup() {
      return (this.archive?.rules || []).map((rule) => `<div class="rule-item"><span class="rule-number">${esc(rule.number)}</span><span class="rule-text">${esc(rule.text)}</span></div>`).join("");
    },

    renderScene(identityFragment = "") {
      const scene = this.currentScene;
      this.root.innerHTML = `
        <section class="survival-shell">
          <div class="play-topline">
            <button class="play-back" data-action="catalog">← 退出本次进入</button>
            <span class="survival-kicker">${esc(this.archive.title)}</span>
          </div>
          <button class="secondary-action mobile-rule-toggle" data-action="toggle-rules">查看规则与当前状态</button>
          <div class="play-layout">
            <main class="scene-card">
              <div class="scene-progress">${Array.from({length:this.totalScenes}, (_, index) => `<span class="${index < this.sceneIndex ? "done" : index === this.sceneIndex ? "current" : ""}"></span>`).join("")}</div>
              <div class="scene-heading">
                <div>
                  <span class="survival-kicker">第 ${esc(scene.sceneNo || this.sceneIndex + 1)} 幕 · ${esc(scene.location || "未知地点")}</span>
                  <h1>${esc(scene.title)}</h1>
                  <div class="scene-meta">${esc(scene.time || "时间无法确认")}</div>
                </div>
                <div class="turn-card"><small>本幕决定权</small><strong>${esc(scene.turnRole || this.roleOrder[this.sceneIndex % Math.max(1,this.roleOrder.length)] || "现场记录者")}</strong></div>
              </div>
              <div class="scene-narration">${paragraphList(scene.narration)}</div>
              ${identityFragment || scene.identityFragment ? `<div class="identity-fragment">${esc(identityFragment || scene.identityFragment)}</div>` : ""}
              <div class="clue-block"><h3>你现在能够确认的细节</h3><div class="clue-list">${(scene.visibleClues || []).map((clue) => `<div>${esc(clue)}</div>`).join("")}</div></div>
              <div class="pressure-block"><h3>迫近中的问题</h3><p>${esc(scene.pressure)}</p></div>
              <div class="option-list">
                ${(scene.options || []).map((option) => `<button class="option-button" data-option="${esc(option.id)}">
                  <strong>${esc(option.label)}</strong><p>${esc(option.action)}</p>
                  <div class="option-bottom"><span class="approach-tag">${esc(option.approach || "判断")}</span><span>${(option.ruleRefs || []).map((ref) => `<span class="rule-ref-chip">规则 ${esc(ref)}</span>`).join(" ")}</span></div>
                </button>`).join("")}
              </div>
            </main>
            <aside class="rules-panel" id="rulesPanel">
              <button class="play-back mobile-rule-toggle" data-action="toggle-rules">关闭手册</button>
              <span class="survival-kicker">SURVIVAL HANDBOOK</span><h2>现有规则</h2><p>你可以随时回来查看，但这里不会提前告诉你适用条件。</p>
              <div class="metrics-grid">${this.metricsMarkup()}</div>
              <div class="rule-book">${this.rulesMarkup()}</div>
            </aside>
          </div>
        </section>`;
      this.root.querySelectorAll("[data-option]").forEach((button) => button.addEventListener("click", () => this.choose(button.dataset.option)));
      this.root.querySelectorAll("[data-action='toggle-rules']").forEach((button) => button.addEventListener("click", () => document.getElementById("rulesPanel")?.classList.toggle("open")));
      this.root.querySelector("[data-action='catalog']")?.addEventListener("click", () => {
        if (confirm("退出后，这次尚未完成的进入不会显示结局。确定退出吗？")) this.renderCatalog();
      });
    },

    async choose(optionId) {
      if (this.busy) return;
      this.busy = true;
      this.root.querySelectorAll("[data-option]").forEach((button) => button.disabled = true);
      try {
        const data = await request("/api/play-director", {
          method: "POST",
          body: JSON.stringify({ sessionId: this.sessionId, stateToken: this.stateToken, optionId })
        });
        this.stateToken = data.stateToken;
        this.metricsView = data.metricsView;
        this.sceneIndex = Number(data.sceneIndex || this.sceneIndex);
        if (data.ending) {
          rememberSlug(data.sourceArchiveSlug || this.archive.slug);
          this.renderEnding(data.ending);
        } else {
          const nextScene = data.scene;
          this.showConsequence(data.consequence, () => {
            this.currentScene = nextScene;
            this.renderScene(data.identityFragment || "");
          });
        }
      } catch (error) {
        this.showInlineError(error.message);
        this.root.querySelectorAll("[data-option]").forEach((button) => button.disabled = false);
      } finally {
        this.busy = false;
      }
    },

    showConsequence(consequence, onContinue) {
      const overlay = document.createElement("div");
      overlay.className = "consequence-overlay";
      const nextRole = this.roleOrder[this.sceneIndex % Math.max(1, this.roleOrder.length)];
      overlay.innerHTML = `<div class="consequence-card">
        <span class="survival-kicker">选择已经写入档案</span><h2>${esc(consequence?.title || "后果没有立刻说明自己")}</h2>
        ${paragraphList(consequence?.narration || [])}
        ${consequence?.delayedOmen ? `<div class="omen">${esc(consequence.delayedOmen)}</div>` : ""}
        ${this.partySize > 1 ? `<p style="color:var(--play-muted)">下一幕由「${esc(nextRole)}」作决定。现在把设备交给他。</p>` : ""}
        <button class="primary-action" data-continue>翻到下一幕</button>
      </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector("[data-continue]")?.addEventListener("click", () => { overlay.remove(); onContinue(); });
    },

    showInlineError(message) {
      const node = document.createElement("div");
      node.className = "error-panel";
      node.innerHTML = `<p>${esc(message)}</p>`;
      this.root.querySelector(".scene-card")?.appendChild(node);
    },

    renderEnding(ending) {
      const identity = ending.identityReveal || {};
      this.root.innerHTML = `
        <section class="survival-shell">
          <div class="play-topline"><button class="play-back" data-action="mode-home">← 返回档案馆</button><span class="survival-kicker">ENTRY SEALED</span></div>
          <div class="ending-hero"><span class="ending-tier">${esc(ending.endingTier || "结局")}</span><h1>${esc(ending.endingTitle)}</h1><div class="ending-opening">${esc(ending.openingLine)}</div></div>
          <section class="ending-section ending-story"><span class="survival-kicker">先把故事走完</span><h2>这五幕真正发生了什么</h2>${paragraphList(ending.story)}</section>
          <section class="ending-section"><span class="survival-kicker">ONE-LINE TRUTH</span><h2>一句话真相</h2><div class="truth-box">${esc(ending.oneLineTruth)}</div></section>
          <section class="ending-section"><span class="survival-kicker">IDENTITY REVEAL</span><h2>你到底是谁</h2>
            <div class="identity-grid"><div class="identity-box"><small>你进入时相信</small><strong>${esc(identity.believed)}</strong></div><div class="identity-box"><small>档案最终确认</small><strong>${esc(identity.actual)}</strong></div></div>
            <p style="line-height:1.8;color:var(--play-muted)">${esc(identity.meaning)}</p>
            <div class="clue-list">${(identity.evidence || []).map((item) => `<div>${esc(item)}</div>`).join("")}</div>
          </section>
          <section class="ending-section"><span class="survival-kicker">BUTTERFLY EFFECT</span><h2>你的选择怎样一步步改变结局</h2><div class="timeline">${(ending.choiceTimeline || []).map((item) => `<div class="timeline-item"><div class="timeline-no">${esc(item.sceneNo)}</div><div><h3>${esc(item.choice)}</h3><p><strong>当时：</strong>${esc(item.immediate)}</p><p><strong>后来：</strong>${esc(item.delayed)}</p><p><strong>作用：</strong>${esc(item.verdict)}</p></div></div>`).join("")}</div></section>
          <section class="ending-section"><span class="survival-kicker">RULE READING</span><h2>规则逐条解读</h2>${(ending.ruleReadings || []).map((rule) => `<details class="ending-rule"><summary><span class="rule-number">${esc(rule.number)}</span><span><strong>${esc(rule.verdict)}</strong><br><span class="rule-text">${esc(rule.text)}</span></span></summary><div class="ending-rule-body"><p><strong>成立条件：</strong>${esc(rule.condition)}</p><p><strong>你如何使用它：</strong>${esc(rule.playerUse)}</p><p><strong>造成的后果：</strong>${esc(rule.consequence)}</p></div></details>`).join("")}</section>
          <section class="ending-section"><span class="survival-kicker">CAUSAL MAP</span><h2>因果链</h2><div class="cause-list">${(ending.causalChain || []).map((item) => `<div class="cause-item">${esc(item)}</div>`).join("")}</div></section>
          <section class="ending-section"><h2>你错过的线索与关键转折</h2><div class="clue-list">${(ending.missedClues || []).map((item) => `<div>${esc(item)}</div>`).join("")}</div><div class="truth-box" style="margin-top:18px"><strong>第 ${esc(ending.turningPoint?.sceneNo || "?")} 幕：</strong>${esc(ending.turningPoint?.choice)}<br><span style="color:var(--play-muted)">${esc(ending.turningPoint?.alternate)}</span></div></section>
          <section class="ending-section"><span class="survival-kicker">WORLD CONSEQUENCE</span><h2>你给这个世界留下了什么</h2><p style="line-height:1.9">${esc(ending.worldConsequence)}</p><div class="identity-fragment">后来者会看到：${esc(ending.fieldNote)}</div><p style="color:var(--play-muted);line-height:1.8">下一处入口：${esc(ending.nextHook)}</p></section>
          <div class="ending-actions">
            <button class="primary-action" data-action="another">进入另一份档案</button>
            <button class="secondary-action" data-action="share-play">把这份规则交给朋友去走</button>
            <button class="secondary-action" data-action="open-creator">去共创一个新世界</button>
          </div>
        </section>`;
      this.root.querySelector("[data-action='another']")?.addEventListener("click", () => { this.requestedSlug = ""; this.loadCatalog(); });
      this.root.querySelector("[data-action='share-play']")?.addEventListener("click", async (event) => {
        const url = `${location.origin}/play/${encodeURIComponent(this.archive.slug)}`;
        const ok = await copyOrShare(url, this.archive.title);
        event.currentTarget.textContent = ok ? "已发送 / 已复制" : "请复制地址栏链接";
      });
      this.root.querySelector("[data-action='open-creator']")?.addEventListener("click", () => window.ThirteenthModeRouter?.openCreator());
      this.root.querySelector("[data-action='mode-home']")?.addEventListener("click", () => window.ThirteenthModeRouter?.showModeHome());
    },

    renderLoading(title, note) {
      this.root.innerHTML = `<section class="survival-shell"><div class="loading-veil"><div><div class="loading-ring"></div><h2>${esc(title)}</h2><p>${esc(note)}</p></div></div></section>`;
    },

    renderError(title, message, retry) {
      this.root.innerHTML = `<section class="survival-shell"><div class="error-panel"><h2>${esc(title)}</h2><p>${esc(message)}</p><button class="primary-action" data-retry>再试一次</button> <button class="secondary-action" data-home>返回模式选择</button></div></section>`;
      this.root.querySelector("[data-retry]")?.addEventListener("click", retry);
      this.root.querySelector("[data-home]")?.addEventListener("click", () => window.ThirteenthModeRouter?.showModeHome());
    }
  };

  window.ThirteenthPlay = app;
})();
