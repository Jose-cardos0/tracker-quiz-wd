/* ===========================================================================
 * HMTrack — tracker leve para quizzes/páginas de funil.
 * Vanilla JS, sem dependências. Captura: visitante único, sessão, atribuição
 * de campanha (UTM/ids de anúncio), passos do quiz, tempo por passo, cliques,
 * respostas e abandono. Envia em lote via fetch / sendBeacon.
 *
 *   HMTrack.init({ projectId, endpoint, totalSteps, autoAnswers })
 *   HMTrack.step(index, name)              // ao entrar em cada etapa
 *   HMTrack.answer(question, value, kind)  // resposta escolhida
 *   HMTrack.event(type, meta)              // evento custom (ex: checkout)
 *
 * autoAnswers (opcional): captura respostas sozinho a partir do markup:
 *   - única:   <button data-val="...">
 *   - múltipla: <... data-multi> com filhos data-val (manda o conjunto atual)
 *   - texto:   <input data-answer="pergunta">
 *   Quizzes que já chamam HMTrack.answer() manualmente NÃO devem ligar isto
 *   (evita captura em dobro). Etapas de foto/vídeo são ignoradas.
 * ===========================================================================*/
(function () {
  "use strict";

  var LS_VISITOR = "hm_vid";
  var LS_FIRST_UTM = "hm_first_utm";
  var SS_SESSION = "hm_sess"; // { id, last }
  var SESSION_GAP = 30 * 60 * 1000; // 30 min => nova sessão
  var FLUSH_MS = 4000;
  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  var CLICK_IDS = ["fbclid", "gclid", "ttclid", "msclkid"];

  var cfg = null;
  var queue = [];
  var flushTimer = null;
  var visitorId = null;
  var sessionId = null;
  var isNewVisitor = false;
  var firstUtm = null;
  var sessionUtm = null;
  var cid = null;

  // ---- helpers -----------------------------------------------------------
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }

  function setCookie(name, val, days) {
    try {
      var d = new Date();
      d.setTime(d.getTime() + days * 864e5);
      document.cookie =
        name + "=" + val + ";expires=" + d.toUTCString() + ";path=/;SameSite=Lax";
    } catch (e) {}
  }

  function parseQuery() {
    var q = {};
    try {
      var sp = new URLSearchParams(location.search);
      sp.forEach(function (v, k) { q[k] = v; });
    } catch (e) {}
    return q;
  }

  function deviceType() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      ? "mobile"
      : "desktop";
  }

  // ---- bot / automação ---------------------------------------------------
  // Ao subir uma campanha, a Meta dispara revisão de anúncio + crawlers
  // (facebookexternalhit, navegadores headless) que carregam a página,
  // chegam na etapa 1 e saem — inflando as sessões com 0% de conclusão.
  // NÃO confundir com o navegador in-app do Facebook (UA "FBAN/FBAV"), que
  // é gente de verdade e não é filtrado aqui.
  var BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|meta-externalagent|facebookcatalog|bingpreview|headless|lighthouse|phantom|puppeteer|playwright|selenium|semrush|ahrefs|petalbot|baiduspider|yandex|whatsapp|telegram|skypeuripreview|google-inspectiontool/i;
  function isBot() {
    try {
      if (navigator.webdriver) return true; // automação (headless, ad-review)
      var ua = navigator.userAgent || "";
      if (!ua) return true; // sem user-agent = quase sempre bot
      return BOT_RE.test(ua);
    } catch (e) {
      return false;
    }
  }

  // ---- identity & attribution -------------------------------------------
  function initIdentity() {
    visitorId = lsGet(LS_VISITOR);
    if (!visitorId) {
      visitorId = uuid();
      lsSet(LS_VISITOR, visitorId);
      isNewVisitor = true;
    }
    setCookie(LS_VISITOR, visitorId, 365);

    var q = parseQuery();
    var utm = {};
    UTM_KEYS.concat(CLICK_IDS).forEach(function (k) {
      if (q[k]) utm[k] = q[k];
    });
    cid = q.cid || null;
    sessionUtm = Object.keys(utm).length ? utm : null;

    // first-touch: só grava se ainda não existir
    var stored = lsGet(LS_FIRST_UTM);
    if (stored) {
      try { firstUtm = JSON.parse(stored); } catch (e) {}
    } else if (sessionUtm) {
      firstUtm = sessionUtm;
      lsSet(LS_FIRST_UTM, JSON.stringify(firstUtm));
    }

    // sessão: nova se passou do gap de inatividade
    var now = Date.now();
    var raw = ssGet(SS_SESSION);
    var sess = null;
    if (raw) { try { sess = JSON.parse(raw); } catch (e) {} }
    if (sess && sess.id && now - sess.last < SESSION_GAP) {
      sessionId = sess.id;
    } else {
      sessionId = uuid();
    }
    ssSet(SS_SESSION, JSON.stringify({ id: sessionId, last: now }));
  }

  function touchSession() {
    ssSet(SS_SESSION, JSON.stringify({ id: sessionId, last: Date.now() }));
  }

  // ---- queue & transport -------------------------------------------------
  function push(type, props) {
    if (!cfg) return;
    var ev = { type: type, ts: Date.now(), url: location.href };
    if (props) for (var k in props) ev[k] = props[k];
    queue.push(ev);
    touchSession();
    if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_MS);
    if (queue.length >= 20) flush();
  }

  function buildPayload(events) {
    return {
      projectId: cfg.projectId,
      visitorId: visitorId,
      sessionId: sessionId,
      context: {
        url: location.href,
        referrer: document.referrer || null,
        ua: navigator.userAgent,
        device: deviceType(),
        utm: sessionUtm,
        firstUtm: firstUtm,
        cid: cid,
        isNewVisitor: isNewVisitor,
        totalSteps: cfg.totalSteps || null,
        lang: navigator.language || null,
      },
      events: events,
    };
  }

  function flush(useBeacon) {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    if (!queue.length || !cfg) return;
    var batch = queue.splice(0, queue.length);
    var payload = JSON.stringify(buildPayload(batch));

    if (useBeacon && navigator.sendBeacon) {
      try {
        // text/plain = tipo "safelisted" do CORS -> beacon funciona cross-domain
        // sem preflight. O servidor faz JSON.parse do corpo de qualquer forma.
        var blob = new Blob([payload], { type: "text/plain;charset=UTF-8" });
        navigator.sendBeacon(cfg.endpoint, blob);
        return;
      } catch (e) { /* cai pro fetch */ }
    }
    try {
      fetch(cfg.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
        credentials: "omit",
      }).catch(function () {});
    } catch (e) {}
  }

  // ---- step timing -------------------------------------------------------
  var curStep = null; // { index, name, enteredAt }

  function closeStep() {
    if (!curStep) return;
    var dur = Date.now() - curStep.enteredAt;
    push("step_exit", {
      step_index: curStep.index,
      step_name: curStep.name,
      duration_ms: dur,
    });
    curStep = null;
  }

  function openStep(index, name) {
    curStep = { index: index, name: name || null, enteredAt: Date.now() };
    push("step_view", { step_index: index, step_name: name || null });
    if (cfg.totalSteps && index >= cfg.totalSteps) {
      // chegou na última etapa
      push("reached_last", { step_index: index });
    }
  }

  // ---- click capture -----------------------------------------------------
  function describeTarget(el) {
    if (!el) return {};
    var clickable =
      el.closest(
        "[data-track],a,button,.opt,.chip,.pcard,.acard,.planopt,.cta,.segment button"
      ) || el;
    var text = (clickable.getAttribute("data-val") ||
      clickable.getAttribute("aria-label") ||
      (clickable.textContent || "").trim()).slice(0, 80);
    return {
      tag: clickable.tagName ? clickable.tagName.toLowerCase() : null,
      id: clickable.id || null,
      cls: (clickable.className && clickable.className.toString
        ? clickable.className.toString()
        : "").slice(0, 80) || null,
      track: clickable.getAttribute("data-track") || null,
      text: text || null,
    };
  }

  function onClick(e) {
    var t = describeTarget(e.target);
    push("click", {
      step_index: curStep ? curStep.index : null,
      meta: t,
    });
    if (cfg.autoAnswers) autoAnswerFromClick(e.target);
  }

  // ---- auto answer capture (opt-in: autoAnswers) -------------------------
  // Convenção (abordagem "a"):
  //   - resposta única:   <button data-val="...">           -> value = data-val
  //   - múltipla escolha: <div data-multi> ... data-val ... -> value = [selecionados]
  //   - texto livre:      <input data-answer="pergunta">    -> value = field.value
  // Etapas sem esses marcadores (foto/vídeo + "Próximo") são ignoradas.
  function answerQuestion(el) {
    // nome da pergunta: data-question explícito > nome da etapa atual > "Etapa N"
    var marked = el.closest ? el.closest("[data-question]") : null;
    if (marked && marked.getAttribute("data-question"))
      return marked.getAttribute("data-question").slice(0, 120);
    if (curStep && curStep.name) return curStep.name;
    if (curStep) return "Etapa " + curStep.index;
    return null;
  }
  function isSelected(n) {
    if (!n) return false;
    if (
      n.classList &&
      (n.classList.contains("sel") ||
        n.classList.contains("selected") ||
        n.classList.contains("active") ||
        n.classList.contains("checked"))
    )
      return true;
    if (n.getAttribute && n.getAttribute("aria-checked") === "true") return true;
    var inp = n.querySelector && n.querySelector("input:checked");
    return !!inp;
  }
  function autoAnswerFromClick(target) {
    if (!target || !target.closest) return;
    var opt = target.closest("[data-val]");
    if (!opt) return; // não é uma opção de resposta -> ignora (nav/foto/vídeo)
    var q = answerQuestion(opt);
    if (!q) return;
    var multi = opt.closest("[data-multi]");
    // adia para depois do handler do quiz (que aplica a classe de selecionado)
    setTimeout(function () {
      if (multi) {
        var vals = Array.prototype.slice
          .call(multi.querySelectorAll("[data-val]"))
          .filter(isSelected)
          .map(function (n) {
            return n.getAttribute("data-val");
          });
        API.answer(q, vals, "multi");
      } else {
        API.answer(q, opt.getAttribute("data-val"), "single");
      }
    }, 0);
  }
  function onAutoChange(e) {
    var f = e.target;
    if (!f || !f.matches || !f.matches("[data-answer]")) return;
    var q = f.getAttribute("data-answer");
    if (!q) q = answerQuestion(f);
    if (q) API.answer(q, f.value, "text");
  }

  // ---- auto step detection ----------------------------------------------
  // For uploaded quizzes that show one section at a time (e.g. .step.active
  // or display toggling). Detects the visible step and fires step events with
  // zero manual HMTrack.step() calls. totalSteps is inferred from the count.
  var autoLastEl = null;
  var autoRaf = false;

  function autoStepEls() {
    return Array.prototype.slice.call(
      document.querySelectorAll(cfg.stepSelector)
    );
  }
  function autoIndexOf(el, all) {
    var d = el.getAttribute("data-step");
    if (d && !isNaN(+d)) return +d;
    return all.indexOf(el) + 1;
  }
  function autoNameOf(el) {
    var n = el.getAttribute("data-step-name");
    if (n) return n.slice(0, 80);
    var h = el.querySelector("h1,h2,h3,[data-step-title]");
    if (h && h.textContent) return h.textContent.trim().slice(0, 80);
    return null;
  }
  function autoVisible(el) {
    if (el.classList.contains("active")) return true;
    var s = window.getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") return false;
    return el.offsetParent !== null || s.position === "fixed";
  }
  function autoCurrent(all) {
    for (var i = 0; i < all.length; i++)
      if (all[i].classList.contains("active")) return all[i];
    for (var j = 0; j < all.length; j++) if (autoVisible(all[j])) return all[j];
    return null;
  }
  function autoCheck() {
    autoRaf = false;
    var all = autoStepEls();
    if (!all.length) return;
    if (!cfg.totalSteps) cfg.totalSteps = all.length;
    var cur = autoCurrent(all);
    if (!cur || cur === autoLastEl) return;
    autoLastEl = cur;
    API.step(autoIndexOf(cur, all), autoNameOf(cur));
  }
  function autoSchedule() {
    if (autoRaf) return;
    autoRaf = true;
    (window.requestAnimationFrame || setTimeout)(autoCheck, 0);
  }
  function setupAutoSteps() {
    var run = function () {
      var all = autoStepEls();
      if (all.length) cfg.totalSteps = cfg.totalSteps || all.length;
      autoCheck();
      var mo = new MutationObserver(autoSchedule);
      mo.observe(document.body, {
        attributes: true,
        attributeFilter: ["class", "style", "hidden"],
        subtree: true,
        childList: true,
      });
    };
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", run);
    else run();
  }

  // ---- lifecycle ---------------------------------------------------------
  function onHide() {
    closeStep();
    flush(true);
  }

  // ---- public API --------------------------------------------------------
  var API = {
    init: function (options) {
      if (cfg) return; // idempotente
      if (isBot()) return; // ignora bots (revisão de anúncio/crawlers da Meta etc.)
      cfg = {
        projectId: options.projectId,
        endpoint: options.endpoint || "/api/collect",
        totalSteps: options.totalSteps || null,
        autoSteps: !!options.autoSteps,
        autoAnswers: !!options.autoAnswers,
        stepSelector:
          options.stepSelector || "[data-step], .step, section[data-step]",
      };
      initIdentity();
      push("session_start", {});

      document.addEventListener("click", onClick, true);
      if (cfg.autoAnswers) {
        // texto livre: captura no change/blur de inputs marcados com data-answer
        document.addEventListener("change", onAutoChange, true);
      }
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") onHide();
      });
      window.addEventListener("pagehide", onHide);
      // flush periódico de segurança
      setInterval(function () { flush(false); }, FLUSH_MS * 3);

      if (cfg.autoSteps) setupAutoSteps();
    },

    step: function (index, name) {
      if (!cfg) return;
      if (curStep && curStep.index === index) return; // mesma etapa
      closeStep();
      openStep(index, name);
    },

    answer: function (question, value, kind) {
      push("answer", {
        step_index: curStep ? curStep.index : null,
        meta: { question: question, value: value, kind: kind || null },
      });
    },

    event: function (type, meta) {
      if (type === "quiz_complete" || type === "checkout_redirect") closeStep();
      push(type, { meta: meta || {} });
      if (type === "checkout_redirect") flush(true);
    },

    // expõe ids (útil pra debug / integrações)
    ids: function () {
      return { visitorId: visitorId, sessionId: sessionId };
    },
  };

  window.HMTrack = API;
})();
