/* ── Oh My Train — documenting the 07:43 that never was ─────────────── */

(() => {
  "use strict";

  const STORAGE_KEY = "oh-my-train:v1";

  const STATUS = {
    ontime:    { label: "On time",   icon: "●", cls: "mark-good" },
    delayed:   { label: "Delayed",   icon: "▲", cls: "mark-warn" },
    cancelled: { label: "Cancelled", icon: "✕", cls: "mark-crit" },
  };

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const TAGLINES = [
    "We apologise for the inconvenience this website may cause.",
    "The on-time train is delayed by approximately forever.",
    "Rail replacement bus service for your expectations.",
    "This service will call at: Disappointment, Despair and Didcot Parkway.",
    "We are sorry to announce that we are sorry to announce.",
    "Your patience is important to us. So we take as much of it as possible.",
    "Due to a signalling failure, optimism is running late.",
    "Please mind the gap between the timetable and reality.",
    "Leaves on the line. In February. Somehow.",
    "The next train to arrive on time is a museum piece.",
    "Delay repay: the only thing that arrives promptly.",
    "This is a scheduled apology. The unscheduled ones cost extra.",
  ];

  const MAX_PIPS = 6;

  /* ── state ── */

  const now = new Date();
  let view = { y: now.getFullYear(), m: now.getMonth() };
  let selectedKey = null;
  let data = load();
  let taglineIdx = now.getDate() % TAGLINES.length;

  /* ── storage ── */

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return isValidData(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      alert("Could not save — localStorage is unavailable. Fittingly, the service has failed.");
    }
  }

  function isValidData(obj) {
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return false;
    return Object.entries(obj).every(([k, v]) =>
      /^\d{4}-\d{2}-\d{2}$/.test(k) &&
      Array.isArray(v) &&
      v.every((j) => j && typeof j === "object" && j.status in STATUS)
    );
  }

  /* ── helpers ── */

  const $ = (id) => document.getElementById(id);

  function dateKey(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function journeyTitle(j) {
    let t = STATUS[j.status].label;
    if (j.status === "delayed" && j.mins) t += ` ${j.mins} min`;
    if (j.label) t += ` — ${j.label}`;
    return t;
  }

  function prettyDate(key) {
    const [y, m, d] = key.split("-").map(Number);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  }

  /* ── calendar ── */

  function renderCalendar() {
    $("cal-title").textContent = `${MONTHS[view.m]} ${view.y}`;

    const grid = $("cal-grid");
    grid.innerHTML = "";

    const firstOffset = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const todayKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
    const cells = Math.ceil((firstOffset + daysInMonth) / 7) * 7;

    for (let i = 0; i < cells; i++) {
      const d = i - firstOffset + 1;

      if (d < 1 || d > daysInMonth) {
        const blank = document.createElement("div");
        blank.className = "day empty";
        grid.appendChild(blank);
        continue;
      }

      const key = dateKey(view.y, view.m, d);
      const journeys = data[key] || [];

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "day" + (key === todayKey ? " today" : "");
      cell.setAttribute(
        "aria-label",
        `${prettyDate(key)}: ${journeys.length ? journeys.map(journeyTitle).join("; ") : "no journeys logged"}`
      );
      cell.addEventListener("click", () => openDay(key));

      const num = document.createElement("span");
      num.className = "day-num";
      num.textContent = d;
      cell.appendChild(num);

      if (journeys.length) {
        const pips = document.createElement("span");
        pips.className = "pips";
        pips.setAttribute("aria-hidden", "true");

        journeys.slice(0, MAX_PIPS).forEach((j) => {
          const pip = document.createElement("span");
          pip.className = `mark ${STATUS[j.status].cls}`;
          pip.textContent = STATUS[j.status].icon;
          pip.title = journeyTitle(j);
          pips.appendChild(pip);
        });

        if (journeys.length > MAX_PIPS) {
          const more = document.createElement("span");
          more.className = "pip-more";
          more.textContent = `+${journeys.length - MAX_PIPS}`;
          pips.appendChild(more);
        }
        cell.appendChild(pips);
      }

      grid.appendChild(cell);
    }
  }

  /* ── stats ── */

  function monthJourneys() {
    const prefix = `${view.y}-${String(view.m + 1).padStart(2, "0")}-`;
    return Object.entries(data)
      .filter(([k]) => k.startsWith(prefix))
      .flatMap(([, v]) => v);
  }

  function verdictLine(total, pct) {
    if (total === 0) return "No journeys logged this month. Statistically, the safest way to travel by train.";
    if (pct === 100) return "Every train on time?! Report this anomaly to the Office of Rail and Road.";
    if (pct >= 90) return "Suspiciously smooth. Enjoy it while it lasts.";
    if (pct >= 75) return "Mostly on time. “Mostly.”";
    if (pct >= 50) return "A coin flip with luggage.";
    if (pct >= 25) return "The timetable is more of a mood board.";
    if (pct > 0) return "At this point the departure board is just performance art.";
    return "A flawless record: not a single train on time. Iconic.";
  }

  function renderStats() {
    const journeys = monthJourneys();
    const total = journeys.length;
    const counts = { ontime: 0, delayed: 0, cancelled: 0 };
    let minsLost = 0;

    journeys.forEach((j) => {
      counts[j.status]++;
      if (j.status === "delayed" && j.mins) minsLost += j.mins;
    });

    const pct = total ? Math.round((counts.ontime / total) * 100) : null;

    $("stat-total").textContent = total;
    $("stat-ontime").textContent = pct === null ? "–" : `${pct}%`;
    $("stat-ontime-sub").textContent = total ? `${counts.ontime} of ${total} journeys` : "of journeys";
    $("stat-delayed").textContent = counts.delayed;
    $("stat-delayed-sub").textContent = `min of your life: ${minsLost}`;
    $("stat-cancelled").textContent = counts.cancelled;
    $("stat-cancelled-sub").textContent = counts.cancelled === 1 ? "ghost train" : "ghost trains";

    const track = $("meter-track");
    track.innerHTML = "";
    if (total) {
      [
        ["seg-good", counts.ontime, "On time"],
        ["seg-warn", counts.delayed, "Delayed"],
        ["seg-crit", counts.cancelled, "Cancelled"],
      ].forEach(([cls, n, label]) => {
        if (!n) return;
        const seg = document.createElement("div");
        seg.className = `meter-seg ${cls}`;
        seg.style.flexGrow = n;
        seg.style.flexBasis = 0;
        seg.title = `${label}: ${n} (${Math.round((n / total) * 100)}%)`;
        track.appendChild(seg);
      });
    }
    $("meter").setAttribute(
      "aria-label",
      total
        ? `Share of journeys: ${counts.ontime} on time, ${counts.delayed} delayed, ${counts.cancelled} cancelled`
        : "No journeys logged this month"
    );

    $("verdict").textContent = verdictLine(total, pct ?? 0);
  }

  /* ── day modal ── */

  function openDay(key) {
    selectedKey = key;
    $("modal-title").textContent = prettyDate(key);
    renderJourneyList();
    $("overlay").hidden = false;
    $("journey-label").focus();
  }

  function closeModal() {
    $("overlay").hidden = true;
    selectedKey = null;
    $("add-form").reset();
    syncMinsField();
  }

  function renderJourneyList() {
    const list = $("journey-list");
    list.innerHTML = "";
    const journeys = data[selectedKey] || [];

    if (!journeys.length) {
      const li = document.createElement("li");
      li.className = "journey-empty";
      li.textContent = "Nothing logged yet. A clean slate — how unlike the railway.";
      list.appendChild(li);
      return;
    }

    journeys.forEach((j, i) => {
      const li = document.createElement("li");
      li.className = "journey-item";

      const status = document.createElement("span");
      status.className = "journey-status";
      status.innerHTML = `<span class="mark ${STATUS[j.status].cls}" aria-hidden="true">${STATUS[j.status].icon}</span> ${STATUS[j.status].label}${j.status === "delayed" && j.mins ? ` · ${j.mins} min` : ""}`;

      const desc = document.createElement("span");
      desc.className = "journey-desc";
      desc.textContent = j.label || "";

      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn-del";
      del.textContent = "✕";
      del.setAttribute("aria-label", `Delete: ${journeyTitle(j)}`);
      del.addEventListener("click", () => {
        journeys.splice(i, 1);
        if (!journeys.length) delete data[selectedKey];
        save();
        renderJourneyList();
        renderCalendar();
        renderStats();
      });

      li.append(status, desc, del);
      list.appendChild(li);
    });
  }

  function syncMinsField() {
    const status = document.querySelector('input[name="status"]:checked').value;
    $("mins-field").hidden = status !== "delayed";
  }

  /* ── data tools ── */

  function exportData() {
    const stamp = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `oh-my-train-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!isValidData(parsed)) throw new Error("bad shape");
        if (!confirm("Replace all current data with the imported file? This cannot be undone (much like boarding the wrong train).")) return;
        data = parsed;
        save();
        renderCalendar();
        renderStats();
      } catch {
        alert("That file could not be read. It has been cancelled. We apologise for the inconvenience.");
      }
    };
    reader.readAsText(file);
  }

  /* ── wiring ── */

  $("prev-month").addEventListener("click", () => {
    view.m--;
    if (view.m < 0) { view.m = 11; view.y--; }
    renderCalendar();
    renderStats();
  });

  $("next-month").addEventListener("click", () => {
    view.m++;
    if (view.m > 11) { view.m = 0; view.y++; }
    renderCalendar();
    renderStats();
  });

  $("today-btn").addEventListener("click", () => {
    view = { y: now.getFullYear(), m: now.getMonth() };
    renderCalendar();
    renderStats();
  });

  $("modal-close").addEventListener("click", closeModal);

  $("overlay").addEventListener("click", (e) => {
    if (e.target === $("overlay")) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("overlay").hidden) closeModal();
  });

  document.querySelectorAll('input[name="status"]').forEach((r) =>
    r.addEventListener("change", syncMinsField)
  );

  $("add-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!selectedKey) return;

    const status = document.querySelector('input[name="status"]:checked').value;
    const label = $("journey-label").value.trim();
    const mins = parseInt($("journey-mins").value, 10);

    const journey = { status };
    if (label) journey.label = label;
    if (status === "delayed" && mins > 0) journey.mins = mins;

    (data[selectedKey] ??= []).push(journey);
    save();

    $("add-form").reset();
    syncMinsField();
    renderJourneyList();
    renderCalendar();
    renderStats();
    $("journey-label").focus();
  });

  $("export-btn").addEventListener("click", exportData);
  $("import-btn").addEventListener("click", () => $("import-file").click());
  $("import-file").addEventListener("change", (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = "";
  });

  const tagline = $("tagline");
  tagline.textContent = TAGLINES[taglineIdx];
  tagline.addEventListener("click", () => {
    taglineIdx = (taglineIdx + 1) % TAGLINES.length;
    tagline.textContent = TAGLINES[taglineIdx];
  });

  /* ── go ── */

  syncMinsField();
  renderCalendar();
  renderStats();
})();
