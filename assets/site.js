/* Site engine. You normally don't need to edit this file — change content.js instead. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = matchMedia("(hover: hover)").matches;
  const params = new URLSearchParams(location.search);
  let page = document.body.dataset.page;

  const slug = (t) => String(t).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-");
  // Items marked "hidden" in the editor are left out of the website entirely
  for (const list of [WORK, RND, SHOWREELS]) { const keep = list.filter(x => !x.hidden); list.length = 0; list.push(...keep); }
  WORK.forEach(w => w.id = w.id || slug(w.title));
  RND.forEach(r => r.id = r.id || slug(r.title));
  const fmtDate = (d) => { const t = new Date(d); return isNaN(t) ? (d || "") : t.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); };
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "another site"; } };

  function placeholder(path) {
    const d = document.createElement("div");
    d.className = "placeholder";
    d.innerHTML = path ? `<span>Add <code>${esc(path)}</code></span>` : `<span>No image yet</span>`;
    return d;
  }
  function guard(el, path) {
    const fail = () => { if (el.isConnected) el.replaceWith(placeholder(path)); };
    el.addEventListener("error", fail);
    if (el.tagName === "VIDEO") el.querySelector("source")?.addEventListener("error", fail);
    return el;
  }
  // focus = "x% y%" chosen in the editor, keeps that part of the picture in view when cropped to a shape
const img = (src, alt = "", focus) => {
    const i = Object.assign(document.createElement("img"), { alt, loading: "lazy" });
    if (/\/maxresdefault\.jpg$/.test(src || "")) i.addEventListener("error", () => { i.src = src.replace("maxresdefault", "hqdefault"); }, { once: true });
    else guard(i, src);
    i.src = src || "";
    if (focus) i.style.objectPosition = focus;
    return i;
  };

  // YouTube / Vimeo links -> embeddable player address
  function embedUrl(item) {
    const u = item.youtube || item.vimeo || "";
    let m;
    if (item.youtube && (m = u.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/))) return `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0`;
    if (item.vimeo && (m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/))) return `https://player.vimeo.com/video/${m[1]}`;
    return "";
  }
  // Before / after wipe: drag (or use arrow keys) to reveal the "after" image over the "before"
  function compareBlock(item) {
    const box = document.createElement("div");
    box.className = "compare"; box.style.setProperty("--pos", "50%");
    box.innerHTML = `
      <img class="cmp-after" alt="${esc(item.afterLabel || "After")}" loading="lazy">
      <img class="cmp-before" alt="${esc(item.beforeLabel || "Before")}" loading="lazy">
      <span class="cmp-tag cmp-l">${esc(item.beforeLabel || "Before")}</span>
      <span class="cmp-tag cmp-r">${esc(item.afterLabel || "After")}</span>
      <span class="cmp-line" aria-hidden="true"></span>
      <span class="cmp-knob" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/></svg></span>
      <input type="range" min="0" max="100" step="0.1" value="50" aria-label="Drag to compare ${esc(item.beforeLabel || "before")} and ${esc(item.afterLabel || "after")}">`;
    const after = $(".cmp-after", box), before = $(".cmp-before", box), range = $("input", box);
    const fail = (path) => () => { if (!box.isConnected) return; const f = document.createElement("div"); f.className = "frame"; f.append(placeholder(path)); box.replaceWith(f); };
    after.addEventListener("error", fail(item.after)); before.addEventListener("error", fail(item.compare));
    after.addEventListener("load", () => { box.style.aspectRatio = `${after.naturalWidth} / ${after.naturalHeight}`; box.style.setProperty("--ar", after.naturalWidth / after.naturalHeight); });
    after.src = item.after || ""; before.src = item.compare || "";
    if (!item.after) fail("")(); 
    range.addEventListener("input", () => box.style.setProperty("--pos", range.value + "%"));
    return box;
  }

  // Build the right element for one media block
  function mediaBlock(item, onImageClick) {
    if (item.compare !== undefined) return compareBlock(item);
    if (item.youtube !== undefined || item.vimeo !== undefined) {
      const f = document.createElement("div"); f.className = "frame";
      const src = embedUrl(item);
      if (!src) { f.append(placeholder("")); return f; }
      f.innerHTML = `<iframe src="${esc(src)}" title="Video" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen></iframe>`;
      return f;
    }
    if (item.video || item.loop) {
      const f = document.createElement("div"); f.className = "frame";
      const v = document.createElement("video");
      v.playsInline = true;
      // every video gets the play bar (time slider, sound, full screen);
      // looping clips still start by themselves, silently, and repeat
      v.controls = true;
      if (item.loop) { v.muted = true; v.loop = true; v.autoplay = !reduced; v.setAttribute("muted", ""); v.preload = "auto"; }
      else { v.preload = "metadata"; }
      if (item.poster) v.poster = item.poster;
      v.innerHTML = `<source src="${esc(item.video || item.loop)}" type="video/mp4">`;
      guard(v, item.video || item.loop);
      f.append(v); return f;
    }
    if (item.image) {
      const b = document.createElement("button");
      b.className = "shot"; b.setAttribute("aria-label", "Enlarge image");
      const i = document.createElement("img"); i.src = item.image; i.alt = item.alt || ""; i.loading = "lazy";
      i.addEventListener("error", () => { const f = document.createElement("div"); f.className = "frame"; f.append(placeholder(item.image)); b.replaceWith(f); });
      b.append(i);
      if (onImageClick) b.addEventListener("click", () => onImageClick(item));
      return b;
    }
    return document.createElement("div");
  }

  /* ---------------- Browser tab title ---------------- */
  const homeTitle = SITE.siteTitle || `${SITE.name} | ${SITE.title}`;
  const tabNames = { work: "Work", showreels: "Showreels", rnd: "R&D", about: "About" };
  document.title = page === "home" ? homeTitle : tabNames[page] ? `${tabNames[page]} | ${SITE.name}` : document.title;

  /* ---------------- Navigation + footer ---------------- */
  const PAGES = [["Home", "index.html", "home"], ["Showreels", "showreels.html", "showreels"], ["Work", "work.html", "work"], ["R&D", "rnd.html", "rnd"], ["About", "about.html", "about"]];
  const navKey = page === "project" ? (params.has("rnd") ? "rnd" : "work") : page;
  const nav = document.createElement("nav");
  nav.className = "nav"; nav.setAttribute("aria-label", "Main");
  nav.innerHTML = `
    <div class="nav-inner">
      <a class="brand" href="index.html">${esc(SITE.name)}</a>
      <ul class="links">${PAGES.map(([label, href, key]) =>
        `<li><a href="${href}"${key === navKey ? ' aria-current="page"' : ""}>${label}</a></li>`).join("")}</ul>
    </div>
    <div class="progress"></div>`;
  document.body.prepend(nav);

  const footer = document.createElement("footer");
  footer.innerHTML = `
    <div class="wrap foot">
      <div>
        <div class="who">${esc(SITE.name)}</div>
        <div>${esc(SITE.title)}, ${esc(SITE.location)}</div>
      </div>
      <div>
        <a href="mailto:${esc(SITE.email)}">${esc(SITE.email)}</a>
        <ul style="margin-top:.5rem">${SITE.socials.map(([n, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a></li>`).join("")}</ul>
      </div>
      <div>© ${new Date().getFullYear()} ${esc(SITE.name)} (${esc(SITE.otherName)})</div>
    </div>`;
  document.body.append(footer);

  const bar = $(".progress", nav);
  function onScroll() {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    bar.style.transform = `scaleX(${Math.min(1, scrollY / max)})`;
    const hero = $(".showreel");
    nav.classList.toggle("clear", !!hero && scrollY < hero.offsetHeight - 120);
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  /* ---------------- Viewer (full-screen player / image) ---------------- */
  const dlg = document.createElement("dialog");
  dlg.setAttribute("aria-label", "Viewer");
  document.body.append(dlg);
  let list = [], at = 0;
  function show() {
    const it = list[at], many = list.length > 1;
    dlg.innerHTML = `<div class="v-media"></div><div class="v-bar"><div><h3>${esc(it.title || "")}</h3>${it.text ? `<p>${esc(it.text)}</p>` : ""}</div>
      <div class="v-actions">${many ? `<button class="btn" data-go="-1">Previous</button><button class="btn" data-go="1">Next</button>` : ""}<button class="btn" data-close>Close</button></div></div>`;
    const el = it.image ? (() => { const i = document.createElement("img"); i.src = it.image; i.alt = it.title || ""; return i; })()
                        : mediaBlock({ ...it, video: it.video, loop: undefined });
    if (el.tagName === "DIV" && $("video", el)) { const v = $("video", el); v.autoplay = true; }
    $(".v-media", dlg).append(el);
    dlg.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { at = (at + +b.dataset.go + list.length) % list.length; show(); });
    $("[data-close]", dlg).onclick = () => dlg.close();
  }
  function openViewer(items, index = 0) {
    list = items; at = index; show();
    if (!dlg.open) dlg.showModal();
    const hv = $(".showreel video"); if (hv) hv.pause();
  }
  dlg.addEventListener("close", () => { dlg.innerHTML = ""; const hv = $(".showreel video"); if (hv && !reduced) hv.play().catch(() => {}); });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  addEventListener("keydown", (e) => {
    if (!dlg.open || list.length < 2) return;
    if (e.key === "ArrowRight") { at = (at + 1) % list.length; show(); }
    if (e.key === "ArrowLeft") { at = (at - 1 + list.length) % list.length; show(); }
  });
  const reelItem = (r) => ({ title: r.title, text: r.note, video: r.video, youtube: r.youtube, vimeo: r.vimeo, poster: r.poster });


  /* ---------------- Password-protected projects ---------------- */
  const LOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';
  async function decrypt(enc, password) {
    const b = (x) => Uint8Array.from(atob(x), c => c.charCodeAt(0));
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: b(enc.salt), iterations: enc.it, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b(enc.iv) }, key, b(enc.data));
    return JSON.parse(new TextDecoder().decode(plain));
  }
  function lockScreen(p, box, back, done) {
    const store = "unlock:" + p.id;
    const open = (data, pw) => { Object.assign(p, data, { _open: true }); try { sessionStorage.setItem(store, pw); } catch {} done(); };
    box.innerHTML = `
      <div class="detail-top"><a class="more" href="${back[0]}">${back[1]}</a></div>
      <div class="lock-screen">
        <div class="lock-icon">${LOCK_SVG}</div>
        <h1>${esc(p.title)}</h1>
        <p class="lede">This project is confidential. Enter the password to view it.</p>
        <form class="lock-form" autocomplete="off">
          <label class="sr" for="pw">Password</label>
          <input id="pw" type="password" placeholder="Password" required>
          <button class="btn primary" type="submit">Unlock</button>
        </form>
        <p class="lock-msg" role="alert"></p>
      </div>`;
    const form = $(".lock-form", box), msg = $(".lock-msg", box), input = $("#pw", box);
    if (!window.crypto || !crypto.subtle) { msg.textContent = "Password-protected projects can only be opened on the live website (https)."; form.remove(); return; }
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); msg.textContent = "Checking…";
      try { open(await decrypt(p.enc, input.value), input.value); }
      catch { msg.textContent = "That password isn't right. Please try again."; input.select(); }
    });
    input.focus();
    // already unlocked earlier in this visit
    let saved = null; try { saved = sessionStorage.getItem(store); } catch {}
    if (saved) decrypt(p.enc, saved).then(d => open(d, saved)).catch(() => {});
  }

  /* ---------------- Automatic covers ----------------
     If no cover image is set, use the first image in the item's media, then a YouTube
     thumbnail, and finally a frame from the first video file. */
  const ytId = (u) => (String(u || "").match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/) || [])[1];
  function coverOf(x, key = "cover") {
    if (x[key]) return { image: x[key] };
    if (x.protected && !x.media) return { locked: true };
    const list = x.media && x.media.length ? x.media : [x];
    for (const b of list) { if (b.image) return { image: b.image }; if (b.compare !== undefined && (b.after || b.compare)) return { image: b.after || b.compare }; }
    for (const b of list) { const id = ytId(b.youtube); if (id) return { image: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` }; }
    for (const b of list) if (b.video || b.loop) return { video: b.video || b.loop };
    return { image: "" };
  }
  function coverEl(x, key = "cover", focus) {
    const c = coverOf(x, key);
    if (c.locked) { const d = document.createElement("div"); d.className = "locked-cover"; d.innerHTML = LOCK_SVG; return d; }
    if (!c.video) return img(c.image, "", focus);
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "metadata"; v.setAttribute("muted", "");
    v.src = c.video + "#t=1";
    if (focus) v.style.objectPosition = focus;
    v.addEventListener("error", () => { if (v.isConnected) v.replaceWith(placeholder(c.video)); });
    return v;
  }

  /* ---------------- Reusable tiles + cards ---------------- */
  function workTile(w) {
    const a = document.createElement("a");
    a.className = "work-tile"; a.href = `project.html?id=${encodeURIComponent(w.id)}`; a.dataset.cat = w.category || "";
    const year = (w.details || []).find(([k]) => /year/i.test(k))?.[1];
    a.innerHTML = `<div class="frame">${w.protected ? `<span class="lock-tag">${LOCK_SVG}<span>Password</span></span>` : ""}<div class="tile-text"><h3>${esc(w.title)}</h3><p>${esc([w.category, w.protected && !w._open ? "Confidential" : year].filter(Boolean).join(", "))}</p></div></div>`;
    const frame = $(".frame", a);
    frame.prepend(coverEl(w, "cover", w.coverFocus));
    if (w.preview && canHover && !reduced) {
      const v = document.createElement("video");
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = "none";
      v.innerHTML = `<source src="${esc(w.preview)}" type="video/mp4">`;
      $("source", v).addEventListener("error", () => v.remove());
      frame.insertBefore(v, $(".tile-text", frame));
      a.addEventListener("pointerenter", () => { if (v.isConnected) v.play().then(() => a.classList.add("playing")).catch(() => {}); });
      a.addEventListener("pointerleave", () => { a.classList.remove("playing"); if (v.isConnected) { v.pause(); v.currentTime = 0; } });
    }
    return a;
  }
  // One thumbnail in the edge-to-edge wall. Pass href for a link, or onClick for a button.
  function wallTile({ href, external, onClick, item, coverKey = "cover", focus, title, meta, summary, play }) {
    const el = document.createElement(href ? "a" : "button");
    el.className = "work-tile";
    if (href) { el.href = href; if (external) { el.target = "_blank"; el.rel = "noopener"; } }
    if (onClick) el.addEventListener("click", onClick);
    el.innerHTML = `<div class="frame">${item && item.protected ? `<span class="lock-tag">${LOCK_SVG}<span>Password</span></span>` : ""}${play ? `<span class="play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></span>` : ""}
      <div class="tile-text"><h3>${esc(title)}</h3>${meta ? `<p>${esc(meta)}</p>` : ""}${summary ? `<p class="sum">${esc(summary)}</p>` : ""}</div></div>`;
    $(".frame", el).prepend(coverEl(item, coverKey, focus));
    return el;
  }
  function rndCard(r) {
    const external = !!r.link;
    const a = document.createElement("a");
    a.className = "post";
    a.href = external ? r.link : `project.html?rnd=${encodeURIComponent(r.id)}`;
    if (external) { a.target = "_blank"; a.rel = "noopener"; }
    a.innerHTML = `<div class="frame">${r.protected ? `<span class="lock-tag">${LOCK_SVG}<span>Password</span></span>` : ""}</div><time datetime="${esc(r.date)}">${esc(fmtDate(r.date))}</time>
      <h3>${esc(r.title)}</h3><p>${esc(r.summary)}</p>${external ? `<span class="ext">Opens on ${esc(host(r.link))}</span>` : ""}`;
    $(".frame", a).append(coverEl(r, "cover", r.coverFocus));
    return a;
  }

  /* ================= Pages ================= */

  if (page === "home") {
    const hero = $(".showreel");
    const v = document.createElement("video");
    v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = !reduced; v.preload = "auto";
    v.setAttribute("muted", ""); v.poster = HOME.heroPoster;
    if (HOME.heroPosterFocus) v.style.objectPosition = HOME.heroPosterFocus;
    // Phones held upright: use the vertical phone video if there is one; otherwise show the
    // whole wide video (no cropping) over a blurred version of the poster, unless "fill" is chosen
    const phone = matchMedia("(max-width: 760px) and (orientation: portrait)");
    const srcFor = () => phone.matches && HOME.heroMobileVideo ? HOME.heroMobileVideo : HOME.heroVideo;
    const layout = () => hero.classList.toggle("fit", phone.matches && !HOME.heroMobileVideo && !HOME.heroFill);
    // full address, because a relative one would be resolved from the CSS file's folder
    if (HOME.heroPoster) hero.style.setProperty("--poster", `url("${new URL(HOME.heroPoster, location.href).href.replace(/"/g, "%22")}")`);
    v.innerHTML = `<source src="${esc(srcFor())}" type="video/mp4">`;
    guard(v, srcFor());
    layout();
    phone.addEventListener("change", () => {
      layout();
      const want = srcFor();
      if (v.isConnected && !v.querySelector(`source[src="${CSS.escape(want)}"]`)) { v.innerHTML = `<source src="${esc(want)}" type="video/mp4">`; v.load(); if (!reduced) v.play().catch(() => {}); }
    });
    hero.prepend(v);
    new IntersectionObserver(([e]) => { if (!v.isConnected || reduced || dlg.open) return; e.isIntersecting ? v.play().catch(() => {}) : v.pause(); }).observe(hero);

    const sound = $("#sound");
    const ico = (on) => on
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9.5l4 5M21 9.5l-4 5"/></svg>`;
    const setSound = () => { sound.innerHTML = `${ico(!v.muted)}<span>${v.muted ? "Sound off" : "Sound on"}</span>`; sound.setAttribute("aria-pressed", String(!v.muted)); };
    sound.addEventListener("click", () => { v.muted = !v.muted; if (!v.muted) v.play().catch(() => {}); setSound(); });
    setSound();
    if (SHOWREELS.length) $("#full-reel").addEventListener("click", () => openViewer([reelItem(SHOWREELS[0])]));
    else $("#full-reel").remove();

    $("#intro-text").textContent = HOME.intro;
    $("#intro-meta").textContent = `${SITE.title}, ${SITE.location}`;
    $("#intro-photo").append(img(HOME.portrait, SITE.name, HOME.portraitFocus));

    HOME.sections.forEach(s => {
      const a = document.createElement("a");
      a.className = "panel"; a.href = s.link;
      a.innerHTML = `<div class="panel-text"><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p><span class="go">View ${esc(s.title)}</span></div>`;
      a.prepend(img(s.image, "", s.imageFocus));
      $("#panels").append(a);
    });

    RND.slice(0, 5).forEach(r => $("#latest").append(rndCard(r)));
  }

  if (page === "work") {
    const grid = $("#work-grid"), chips = $("#filters");
    grid.className = "work-wall";  // full-width wall, 4 per row
    // Featured projects (up to 2) are shown large at the top, and left out of the wall below
    const featured = WORK.filter(w => w.featured).slice(0, 2);
    if (featured.length) {
      const box = document.createElement("section");
      box.className = "featured" + (featured.length === 1 ? " one" : "");
      box.setAttribute("aria-label", "Featured projects");
      featured.forEach(w => {
        const t = workTile(w);
        t.insertAdjacentHTML("afterbegin", `<span class="feat-tag">Featured</span>`);
        box.append(t);
      });
      grid.before(box);
      const row = document.createElement("div");
      row.className = "wrap filters-row";
      row.append(chips);
      box.after(row);
    }
    const tiles = WORK.map(w => { const t = workTile(w); t.dataset.featured = featured.includes(w) ? "1" : ""; t.hidden = !!t.dataset.featured; grid.append(t); return t; });
    const cats = ["All", ...new Set(WORK.map(w => w.category).filter(Boolean))];
    if (cats.length > 2) cats.forEach(c => {
      const b = document.createElement("button");
      b.className = "chip"; b.textContent = c; b.setAttribute("aria-pressed", String(c === "All"));
      b.addEventListener("click", () => {
        chips.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        // "All" leaves the featured projects out (they're shown above); a category shows everything in it
        tiles.forEach(t => t.hidden = c === "All" ? !!t.dataset.featured : t.dataset.cat !== c);
      });
      chips.append(b);
    });
  }

  if (page === "showreels") {
    const [latest, ...older] = SHOWREELS;
    if (latest) {
      const feat = $("#reel-featured");
      feat.append(mediaBlock({ video: latest.video, youtube: latest.youtube, vimeo: latest.vimeo, poster: latest.poster }));
      feat.insertAdjacentHTML("beforeend", `<div class="reel-caption"><h2>${esc(latest.title)}</h2><p class="lede">${esc(latest.note || "")}</p></div>`);
    }
    const olderBox = $("#older");
    olderBox.classList.remove("wrap"); $(".block-head", olderBox).classList.add("wrap");
    $("#reel-list").className = "work-wall";
    older.forEach((r, i) => $("#reel-list").append(wallTile({
      onClick: () => openViewer(older.map(reelItem), i), item: r, coverKey: "poster", focus: r.posterFocus,
      title: r.title, meta: r.year, summary: r.note, play: true })));
    if (!older.length) olderBox.remove();
  }

  if (page === "rnd") {
    const list = $("#rnd-list");
    list.className = "work-wall";
    RND.forEach(r => list.append(wallTile({
      href: r.link || `project.html?rnd=${encodeURIComponent(r.id)}`, external: !!r.link,
      item: r, focus: r.coverFocus, title: r.title,
      meta: r.link ? `${fmtDate(r.date)}, opens on ${host(r.link)}` : fmtDate(r.date), summary: r.summary })));
  }

  if (page === "project") {
    const isRnd = params.has("rnd");
    const all = isRnd ? RND.filter(r => !r.link) : WORK;
    const id = params.get(isRnd ? "rnd" : "id");
    const idx = all.findIndex(x => x.id === id);
    const back = isRnd ? ["rnd.html", "Back to R&D"] : ["work.html", "Back to work"];
    const box = $("#detail");
    if (idx < 0) {
      box.innerHTML = `<div class="page-head"><h1>Not found</h1><p class="lede" style="margin:1.25rem 0 2rem">This project doesn’t exist or has been renamed.</p><a class="btn" href="${back[0]}">${back[1]}</a></div>`;
      $("#others").remove();
    } else {
      const p = all[idx];
      document.title = `${p.title} | ${SITE.name}`;
      const showProject = () => {
      document.title = `${p.title} | ${SITE.name}`;
      const href = (x) => `project.html?${isRnd ? "rnd" : "id"}=${encodeURIComponent(x.id)}`;
      const prev = all[(idx - 1 + all.length) % all.length], next = all[(idx + 1) % all.length];
      const chev = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="${d}"/></svg>`;
      box.innerHTML = `
        <div class="detail-top">
          <a class="more" href="${back[0]}">${back[1]}</a>
          ${all.length > 1 ? `<div class="pager">
            <a class="btn" href="${href(prev)}" aria-label="Previous: ${esc(prev.title)}">${chev("M15 6l-6 6 6 6")}<span>Previous</span></a>
            <a class="btn" href="${href(next)}" aria-label="Next: ${esc(next.title)}"><span>Next</span>${chev("M9 6l6 6-6 6")}</a></div>` : ""}
        </div>
        <div class="detail-grid">
          <div class="detail-media" id="detail-media"></div>
          <aside class="detail-info">
            ${isRnd && p.date ? `<time>${esc(fmtDate(p.date))}</time>` : (p.category ? `<span class="cat">${esc(p.category)}</span>` : "")}
            <h1>${esc(p.title)}</h1>
            ${(p.details || []).length ? `<dl class="facts">${p.details.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : ""}
            <div class="desc">${(p.description || []).map(t => `<p>${esc(t)}</p>`).join("")}</div>
            ${(p.credits || []).length ? `<h2>Credits</h2><dl class="credits">${p.credits.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : ""}
          </aside>
        </div>`;
      const images = (p.media || []).filter(m => m.image).map(m => ({ image: m.image, title: p.title, text: m.caption }));
      const mediaBox = $("#detail-media");
      const items = p.media && p.media.length ? p.media : [{ image: p.cover }];
      items.forEach(m => {
        const el = mediaBlock(m, (it) => openViewer(images, Math.max(0, images.findIndex(x => x.image === it.image))));
        if (!m.caption) return mediaBox.append(el);
        const fig = document.createElement("figure");
        fig.className = "media-fig";
        const cap = document.createElement("figcaption");
        cap.textContent = m.caption;
        fig.append(el, cap);
        mediaBox.append(fig);
      });
      };
      if (p.protected && p.enc && !p._open) lockScreen(p, box, back, showProject); else showProject();

      const others = all.filter(x => x !== p).slice(0, 3);
      if (!others.length) $("#others").remove();
      else {
        $("#others-title").textContent = isRnd ? "More R&D" : "More projects";
        others.forEach(o => $("#others-list").append(isRnd ? rndCard(o) : workTile(o)));
        if (isRnd) $("#others-list").className = "posts";
      }
    }
  }

  if (page === "about") {
    $("#about-photo").append(img(ABOUT.portrait, SITE.name, ABOUT.portraitFocus));
    $("#about-name").textContent = SITE.name;
    $("#about-alias").textContent = SITE.otherName;
    $("#about-role").textContent = SITE.title;
    $("#about-bio").innerHTML = ABOUT.bio.map(p => `<p>${esc(p)}</p>`).join("");
    $("#about-exp").innerHTML = ABOUT.experience.map(x =>
      `<li><span class="r">${esc(x.role)}</span><span class="p">${esc(x.place)}</span><span class="t">${esc(x.time)}</span>${x.details ? `<p class="d">${esc(x.details)}</p>` : ""}</li>`).join("");
    $("#about-tools").innerHTML = ABOUT.tools.map(t => `<li>${esc(t)}</li>`).join("");
    const mail = $("#about-mail"); mail.textContent = SITE.email; mail.href = `mailto:${SITE.email}`;
    $("#about-socials").innerHTML = SITE.socials.map(([n, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a></li>`).join("");
  }
})();
