/* Life in the UK Test Practice. Plain JS, no dependencies. Progress lives in localStorage only. */
(function () {
  "use strict";

  const DATA = window.LIUK;
  const Q = DATA.questions;
  const TOPICS = DATA.topics;
  const BY_ID = Object.fromEntries(Q.map((q) => [q.id, q]));
  const MOCK_SIZE = 24;
  const MOCK_SECONDS = 45 * 60;
  const PASS = 0.75;

  // ---------- storage ----------
  const KEY = "liuk:v1";
  const blank = () => ({ missed: [], best: null, mocks: [], topic: {}, testDate: "" });
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      return s ? Object.assign(blank(), s) : blank();
    } catch (e) {
      return blank();
    }
  }
  let S = load();
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
    } catch (e) {
      /* storage unavailable: the app still works for this visit */
    }
  }

  // ---------- helpers ----------
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const shuffle = (a) => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const isMulti = (q) => q.answer.length > 1;
  const fmt = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function makeItem(q) {
    const order = q.options.length === 2 ? [0, 1] : shuffle(q.options.map((_, i) => i));
    return { q, order, sel: [], flagged: false, checked: false };
  }
  function correct(it) {
    const a = it.q.answer;
    return it.sel.length === a.length && it.sel.every((x) => a.includes(x));
  }
  function record(it) {
    const ok = correct(it);
    const t = (S.topic[it.q.topic] = S.topic[it.q.topic] || { seen: [], right: [] });
    if (!t.seen.includes(it.q.id)) t.seen.push(it.q.id);
    if (ok) {
      if (!t.right.includes(it.q.id)) t.right.push(it.q.id);
      S.missed = S.missed.filter((id) => id !== it.q.id);
    } else {
      t.right = t.right.filter((id) => id !== it.q.id);
      if (!S.missed.includes(it.q.id)) S.missed.push(it.q.id);
    }
  }

  // Draw a mock that mirrors the bank's topic mix, so every test covers every topic.
  function drawMock() {
    const groups = {};
    Q.forEach((q) => (groups[q.topic] = groups[q.topic] || []).push(q));
    const keys = Object.keys(groups);
    const alloc = keys.map((k) => ({ k, exact: (groups[k].length / Q.length) * MOCK_SIZE }));
    alloc.forEach((a) => (a.n = Math.max(1, Math.floor(a.exact))));
    let left = MOCK_SIZE - alloc.reduce((s, a) => s + a.n, 0);
    alloc.sort((x, y) => y.exact - y.n - (x.exact - x.n));
    for (let i = 0; left > 0; i = (i + 1) % alloc.length, left--) alloc[i].n++;
    return shuffle(alloc.flatMap((a) => shuffle(groups[a.k]).slice(0, a.n)));
  }

  // ---------- quiz runner ----------
  // mode "mock": no feedback, timer, question map. mode "practice": check each answer.
  let active = null;
  function run(host, intro, questions, mode, onDone) {
    if (active) active.stop();
    const items = questions.map(makeItem);
    let i = 0;
    let left = MOCK_SECONDS;
    let timer = null;
    let confirming = false;
    intro.hidden = true;
    host.hidden = false;

    if (mode === "mock") {
      timer = setInterval(() => {
        left--;
        const el = $(".timer", host);
        if (el) {
          el.textContent = fmt(left);
          el.classList.toggle("low", left <= 300);
        }
        if (left === 300) toast("5 minutes left");
        if (left <= 0) finish();
      }, 1000);
    }

    function render(focusQ) {
      const it = items[i];
      const q = it.q;
      const done = mode === "practice" && it.checked;
      const last = i === items.length - 1;
      const need = q.answer.length;
      const answered = items.filter((x) => x.sel.length).length;
      host.className = "runner" + (mode === "mock" ? " with-map" : "");
      host.innerHTML =
        `<div class="qcol">` +
        `<div class="qhead"><span>Question ${i + 1} of ${items.length}</span>` +
        (mode === "mock" ? `<span class="timer${left <= 300 ? " low" : ""}" aria-label="Time left">${fmt(left)}</span>` : `<button type="button" class="link-btn" data-act="quit">End practice</button>`) +
        `</div><div class="track"><i style="width:${((mode === "mock" ? answered : i) / items.length) * 100}%"></i></div>` +
        `<p class="qtopic">${esc(TOPICS[q.topic])}</p>` +
        `<h3 class="qtext" tabindex="-1">${esc(q.question)}</h3>` +
        (isMulti(q) ? `<span class="qhint">Select two answers</span>` : "") +
        `<div class="opts" role="group" aria-label="Answer options">` +
        it.order
          .map((oi, n) => {
            let cls = it.sel.includes(oi) ? " sel" : "";
            if (done) cls = q.answer.includes(oi) ? " right" : it.sel.includes(oi) ? " wrong" : "";
            return `<button type="button" class="opt${cls}" data-oi="${oi}" aria-pressed="${it.sel.includes(oi)}"${done ? " disabled" : ""}><span class="key">${n + 1}</span><span>${esc(q.options[oi])}</span></button>`;
          })
          .join("") +
        `</div>` +
        (done
          ? `<div class="feedback ${correct(it) ? "ok" : "no"}" role="status"><b>${correct(it) ? "Correct" : "Not quite"}</b>${esc(q.explanation)}</div>`
          : "") +
        `<div class="qnav">` +
        (mode === "mock"
          ? `<button type="button" class="btn btn-ghost" data-act="prev"${i === 0 ? " disabled" : ""}>Back</button>` +
            `<button type="button" class="btn btn-ghost flagbtn" data-act="flag" aria-pressed="${it.flagged}">${it.flagged ? "Flagged" : "Flag"}</button>` +
            `<span class="grow"></span>` +
            `<button type="button" class="btn btn-primary" data-act="next">${last ? "Finish test" : "Next"}</button>`
          : `<span class="grow"></span>` +
            (done
              ? `<button type="button" class="btn btn-primary" data-act="next">${last ? "See results" : "Next question"}</button>`
              : `<button type="button" class="btn btn-primary" data-act="check"${it.sel.length !== need ? " disabled" : ""}>Check answer</button>`)) +
        `</div>` +
        (confirming
          ? `<div class="confirm" role="alert"><span>${items.length - answered} question${items.length - answered === 1 ? "" : "s"} unanswered. Finish anyway?</span><button type="button" class="btn btn-primary" data-act="finish">Finish</button><button type="button" class="btn btn-ghost" data-act="cancel">Keep going</button></div>`
          : "") +
        `</div>` +
        (mode === "mock"
          ? `<aside class="map" aria-label="Question map"><h4>Questions</h4><div class="map-grid">` +
            items
              .map(
                (x, n) =>
                  `<button type="button" data-go="${n}" class="${x.flagged ? "flag" : x.sel.length ? "done" : ""}${n === i ? " cur" : ""}" aria-label="Question ${n + 1}${x.flagged ? ", flagged" : x.sel.length ? ", answered" : ""}">${n + 1}</button>`
              )
              .join("") +
            `</div><div class="legend"><span class="l-done">Answered</span><span class="l-flag">Flagged</span></div></aside>`
          : "");
      if (focusQ) $(".qtext", host).focus({ preventScroll: true });
    }

    function choose(oi) {
      const it = items[i];
      if (mode === "practice" && it.checked) return;
      const need = it.q.answer.length;
      if (need > 1) {
        if (it.sel.includes(oi)) it.sel = it.sel.filter((x) => x !== oi);
        else if (it.sel.length < need) it.sel.push(oi);
        else it.sel = [it.sel[1], oi];
      } else it.sel = [oi];
      confirming = false;
      render();
    }
    function go(n) {
      i = Math.max(0, Math.min(items.length - 1, n));
      confirming = false;
      render(true);
      host.scrollIntoView({ block: "start", behavior: "smooth" });
    }
    function act(a) {
      const it = items[i];
      if (a === "check") {
        if (it.sel.length !== it.q.answer.length) return;
        it.checked = true;
        record(it);
        save();
        refresh();
        render();
      } else if (a === "next") {
        if (i < items.length - 1) go(i + 1);
        else if (mode === "mock" && items.some((x) => !x.sel.length)) {
          confirming = true;
          render();
        } else finish();
      } else if (a === "prev") go(i - 1);
      else if (a === "flag") {
        it.flagged = !it.flagged;
        render();
      } else if (a === "finish") finish();
      else if (a === "cancel") {
        confirming = false;
        const firstGap = items.findIndex((x) => !x.sel.length);
        go(firstGap >= 0 ? firstGap : i);
      } else if (a === "quit") finish(true);
    }

    function onClick(e) {
      const b = e.target.closest("button");
      if (!b || !host.contains(b)) return;
      if (b.dataset.oi !== undefined) choose(+b.dataset.oi);
      else if (b.dataset.go !== undefined) go(+b.dataset.go);
      else if (b.dataset.act) act(b.dataset.act);
    }
    function onKey(e) {
      if (host.hidden || e.altKey || e.ctrlKey || e.metaKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      const it = items[i];
      if (e.key >= "1" && e.key <= String(it.order.length)) {
        e.preventDefault();
        choose(it.order[+e.key - 1]);
      } else if (e.key === "Enter" && !(document.activeElement && document.activeElement.closest(".runner button"))) {
        e.preventDefault();
        const primary = $(".qnav .btn-primary:not([disabled])", host);
        if (primary) act(primary.dataset.act);
      }
    }
    host.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);

    function stop() {
      clearInterval(timer);
      host.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      active = null;
    }
    function finish(quit) {
      stop();
      let scored = items;
      if (mode === "mock") {
        items.forEach(record);
      } else {
        scored = items.filter((x) => x.checked);
        if (quit && !scored.length) {
          host.hidden = true;
          intro.hidden = false;
          return;
        }
      }
      save();
      refresh();
      onDone(scored);
    }
    active = { stop };
    render();
    host.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function showResult(host, intro, items, mode, againLabel, again) {
    const n = items.length;
    const score = items.filter(correct).length;
    const need = Math.ceil(n * PASS);
    const pct = n ? Math.round((score / n) * 100) : 0;
    const pass = score >= need;
    const wrong = items.filter((x) => !correct(x));
    const byT = {};
    items.forEach((x) => {
      const t = (byT[x.q.topic] = byT[x.q.topic] || [0, 0]);
      t[1]++;
      if (correct(x)) t[0]++;
    });
    host.className = "runner";
    host.innerHTML =
      `<div class="result">` +
      `<div class="result-top"><div class="ring" style="--p:${pct};--ring:var(${pass ? "--good" : "--bad"})"><span>${score}/${n}</span></div>` +
      `<div><p class="verdict ${pass ? "pass" : "fail"}">${mode === "mock" ? (pass ? "Pass" : "Not a pass yet") : pct + "% correct"}</p>` +
      `<p class="result-sub">${mode === "mock" ? `${need} of ${n} needed to pass. ${pass && score < 21 ? "Close to the line: aim for 21 or more." : pass ? "Strong result." : "Review the answers below, then try another mock."}` : `${n} question${n === 1 ? "" : "s"} answered.`}</p></div></div>` +
      (mode === "mock"
        ? `<div class="bytopic">${Object.keys(TOPICS)
            .filter((k) => byT[k])
            .map((k) => `<div><span>${esc(TOPICS[k])}</span><b class="num">${byT[k][0]}/${byT[k][1]}</b></div>`)
            .join("")}</div>`
        : "") +
      `<div class="qnav"><button type="button" class="btn btn-primary" data-act="again">${esc(againLabel)}</button>` +
      (wrong.length ? `<button type="button" class="btn btn-ghost" data-act="missed">Practise missed questions</button>` : "") +
      `</div>` +
      (wrong.length
        ? `<div class="review"><h4>${wrong.length} to review</h4>` +
          wrong
            .map((x) => {
              const a = x.q.answer.map((o) => esc(x.q.options[o])).join(" and ");
              const y = x.sel.length ? x.sel.map((o) => esc(x.q.options[o])).join(" and ") : "No answer";
              return `<div class="rv"><div>${esc(x.q.question)}</div><div class="a">${a}</div><div class="y">You chose: ${y}</div><div class="e">${esc(x.q.explanation)}</div></div>`;
            })
            .join("") +
          `</div>`
        : "") +
      `</div>`;
    host.onclick = (e) => {
      const b = e.target.closest("button[data-act]");
      if (!b) return;
      host.onclick = null;
      if (b.dataset.act === "again") again();
      else {
        host.hidden = true;
        intro.hidden = false;
        selectMode("missed");
        $("#practise").scrollIntoView({ block: "start" });
      }
    };
    host.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  // ---------- modes ----------
  function selectMode(m) {
    ["mock", "topics", "missed"].forEach((k) => {
      $("#mode-" + k).setAttribute("aria-selected", String(k === m));
      $("#panel-" + k).hidden = k !== m;
    });
    if (m === "missed") renderMissed();
  }
  document.querySelectorAll(".mode").forEach((b) => b.addEventListener("click", () => selectMode(b.id.slice(5))));
  document.querySelectorAll("[data-start]").forEach((a) =>
    a.addEventListener("click", () => selectMode(a.dataset.start))
  );

  function startMock() {
    const host = $("#mockRun");
    const intro = $("#mockIntro");
    host.onclick = null;
    run(host, intro, drawMock(), "mock", (items) => {
      const score = items.filter(correct).length;
      S.mocks.push({ d: new Date().toISOString().slice(0, 10), s: score });
      if (S.best === null || score > S.best) S.best = score;
      save();
      refresh();
      showResult(host, intro, items, "mock", "Take another mock", startMock);
    });
  }
  $("#startMock").addEventListener("click", startMock);

  function startTopic(k) {
    const host = $("#topicRun");
    const intro = $("#topicIntro");
    host.onclick = null;
    const qs = shuffle(Q.filter((q) => q.topic === k));
    run(host, intro, qs, "practice", (items) =>
      showResult(host, intro, items, "practice", "Back to topics", () => {
        host.hidden = true;
        intro.hidden = false;
        renderTopics();
      })
    );
  }
  function renderTopics() {
    $("#topicGrid").innerHTML = Object.keys(TOPICS)
      .map((k) => {
        const total = Q.filter((q) => q.topic === k).length;
        const right = (S.topic[k] && S.topic[k].right.length) || 0;
        return `<button type="button" class="topic" data-topic="${k}"><b>${esc(TOPICS[k])}</b><small>${right} of ${total} correct</small><span class="meter"><i style="width:${(right / total) * 100}%"></i></span></button>`;
      })
      .join("");
  }
  $("#topicGrid").addEventListener("click", (e) => {
    const b = e.target.closest("[data-topic]");
    if (b) startTopic(b.dataset.topic);
  });

  function renderMissed() {
    const intro = $("#missedIntro");
    const host = $("#missedRun");
    if (!host.hidden) return;
    const n = S.missed.length;
    intro.hidden = false;
    intro.innerHTML = n
      ? `<h3>Questions to fix</h3><p>You have ${n} question${n === 1 ? "" : "s"} to fix. Each one leaves this list when you answer it correctly.</p><button type="button" class="btn btn-primary" id="drill">Practise ${n} missed question${n === 1 ? "" : "s"}</button>`
      : `<h3>Nothing to fix yet</h3><p>Wrong answers from mock tests and topic practice collect here, so you can drill your weak spots until they stick.</p><button type="button" class="btn btn-ghost" id="toMock">Take a mock test</button>`;
    const drill = $("#drill");
    if (drill)
      drill.addEventListener("click", () => {
        host.onclick = null;
        const qs = shuffle(S.missed.map((id) => BY_ID[id]).filter(Boolean));
        run(host, intro, qs, "practice", (items) =>
          showResult(host, intro, items, "practice", "Back to missed list", () => {
            host.hidden = true;
            renderMissed();
          })
        );
      });
    const toMock = $("#toMock");
    if (toMock) toMock.addEventListener("click", () => selectMode("mock"));
  }

  // ---------- progress ----------
  function daysUntil(iso) {
    if (!iso) return null;
    const t = new Date(iso + "T00:00:00");
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.round((t - now) / 864e5);
  }
  const STEPS = [
    "Early history to 1714: topic practice until 90% or more",
    "History 1714 to today: topic practice",
    "Modern society: festivals, sport, arts, landmarks",
    "Government and law, plus values and principles",
    "First mock test, then clear the missed list",
    "Two mock tests, then the missed list again",
    "Key facts twice and one final mock. Then rest.",
  ];
  function renderPlan() {
    const d = daysUntil(S.testDate);
    const ol = $("#plan");
    if (d === null || d < 0) {
      ol.innerHTML = `<li class="empty-row"><span class="empty">${d !== null && d < 0 ? "That date has passed. Add your next test date to build a plan." : "Add your test date above and a day-by-day plan appears here. Without a date, work through the topics in order, then take mocks until you score 21 or more."}</span></li>`;
      return;
    }
    if (d === 0) {
      ol.innerHTML = `<li class="today"><b>Today</b><span>Test day. Skim the key facts, bring your ID and arrive early.</span></li>`;
      return;
    }
    // Spread the steps across the days available; with fewer days, merge steps.
    const days = Math.min(d, 21);
    const rows = [];
    for (let n = 0; n < days; n++) {
      const a = Math.floor((n * STEPS.length) / days);
      const b = Math.max(a + 1, Math.floor(((n + 1) * STEPS.length) / days));
      const label = days > STEPS.length && n > 0 && a === Math.floor(((n - 1) * STEPS.length) / days) ? "Repeat: " + STEPS[a].split(":")[0] : STEPS.slice(a, b).join(". ");
      const date = new Date();
      date.setDate(date.getDate() + n);
      rows.push(`<li${n === 0 ? ' class="today"' : ""}><b>${n === 0 ? "Today" : date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</b><span>${esc(label)}</span></li>`);
    }
    const td = new Date(S.testDate + "T00:00:00");
    rows.push(`<li><b>${td.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</b><span>Test day. Skim the key facts, bring your ID and arrive early.</span></li>`);
    ol.innerHTML = rows.join("");
  }
  function refresh() {
    const n = S.missed.length;
    $("#missedPill").textContent = n;
    $("#missedCount").textContent = n;
    $("#bestScore").textContent = S.best === null ? "None yet" : S.best + "/24";
    $("#mockCount").textContent = S.mocks.length
      ? `${S.mocks.length} mock${S.mocks.length === 1 ? "" : "s"} taken. Last: ${S.mocks[S.mocks.length - 1].s}/24.`
      : "Take a mock test to see your score.";
    const d = daysUntil(S.testDate);
    $("#countdown").textContent =
      d === null ? "Add your date to get a study plan." : d > 1 ? `${d} days to go.` : d === 1 ? "Your test is tomorrow." : d === 0 ? "Test day. Good luck." : "That date has passed.";
    $("#topicBars").innerHTML = Object.keys(TOPICS)
      .map((k) => {
        const t = S.topic[k];
        const seen = t ? t.seen.length : 0;
        const right = t ? t.right.length : 0;
        const pct = seen ? Math.round((right / seen) * 100) : 0;
        return `<div class="barrow"><span>${esc(TOPICS[k])}</span><span>${seen ? pct + "% of " + seen + " answered" : "Not started"}</span><span class="meter"><i style="width:${pct}%"></i></span></div>`;
      })
      .join("");
    renderTopics();
    renderPlan();
  }
  const dateInput = $("#testDate");
  dateInput.value = S.testDate;
  dateInput.addEventListener("change", () => {
    S.testDate = dateInput.value;
    save();
    refresh();
    if (S.testDate) toast("Study plan updated");
  });
  $("#resetAll").addEventListener("click", () => ($("#resetConfirm").hidden = false));
  $("#resetNo").addEventListener("click", () => ($("#resetConfirm").hidden = true));
  $("#resetYes").addEventListener("click", () => {
    S = blank();
    save();
    dateInput.value = "";
    $("#resetConfirm").hidden = true;
    refresh();
    renderMissed();
    toast("Progress reset");
  });

  // ---------- key facts ----------
  const FACTS = [
    {
      h: "Dates to know",
      wide: true,
      rows: [
        ["55 BC", "Julius Caesar's failed invasion"],
        ["AD 43", "Roman invasion under Emperor Claudius"],
        ["AD 410", "Romans leave Britain"],
        ["1066", "Battle of Hastings, Norman Conquest"],
        ["1215", "Magna Carta"],
        ["1314", "Bannockburn: Scotland stays independent"],
        ["1348", "Black Death"],
        ["1415", "Agincourt, Henry V"],
        ["1485", "Bosworth Field: the Tudors begin"],
        ["1588", "Spanish Armada defeated"],
        ["1603", "James VI of Scotland becomes James I of England"],
        ["1605", "Gunpowder Plot"],
        ["1642", "Civil War begins"],
        ["1649", "Charles I executed"],
        ["1660", "Restoration of Charles II"],
        ["1665 / 1666", "Great Plague / Great Fire of London"],
        ["1679", "Habeas Corpus Act"],
        ["1688 / 1689", "Glorious Revolution / Bill of Rights"],
        ["1707", "Act of Union creates Great Britain"],
        ["1721", "Walpole, first Prime Minister"],
        ["1746", "Culloden"],
        ["1805", "Trafalgar, Nelson"],
        ["1807", "Slave trade abolished"],
        ["1815", "Waterloo, Wellington"],
        ["1833", "Slavery abolished in the Empire"],
        ["1837 to 1901", "Queen Victoria"],
        ["1851", "Great Exhibition, Crystal Palace"],
        ["1853 to 1856", "Crimean War"],
        ["1914 to 1918", "First World War"],
        ["1918", "Women over 30 get the vote"],
        ["1928", "Women vote at 21, the same as men"],
        ["1939 to 1945", "Second World War"],
        ["6 June 1944", "D-Day"],
        ["1948", "NHS founded"],
        ["1969", "Voting age lowered to 18"],
        ["1979", "Margaret Thatcher, first woman PM"],
        ["1998", "Good Friday Agreement"],
        ["1999", "Scottish Parliament and Welsh Assembly open"],
      ],
    },
    {
      h: "Saints' days and festivals",
      rows: [
        ["1 March", "St David (Wales)"],
        ["17 March", "St Patrick (Northern Ireland)"],
        ["23 April", "St George (England)"],
        ["30 November", "St Andrew (Scotland)"],
        ["25 January", "Burns Night"],
        ["14 February", "Valentine's Day"],
        ["1 April", "April Fool's Day, jokes until midday"],
        ["5 November", "Bonfire Night, the Gunpowder Plot"],
        ["11 November", "Remembrance Day, silence at 11am"],
        ["26 December", "Boxing Day"],
        ["31 December", "Hogmanay (Scotland)"],
      ],
    },
    {
      h: "Numbers",
      rows: [
        ["24 / 45 / 18", "Questions / minutes / correct to pass"],
        ["650", "MPs and constituencies"],
        ["5 years", "Most time allowed between general elections"],
        ["7am to 10pm", "Polling station hours"],
        ["12 / 15", "Jury size: England, Wales, NI / Scotland"],
        ["10 to 17", "Youth Court ages"],
        ["17", "Minimum age to drive a car"],
        ["3 years", "Age at which a car needs an annual MOT"],
      ],
    },
    {
      h: "Inventors and discoveries",
      rows: [
        ["Television", "John Logie Baird"],
        ["Radar", "Robert Watson-Watt"],
        ["Jet engine", "Frank Whittle"],
        ["Hovercraft", "Christopher Cockerell"],
        ["Penicillin", "Alexander Fleming"],
        ["World Wide Web", "Tim Berners-Lee"],
        ["Cash machine and PIN", "James Goodfellow"],
        ["MRI scanner", "Peter Mansfield"],
        ["Turing machine", "Alan Turing"],
        ["Cloned sheep", "Dolly, Roslin Institute, 1996"],
      ],
    },
    {
      h: "Capitals and national symbols",
      rows: [
        ["England", "London. Rose. Patron saint St George"],
        ["Scotland", "Edinburgh. Thistle. Patron saint St Andrew"],
        ["Wales", "Cardiff. Daffodil. Patron saint St David"],
        ["N. Ireland", "Belfast. Shamrock. Patron saint St Patrick"],
      ],
    },
  ];
  const table = (rows) => `<table>${rows.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join("")}</table>`;
  $("#factsGrid").innerHTML = FACTS.map((f) => {
    const half = Math.ceil(f.rows.length / 2);
    const body = f.wide
      ? `<div class="timeline"><div class="tbl">${table(f.rows.slice(0, half))}</div><div class="tbl">${table(f.rows.slice(half))}</div></div>`
      : `<div class="tbl">${table(f.rows)}</div>`;
    return `<div class="card${f.wide ? " wide" : ""}"><h3>${esc(f.h)}</h3>${body}</div>`;
  }).join("");

  refresh();
  renderMissed();
})();
