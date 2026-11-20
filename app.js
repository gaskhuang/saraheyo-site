(() => {
  "use strict";

  /* 表單送出位置：接上後端（例如 Formspree、WordPress 表單端點）後填入網址。
     留空時改用 mailto 開啟訪客的郵件軟體。 */
  const FORM_ENDPOINT = "";
  const CONTACT_EMAIL = "sarah@saraheyo.com";

  const I18N = window.I18N;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lang = "en";
  const t = (k) => (I18N[lang] && I18N[lang][k]) ?? I18N.en[k] ?? k;

  /* ---------- 語言切換 ---------- */
  function storeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function storeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* 私密模式等情況，忽略 */ } }

  function applyLang(next) {
    lang = I18N[next] ? next : "en";
    document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
    document.title = t("meta.title");
    $$("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    $$("[data-i18n-ph]").forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    $$("[data-i18n-aria]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
    $$(".lang-switch button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    $$("[data-map-label]").forEach(el => { el.textContent = t(el.dataset.mapLabel); });
    storeSet("lang", lang);
    const url = new URL(location.href);
    url.searchParams.set("lang", lang);
    history.replaceState(null, "", url);
  }

  const urlLang = new URLSearchParams(location.search).get("lang");
  const initial = urlLang || storeGet("lang") || ((navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en");
  $$(".lang-switch button").forEach(b => b.addEventListener("click", () => applyLang(b.dataset.lang)));

  /* ---------- 手機選單 ---------- */
  const navToggle = $("#navToggle"), nav = $("#mainNav");
  navToggle.addEventListener("click", () => {
    const open = navToggle.getAttribute("aria-expanded") !== "true";
    navToggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("open", open);
  });
  $$("#mainNav a").forEach(a => a.addEventListener("click", () => {
    navToggle.setAttribute("aria-expanded", "false"); nav.classList.remove("open");
  }));

  /* ---------- 聯絡表單：身份切換 ---------- */
  const form = $("#contactForm");
  const inquiry = $("#f-inquiry");
  const defaultInquiry = { brand: "Brand Representation", retailer: "Wholesale Sourcing", general: "General Inquiry" };
  let inquiryTouched = false;
  inquiry.addEventListener("change", () => { inquiryTouched = true; });

  function setIdentity(type) {
    const radio = $(`input[name="identity"][value="${type}"]`);
    if (radio) radio.checked = true;
    $$("[data-show]", form).forEach(el => {
      const show = el.dataset.show === type;
      el.hidden = !show;
      $$("input, select, textarea", el).forEach(i => { i.disabled = !show; });
      if (el.matches("select, input")) el.disabled = !show;
    });
    if (!inquiryTouched) inquiry.value = defaultInquiry[type] || "";
  }
  $$('input[name="identity"]').forEach(r => r.addEventListener("change", () => setIdentity(r.value)));
  $$("[data-contact-type]").forEach(a => a.addEventListener("click", () => setIdentity(a.dataset.contactType)));

  /* ---------- 聯絡表單：驗證與送出 ---------- */
  const errBox = $("#formError"), okBox = $("#formSuccess");
  function showError(msg) { errBox.textContent = msg; errBox.hidden = false; }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errBox.hidden = true;
    $$(".invalid", form).forEach(el => el.classList.remove("invalid"));

    const required = $$("[required]", form).filter(el => !el.disabled && el.type !== "checkbox");
    const empty = required.filter(el => !el.value.trim());
    if (empty.length) { empty.forEach(el => el.classList.add("invalid")); empty[0].focus(); return showError(t("f.errRequired")); }
    const email = $("#f-email");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { email.classList.add("invalid"); email.focus(); return showError(t("f.errEmail")); }
    if (!$("#f-consent").checked) return showError(t("f.errConsent"));

    const data = new FormData(form);
    const identity = data.get("identity");
    const payload = Object.fromEntries([...data.keys()].map(k => [k, data.getAll(k).join(", ")]));
    payload.language = lang;

    const subject = identity === "brand"
      ? `[Brand Inquiry] ${payload.company} – ${payload.origin || ""}`
      : identity === "retailer"
        ? `[Retailer Inquiry] ${payload.company} – ${payload.storeType || ""}`
        : `[General Inquiry] ${payload.company}`;

    try {
      if (FORM_ENDPOINT) {
        const res = await fetch(FORM_ENDPOINT, {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ subject, ...payload })
        });
        if (!res.ok) throw new Error(res.status);
      } else {
        const body = Object.entries(payload).filter(([k]) => k !== "consent").map(([k, v]) => `${k}: ${v}`).join("\n");
        location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }
      $$(".identity, .form-grid, .consent, button[type=submit]", form).forEach(el => { el.hidden = true; });
      okBox.hidden = false;
    } catch {
      showError(t("f.errSend"));
    }
  });

  /* ---------- 數字跑動 ---------- */
  function countUp(el) {
    const target = +el.dataset.target;
    if (reduceMotion) { el.textContent = target.toLocaleString("en-US"); return; }
    const start = performance.now(), dur = 1800;
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString("en-US");
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = "0";
    requestAnimationFrame(step);
  }

  /* ---------- 捲動進場 ---------- */
  const revealTargets = $$(".section-head, .metric, .service, .why-panel, .tier, .brand-card, .cat-tile, .contact-copy, .contact-form");
  if ("IntersectionObserver" in window && !reduceMotion) {
    revealTargets.forEach(el => el.classList.add("reveal"));
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        const c = $(".count", en.target);
        if (c) countUp(c);
        io.unobserve(en.target);
      });
    }, { threshold: 0.2 });
    revealTargets.forEach(el => io.observe(el));
  }

  /* ---------- Hero 地圖：亞洲 → 太平洋 → 美國 ---------- */
  const ORIGINS = [
    { key: "map.tw", c: [121.0, 23.7], dx: 10, dy: 4, a: "start" },
    { key: "map.kr", c: [127.8, 36.4], dx: -10, dy: -8, a: "end" },
    { key: "map.jp", c: [139.7, 35.7], dx: 10, dy: -8, a: "start" },
    { key: "map.vn", c: [106.6, 16.0], dx: 10, dy: 4, a: "start" },
    { key: "map.th", c: [100.5, 14.5], dx: -10, dy: 4, a: "end" },
    { key: "map.my", c: [101.7, 3.6], dx: 10, dy: 0, a: "start" },
    { key: "map.sg", c: [103.8, 1.3], dx: 0, dy: 26, a: "middle" }
  ];
  const HUBS = [
    { key: "map.ca", c: [-119.4, 36.5], dx: -10, dy: -10, a: "end" },
    { key: "map.tx", c: [-97.7, 31.0], dx: 0, dy: 24, a: "middle" },
    { key: "map.ny", c: [-74.0, 40.7], dx: 0, dy: -14, a: "middle" }
  ];
  const PACIFIC = [-172, 31];
  const W = 760, H = 434;

  function drawMap(land) {
    const host = $("#heroMap");
    if (!window.d3 || !host) return;
    const d3 = window.d3;
    host.innerHTML = "";
    const proj = d3.geoNaturalEarth1().rotate([167, 0])
      .fitExtent([[8, 8], [W - 8, H - 8]], { type: "MultiPoint", coordinates: [[70, -6], [-64, -6], [70, 56], [-64, 56]] });
    const path = d3.geoPath(proj);
    const svg = d3.select(host).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("aria-hidden", "true").style("overflow", "hidden");

    const defs = svg.append("defs");
    defs.append("pattern").attr("id", "dots").attr("width", 7).attr("height", 7).attr("patternUnits", "userSpaceOnUse")
      .append("circle").attr("cx", 3.5).attr("cy", 3.5).attr("r", 1.6).attr("fill", "#B5D3D0");
    const glow = defs.append("radialGradient").attr("id", "glow");
    glow.append("stop").attr("offset", "0%").attr("stop-color", "#42A7A2").attr("stop-opacity", .45);
    glow.append("stop").attr("offset", "100%").attr("stop-color", "#42A7A2").attr("stop-opacity", 0);

    if (land) svg.append("path").datum(land).attr("d", path).attr("fill", "url(#dots)");

    const P = proj(PACIFIC);
    const curve = (a, b, lift) => {
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - lift;
      return `M${a[0]},${a[1]} Q${mx},${my} ${b[0]},${b[1]}`;
    };
    const routes = svg.append("g");
    const addRoute = (d, i) => {
      routes.append("path").attr("class", "route").attr("d", d);
      routes.append("path").attr("class", "route-flow").attr("d", d);
      if (!reduceMotion) {
        const dot = routes.append("circle").attr("r", 3.2).attr("fill", "#2E7F7B");
        dot.append("animateMotion").attr("dur", `${3 + (i % 3) * .6}s`).attr("repeatCount", "indefinite")
          .attr("begin", `${(i * .37) % 2}s`).attr("path", d);
      }
    };
    ORIGINS.forEach((o, i) => addRoute(curve(proj(o.c), P, 40 + i * 6), i));
    HUBS.forEach((h, i) => addRoute(curve(P, proj(h.c), 50 + i * 12), i + 7));

    svg.append("circle").attr("cx", P[0]).attr("cy", P[1]).attr("r", 26).attr("fill", "url(#glow)");
    svg.append("circle").attr("cx", P[0]).attr("cy", P[1]).attr("r", 4).attr("fill", "#42A7A2");

    const node = (o, hub) => {
      const [x, y] = proj(o.c);
      const g = svg.append("g");
      g.append("circle").attr("class", "pulse").attr("cx", x).attr("cy", y).attr("r", hub ? 9 : 7).attr("fill", hub ? "#2E7F7B" : "#42A7A2").attr("opacity", .5);
      g.append("circle").attr("cx", x).attr("cy", y).attr("r", hub ? 7 : 5).attr("fill", hub ? "#2E7F7B" : "#42A7A2").attr("stroke", "#fff").attr("stroke-width", 2);
      g.append("text").attr("class", "map-label" + (hub ? " hub" : "")).attr("x", x + o.dx).attr("y", y + o.dy)
        .attr("text-anchor", o.a).attr("data-map-label", o.key).text(t(o.key));
    };
    ORIGINS.forEach(o => node(o, false));
    HUBS.forEach(h => node(h, true));
  }

  function initMap() {
    if (!window.d3) return;
    drawMap(null); // 先畫路線，陸地資料載入後補上
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json")
      .then(r => r.json())
      .then(topo => drawMap(window.topojson.feature(topo, topo.objects.land)))
      .catch(() => { /* 離線時只顯示路線 */ });
  }

  /* ---------- 啟動 ---------- */
  const y = $("#year"); if (y) y.textContent = new Date().getFullYear();
  setIdentity("brand");
  initMap();
  applyLang(initial);
})();
