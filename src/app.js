const demoRepository = window.HuiheDemoRepository;

const state = demoRepository.loadDemoState();
let activePage = location.hash.replace(/^#\/?/, "") || "home";
let toastTimer;
let pendingImport = null;
let trendFilters = { hero: "all", map: "all" };

const navItems = [
  { id: "home", label: "今日训练", icon: "⌂", section: "训练空间" },
  { id: "matches", label: "对局记录", icon: "▤" },
  { id: "training", label: "训练计划", icon: "◉" },
  { id: "trends", label: "我的趋势", icon: "⌁", section: "个人进度" },
];

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const resultLabel = (result) => ({ win: "胜利", loss: "失败", draw: "平局" })[result] || "未记录";
const resultClass = (result) => ({ win: "win", loss: "loss", draw: "draw" })[result] || "draw";
const resultMark = (result) => ({ win: "W", loss: "L", draw: "D" })[result] || "·";
const isReviewed = (match) => Boolean(match.review?.summary?.trim() && match.review?.nextAction?.trim());
const matchStats = (match) => ({ eliminations: "", assists: "", deaths: match.deaths ?? "", damage: "", healing: "", mitigation: "", ...(match.stats || {}) });
const isHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch { return false; }
};
const todayLabel = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
const dateLabel = (date) => date ? new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(`${date}T00:00:00`)) : "—";
const durationLabel = (seconds) => seconds ? `${Math.floor(Number(seconds) / 60)}:${String(Number(seconds) % 60).padStart(2, "0")}` : "—";

function persist(message = "已保存在这台设备") {
  const ok = demoRepository.saveDemoState(state);
  showToast(ok ? message : "保存失败，请检查浏览器存储空间");
  return ok;
}

function showToast(message) {
  const root = document.querySelector("#toast-root");
  if (!root) return;
  root.innerHTML = `<div class="toast"><span class="toast-check">✓</span>${escapeHtml(message)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { root.innerHTML = ""; }, 2600);
}

function getStats(matches = state.matches) {
  const wins = matches.filter((match) => match.result === "win").length;
  const decisive = matches.filter((match) => match.result !== "draw").length;
  const reviewed = matches.filter(isReviewed).length;
  const checks = Object.values(state.goal.checks || {});
  const assessed = checks.filter((check) => check === "done" || check === "missed");
  const done = assessed.filter((check) => check === "done").length;
  const ratedMatches = matches.filter((match) => matchStats(match).deaths !== "" && Number.isFinite(Number(matchStats(match).deaths)) && Number.isFinite(Number(match.duration)) && Number(match.duration) > 0);
  const totalDeaths = ratedMatches.reduce((sum, match) => sum + Number(matchStats(match).deaths), 0);
  const totalDuration = ratedMatches.reduce((sum, match) => sum + Number(match.duration), 0);
  return {
    games: matches.length, wins,
    winRate: decisive ? Math.round((wins / decisive) * 100) : 0,
    reviewed, reviewRate: matches.length ? Math.round((reviewed / matches.length) * 100) : 0,
    goalRate: assessed.length ? Math.round((done / assessed.length) * 100) : 0,
    deaths10: totalDuration ? (totalDeaths / totalDuration * 600).toFixed(1) : "—",
    ratedCount: ratedMatches.length,
  };
}

function navMarkup() {
  let previousSection = "";
  return navItems.map((item) => {
    const section = item.section && item.section !== previousSection ? `<div class="nav-section">${escapeHtml(item.section)}</div>` : "";
    if (item.section) previousSection = item.section;
    return `${section}<a href="#${item.id}" class="nav-link ${activePage === item.id ? "active" : ""}" data-nav="${item.id}"><span class="nav-icon">${item.icon}</span><span>${item.label}</span>${item.id === "matches" ? `<span class="nav-count">${state.matches.length}</span>` : ""}</a>`;
  }).join("");
}

function appShell(content, title) {
  document.querySelector("#app").innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <a href="#home" class="brand" aria-label="回合首页"><span class="brand-mark"><span></span><span></span><span></span></span><span class="brand-name">回合<span class="brand-dot">.</span><small>OW2 REVIEW SPACE</small></span></a>
        <div class="demo-pill"><span class="pulse-dot"></span>演示模式 <span>本机数据</span></div>
        <nav class="side-nav">${navMarkup()}</nav>
        <div class="sidebar-bottom">
          <div class="coach-card"><div class="coach-eyebrow">本周的一个小目标</div><div class="coach-title">${escapeHtml(state.goal.title)}</div><a href="#training" data-nav="training">查看训练计划 <span>↗</span></a><div class="coach-progress"><span style="width:${getStats().goalRate}%"></span></div></div>
          <a href="#settings" class="nav-link ${activePage === "settings" ? "active" : ""}" data-nav="settings"><span class="nav-icon">⚙</span><span>设置与数据</span></a>
          <div class="profile-row"><div class="avatar">回</div><div class="profile-copy"><strong>${escapeHtml(state.profile.nickname)}</strong><span>${escapeHtml(state.profile.role)} · 训练者</span></div><button class="icon-button sign-in-button" title="账号与同步" aria-label="账号与同步">↗</button></div>
        </div>
      </aside>
      <div class="main-column">
        <header class="topbar"><div class="mobile-brand"><span class="brand-mark"><span></span><span></span><span></span></span>回合<span class="brand-dot">.</span></div><div class="breadcrumbs"><span>训练空间</span><i>/</i><strong>${escapeHtml(title)}</strong></div><div class="topbar-right"><div class="sync-state"><span class="sync-icon">⌁</span><span>仅此设备</span></div><button class="button button-primary button-small" data-action="new-match"><span>＋</span>记录一局</button></div></header>
        <main class="page-content">${content}</main>
        <footer class="page-footer"><span>回合 · 每一局，都能成为下一局的经验。</span><span>演示版本 <i>·</i> 数据保存在此浏览器</span></footer>
      </div>
    </div>`;
}

function matchRow(match) {
  const hero = (match.heroes || []).slice(0, 2).join(" / ") || "未填写英雄";
  const reviewed = isReviewed(match);
  const stats = matchStats(match);
  const filledStats = ["eliminations", "assists", "deaths"].some((key) => stats[key] !== "");
  return `<article class="match-row">
    <div class="result-mark ${resultClass(match.result)}">${resultMark(match.result)}</div>
    <div class="match-main"><div class="match-title-line"><strong>${escapeHtml(match.map || "未知地图")}</strong><span class="mode-chip">${escapeHtml(match.mode || "模式未记")}</span></div><div class="match-meta">${escapeHtml(hero)} <i>·</i> ${escapeHtml(match.role || state.profile.role)}${match.side ? ` · ${escapeHtml(match.side)}` : ""} <i>·</i> ${dateLabel(match.date)} ${escapeHtml(match.time || "")}</div>${filledStats ? `<div class="match-statline"><span>K ${escapeHtml(stats.eliminations || "—")}</span><span>A ${escapeHtml(stats.assists || "—")}</span><span>D ${escapeHtml(stats.deaths || "—")}</span>${stats.damage ? `<span>${Number(stats.damage).toLocaleString()} 伤害</span>` : ""}</div>` : ""}</div>
    <div class="match-duration">${durationLabel(match.duration)}${match.rank ? `<small>${escapeHtml(match.rank)}</small>` : ""}</div>
    <div class="match-review ${reviewed ? "complete" : "pending"}"><span>${reviewed ? "✓" : "○"}</span>${reviewed ? "已复盘" : "待复盘"}</div>
    <button class="row-arrow" data-action="open-review" data-id="${escapeHtml(match.id)}" aria-label="打开 ${escapeHtml(match.map || "对局")} 的复盘">↗</button>
  </article>`;
}

function emptyState(icon, title, body, button = "") {
  return `<div class="empty-state"><div class="empty-illustration">${icon}</div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p>${button}</div>`;
}

function pageHome() {
  const stats = getStats();
  const recent = state.matches.slice(0, 4);
  const awaiting = state.matches.filter((match) => !match.review?.summary?.trim()).length;
  return `<div class="page-heading"><div><div class="eyebrow">${todayLabel} <span class="eyebrow-dot">·</span> ${escapeHtml(state.profile.role)}训练空间</div><h1>你好，${escapeHtml(state.profile.nickname)}<span class="wave">。</span></h1><p class="heading-sub">进步不用一次到位，先把下一局打得更清楚。</p></div><button class="button button-primary" data-action="new-match"><span class="button-plus">＋</span>记下刚结束的一局</button></div>
    <section class="focus-banner"><div class="focus-orb"><span>本<br/>周</span></div><div class="focus-copy"><div class="focus-label"><span class="focus-spark">✳</span> 当前训练重点</div><h2>${escapeHtml(state.goal.title)}</h2><p>${escapeHtml(state.goal.criterion)}</p></div><a class="focus-link" href="#training" data-nav="training">训练计划 <span>↗</span></a><div class="banner-lines"></div></section>
    <section class="stat-grid" aria-label="近期训练数据">
      <article class="stat-card"><div class="stat-top"><span>近期对局</span><span class="stat-icon icon-blue">▤</span></div><div class="stat-value">${stats.games}<small> 场</small></div><div class="stat-foot"><span class="stat-neutral"><b>↗</b> ${stats.wins} 胜 ${stats.games - stats.wins} 负</span><span class="stat-period">全部记录</span></div><div class="mini-bars bars-blue"><i style="height:35%"></i><i style="height:55%"></i><i style="height:40%"></i><i style="height:75%"></i><i style="height:48%"></i><i style="height:82%"></i><i style="height:60%"></i><i style="height:100%"></i></div></article>
      <article class="stat-card"><div class="stat-top"><span>胜率</span><span class="stat-icon icon-green">↗</span></div><div class="stat-value">${stats.winRate}<small>%</small></div><div class="stat-foot"><span class="stat-positive"><b>●</b> ${stats.wins} 场胜利</span><span class="stat-period">${stats.games} 场样本</span></div><div class="stat-line"><svg viewBox="0 0 190 36" preserveAspectRatio="none" aria-label="胜率趋势"><path d="M1 29 C20 25 24 28 40 19 S64 24 78 17 S104 22 119 11 S147 19 162 9 S180 10 189 4" /></svg></div></article>
      <article class="stat-card"><div class="stat-top"><span>完成复盘</span><span class="stat-icon icon-orange">✎</span></div><div class="stat-value">${stats.reviewed}<small> / ${stats.games}</small></div><div class="stat-foot"><span class="stat-neutral">${stats.reviewRate}% 的对局留下了总结</span><span class="stat-period">${awaiting ? `${awaiting} 待复盘` : "都复盘啦"}</span></div><div class="stat-progress"><span style="width:${stats.reviewRate}%"></span></div></article>
      <article class="stat-card"><div class="stat-top"><span>每 10 分钟阵亡</span><span class="stat-icon icon-purple">⌁</span></div><div class="stat-value">${stats.deaths10}<small> 次</small></div><div class="stat-foot"><span class="stat-neutral">根据已填写数据计算</span><span class="stat-period">${stats.ratedCount} 场有效</span></div><div class="spark-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></article>
    </section>
    <section class="dashboard-grid"><div class="panel recent-panel"><div class="panel-heading"><div><div class="section-kicker">YOUR RECENT GAMES</div><h2>最近的对局</h2></div><a href="#matches" class="text-link" data-nav="matches">全部对局 <span>→</span></a></div><div class="match-list">${recent.length ? recent.map(matchRow).join("") : emptyState("＋", "这里会记录你的每一局", "结束一场对局后，记下地图、英雄和结果。", `<button class="button button-outline" data-action="new-match">记录第一局</button>`)}</div></div>
      <div class="panel insight-panel"><div class="panel-heading"><div><div class="section-kicker">A LITTLE REFLECTION</div><h2>留给自己的小结</h2></div><span class="insight-mark">✳</span></div>${latestInsight()}</div></section>
    <section class="bottom-strip"><div class="strip-icon">✦</div><div><strong>复盘不用很长，记住一个瞬间就够了。</strong><span>观察发生了什么，再决定下一局要试什么。</span></div><button class="button button-quiet" data-action="new-match">开始记录 <span>→</span></button></section>`;
}

function latestInsight() {
  const match = state.matches.find((item) => item.review?.summary?.trim());
  if (!match) return emptyState("✎", "第一条复盘还没出现", "记下一场对局，再写一个你想带到下一局的动作。", "");
  const event = match.review.events?.[0];
  return `<div class="insight-date"><span class="insight-dot"></span>${dateLabel(match.date)} <i>·</i> ${escapeHtml(match.map)} <i>·</i> ${escapeHtml((match.heroes || []).join(" / "))}</div><blockquote>“${escapeHtml(match.review.summary)}”</blockquote>${event ? `<div class="insight-event"><span class="event-time">${escapeHtml(event.time || "时间点")}</span><span>${escapeHtml(event.action || match.review.nextAction)}</span></div>` : `<div class="next-action"><span>下次试试</span><strong>${escapeHtml(match.review.nextAction || "写下一个下一局动作")}</strong></div>`}<button class="insight-open" data-action="open-review" data-id="${escapeHtml(match.id)}">继续这份复盘 <span>↗</span></button>`;
}

function pageMatches() {
  const matches = state.matches;
  const winCount = matches.filter((match) => match.result === "win").length;
  const heroes = [...new Set(matches.flatMap((match) => match.heroes || []).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const maps = [...new Set(matches.map((match) => match.map).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  return `<div class="page-heading page-heading-compact"><div><div class="eyebrow">MATCH JOURNAL <span class="eyebrow-dot">·</span> 你的私人记录</div><h1>每一局，都值得记下来<span class="wave">。</span></h1><p class="heading-sub">从对局数据到关键时刻，集中整理每一场的训练线索。</p></div><button class="button button-primary" data-action="new-match"><span class="button-plus">＋</span>记录一局</button></div>
    <div class="list-summary"><div><strong>${matches.length}</strong><span>场记录</span></div><div class="summary-divider"></div><div><strong>${winCount}</strong><span>场胜利</span></div><div class="summary-divider"></div><div><strong>${matches.filter((match) => !isReviewed(match)).length}</strong><span>待复盘</span></div><div class="list-summary-spacer"></div><div class="filter-wrap"><span class="filter-search-icon">⌕</span><input id="match-search" type="search" placeholder="搜地图或英雄" aria-label="搜索地图或英雄" /></div><select class="select-filter" id="result-filter" aria-label="按结果筛选"><option value="all">所有结果</option><option value="win">胜利</option><option value="loss">失败</option><option value="draw">平局</option></select><select class="select-filter" id="review-filter" aria-label="按复盘状态筛选"><option value="all">全部复盘状态</option><option value="pending">待复盘</option><option value="complete">已复盘</option></select><select class="select-filter" id="hero-filter" aria-label="按英雄筛选"><option value="all">所有英雄</option>${heroes.map((hero) => `<option value="${escapeHtml(hero)}">${escapeHtml(hero)}</option>`).join("")}</select><select class="select-filter" id="map-filter" aria-label="按地图筛选"><option value="all">所有地图</option>${maps.map((map) => `<option value="${escapeHtml(map)}">${escapeHtml(map)}</option>`).join("")}</select></div>
    <section class="panel matches-page-panel"><div class="table-head"><span>结果</span><span>对局信息</span><span>时长</span><span>复盘进度</span><span></span></div><div class="match-list full-match-list" id="matches-list">${matches.length ? matches.map(matchRow).join("") : emptyState("＋", "还没有对局记录", "记下第一局后，它会出现在这里。", `<button class="button button-primary" data-action="new-match">记录第一局</button>`)}</div><div class="list-end"><span class="list-end-line"></span><span>这就是你自己的成长档案</span><span class="list-end-line"></span></div></section>`;
}

function pageTraining() {
  const checks = Object.values(state.goal.checks || {});
  const done = checks.filter((item) => item === "done").length;
  const assessed = checks.filter((item) => item === "done" || item === "missed").length;
  const percent = assessed ? Math.round(done / assessed * 100) : 0;
  const checkedMatches = state.matches.filter((match) => state.goal.checks[match.id]);
  return `<div class="page-heading page-heading-compact"><div><div class="eyebrow">ONE THING AT A TIME <span class="eyebrow-dot">·</span> 专注比做多更重要</div><h1>本周，把一件事练熟<span class="wave">。</span></h1><p class="heading-sub">小目标要具体到下一场可以试，结束后再诚实记下有没有做到。</p></div></div>
    <div class="training-layout"><section class="goal-feature"><div class="goal-feature-top"><span class="goal-tag"><span>✳</span> 当前目标</span><span class="goal-week">本周训练</span></div><div class="goal-big-icon">◉</div><h2>${escapeHtml(state.goal.title)}</h2><p>${escapeHtml(state.goal.criterion)}</p><div class="goal-feature-progress"><div class="goal-progress-label"><span>当前做到率</span><strong>${percent}<small>%</small></strong></div><div class="goal-progress-track"><span style="width:${percent}%"></span></div><div class="goal-progress-foot"><span>已记录 ${assessed} 场</span><span>${done} 次做到</span></div></div><button class="button button-white" data-action="edit-goal">调整本周目标 <span>↗</span></button><div class="goal-decoration">✳</div></section>
      <section class="panel training-log"><div class="panel-heading"><div><div class="section-kicker">PRACTICE LOG</div><h2>每场对局后的自评</h2></div><span class="log-count">${assessed} / ${state.matches.length}</span></div><p class="panel-description">在对局复盘里标记本场目标有没有做到。</p><div class="goal-match-list">${checkedMatches.length ? checkedMatches.slice(0, 6).map((match) => `<div class="goal-match-row"><div class="goal-match-calendar"><strong>${new Date(`${match.date}T00:00:00`).getDate()}</strong><span>${new Intl.DateTimeFormat("zh-CN", { month: "short" }).format(new Date(`${match.date}T00:00:00`))}</span></div><div class="goal-match-copy"><strong>${escapeHtml(match.map)} <span>${escapeHtml(match.mode)}</span></strong><small>${escapeHtml((match.heroes || []).join(" / "))} · ${resultLabel(match.result)}</small></div><span class="check-badge ${state.goal.checks[match.id]}">${state.goal.checks[match.id] === "done" ? "✓ 做到了" : "↗ 下次试试"}</span></div>`).join("") : emptyState("◉", "记录一次目标执行", "复盘对局时标记是否做到，这里就会慢慢有你的训练轨迹。")}</div><button class="text-link training-cta" data-action="new-match">＋ 记录一场新对局</button></section></div>
      <div class="training-note"><span class="note-star">✳</span><div><strong>好的训练目标，能在一场对局里看见。</strong><p>“打得更好”太宽泛了；“进场前先找好撤退路线”就能在下一波验证。</p></div><span class="note-decoration">FOR YOUR NEXT ROUND</span></div>`;
}

function pageTrends() {
  const heroes = [...new Set(state.matches.flatMap((match) => match.heroes || []).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const maps = [...new Set(state.matches.map((match) => match.map).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  if (!heroes.includes(trendFilters.hero)) trendFilters.hero = "all";
  if (!maps.includes(trendFilters.map)) trendFilters.map = "all";
  const selectedMatches = state.matches.filter((match) => (trendFilters.hero === "all" || match.heroes?.includes(trendFilters.hero)) && (trendFilters.map === "all" || match.map === trendFilters.map));
  const stats = getStats(selectedMatches);
  const maxGames = Math.max(1, ...selectedMatches.map((match) => Number(match.duration) || 0));
  const newest = selectedMatches.slice(0, 10).reverse();
  const wins = selectedMatches.filter((match) => match.result === "win").length;
  const losses = selectedMatches.filter((match) => match.result === "loss").length;
  const draws = selectedMatches.filter((match) => match.result === "draw").length;
  const reviewPending = selectedMatches.length - stats.reviewed;
  const average = (field) => {
    const values = selectedMatches.map((match) => Number(matchStats(match)[field])).filter((value) => Number.isFinite(value) && value >= 0);
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length).toLocaleString("zh-CN") : "—";
  };
  return `<div class="page-heading page-heading-compact"><div><div class="eyebrow">YOUR OWN PACE <span class="eyebrow-dot">·</span> 只和过去的自己比</div><h1>一点一点，看见自己的节奏<span class="wave">。</span></h1><p class="heading-sub">这些数字来自你填写的对局，只帮你观察变化，不替你判断输赢原因。</p></div></div>
    <div class="trend-filterbar"><div><strong>查看范围</strong><span>${selectedMatches.length} 场对局符合筛选条件</span></div><label class="field"><span>英雄</span><select id="trend-hero-filter" data-filter="hero"><option value="all">所有英雄</option>${heroes.map((hero) => `<option value="${escapeHtml(hero)}" ${trendFilters.hero === hero ? "selected" : ""}>${escapeHtml(hero)}</option>`).join("")}</select></label><label class="field"><span>地图</span><select id="trend-map-filter" data-filter="map"><option value="all">所有地图</option>${maps.map((map) => `<option value="${escapeHtml(map)}" ${trendFilters.map === map ? "selected" : ""}>${escapeHtml(map)}</option>`).join("")}</select></label></div>
    <section class="trend-kpis"><article class="trend-kpi"><span>筛选后对局</span><strong>${stats.games}<small> 场</small></strong><div class="trend-kpi-foot">${trendFilters.hero === "all" ? "所有英雄" : escapeHtml(trendFilters.hero)} · ${trendFilters.map === "all" ? "所有地图" : escapeHtml(trendFilters.map)}</div></article><article class="trend-kpi"><span>胜率</span><strong>${stats.winRate}<small>%</small></strong><div class="trend-kpi-foot">${wins} 胜 · ${losses} 负 · ${draws} 平</div></article><article class="trend-kpi"><span>完成复盘</span><strong>${stats.reviewRate}<small>%</small></strong><div class="trend-kpi-foot">${stats.reviewed} 场已留下总结</div></article><article class="trend-kpi"><span>每 10 分钟阵亡</span><strong>${stats.deaths10}<small> 次</small></strong><div class="trend-kpi-foot">${stats.ratedCount} 场有时长与阵亡数据</div></article></section>
    <section class="panel performance-panel"><div class="panel-heading"><div><div class="section-kicker">MATCH STATS</div><h2>每场数据均值</h2></div><span class="side-optional">只统计已填写字段</span></div><div class="performance-stats"><div><span>消灭</span><strong>${average("eliminations")}</strong></div><div><span>助攻</span><strong>${average("assists")}</strong></div><div><span>伤害</span><strong>${average("damage")}</strong></div><div><span>治疗</span><strong>${average("healing")}</strong></div><div><span>减伤</span><strong>${average("mitigation")}</strong></div></div></section>
    <div class="trend-layout"><section class="panel trend-chart-panel"><div class="panel-heading"><div><div class="section-kicker">GAME BY GAME</div><h2>对局结果与时长</h2></div><span class="chart-legend"><i class="legend-win"></i>胜利 <i class="legend-loss"></i>失败</span></div><div class="result-chart">${newest.length ? newest.map((match) => `<button type="button" class="chart-column" data-action="open-review" data-id="${escapeHtml(match.id)}" title="${escapeHtml(match.map)} · ${resultLabel(match.result)} · ${durationLabel(match.duration)}"><span class="chart-result ${resultClass(match.result)}">${resultMark(match.result)}</span><div class="chart-bar-wrap"><div class="chart-bar ${resultClass(match.result)}" style="height:${Math.max(24, Math.round((Number(match.duration || 300) / maxGames) * 92))}%"></div></div><span class="chart-x">${dateLabel(match.date)}</span></button>`).join("") : emptyState("⌁", "多记录几场，就能看到趋势", "每场都会成为你自己的一个数据点。")}</div><div class="chart-caption">每根柱子代表一场对局；柱高表示对局时长，点击可打开复盘。</div></section>
      <section class="panel habits-panel"><div class="panel-heading"><div><div class="section-kicker">REVIEW HABIT</div><h2>复盘习惯</h2></div><span class="habits-ring" style="--progress:${stats.reviewRate}%"><span>${stats.reviewRate}%</span></span></div><p class="panel-description">当前筛选的 ${selectedMatches.length} 场对局中，有 ${stats.reviewed} 场写下了总结和下一步动作。</p><div class="habit-breakdown"><div><span><i class="legend-win"></i>已复盘</span><strong>${stats.reviewed} 场</strong></div><div><span><i class="legend-pending"></i>待复盘</span><strong>${reviewPending} 场</strong></div></div><div class="habit-quote"><span>“</span>给自己一点时间，先找到一个值得带走的瞬间。</div></section></div>
    <div class="gentle-footnote"><span>ⓘ</span> 对局统计由你手动填写，样本较少时波动较大。不同地图、英雄和位置之间不宜直接比较。</div>`;
}

function pageSettings() {
  return `<div class="page-heading page-heading-compact"><div><div class="eyebrow">YOUR SPACE <span class="eyebrow-dot">·</span> 只属于你的训练记录</div><h1>设置与数据<span class="wave">。</span></h1><p class="heading-sub">当前是演示版本，数据留在此浏览器。正式账号和云端同步会在后续接入。</p></div></div><div class="settings-layout"><section class="panel settings-panel"><div class="panel-heading"><div><div class="section-kicker">PROFILE</div><h2>训练者资料</h2></div></div><div class="form-grid"><label class="field"><span>怎么称呼你</span><input id="profile-name" value="${escapeHtml(state.profile.nickname)}" maxlength="32" /></label><label class="field"><span>主要位置</span><select id="profile-role">${["支援", "重装", "输出", "灵活练习"].map((item) => `<option ${item === state.profile.role ? "selected" : ""}>${item}</option>`).join("")}</select></label></div><button class="button button-outline" data-action="save-profile">保存资料</button></section><section class="panel settings-panel"><div class="panel-heading"><div><div class="section-kicker">YOUR DATA</div><h2>记录数据</h2></div><span class="private-tag"><span>●</span> 私人演示数据</span></div><p class="panel-description">共 ${state.matches.length} 场对局。可以将记录导出为 JSON 备份；导入仅用于本机演示。</p><div class="data-actions"><button class="button button-outline" data-action="export-data">↓ 导出 JSON 备份</button><label class="button button-outline file-button">↑ 导入 JSON 备份<input type="file" accept="application/json,.json" id="import-file" /></label></div></section><section class="account-placeholder"><div class="account-symbol">✳</div><div><strong>账号与跨设备同步</strong><p>演示版先让你体验完整的记录和复盘流程。登录与云端同步会在下一阶段接入。</p></div><span class="coming-soon">后续接入</span></section></div>`;
}

const pages = { home: ["今日训练", pageHome], matches: ["对局记录", pageMatches], training: ["训练计划", pageTraining], trends: ["我的趋势", pageTrends], settings: ["设置与数据", pageSettings] };

function render() {
  if (!pages[activePage]) activePage = "home";
  const [title, page] = pages[activePage];
  appShell(page(), title);
  const search = document.querySelector("#match-search");
  if (search) {
    search.addEventListener("input", filterMatchList);
    ["#result-filter", "#review-filter", "#hero-filter", "#map-filter"].forEach((selector) => document.querySelector(selector).addEventListener("change", filterMatchList));
  }
  if (activePage === "trends") ["#trend-hero-filter", "#trend-map-filter"].forEach((selector) => document.querySelector(selector)?.addEventListener("change", (event) => { trendFilters[event.target.dataset.filter] = event.target.value; render(); }));
}

function filterMatchList() {
  const query = document.querySelector("#match-search")?.value.trim().toLowerCase() || "";
  const result = document.querySelector("#result-filter")?.value || "all";
  const reviewState = document.querySelector("#review-filter")?.value || "all";
  const hero = document.querySelector("#hero-filter")?.value || "all";
  const map = document.querySelector("#map-filter")?.value || "all";
  const filtered = state.matches.filter((match) => {
    const hasQuery = `${match.map} ${(match.heroes || []).join(" ")} ${match.mode}`.toLowerCase().includes(query);
    const reviewMatches = reviewState === "all" || (reviewState === "complete" ? isReviewed(match) : !isReviewed(match));
    return hasQuery && (result === "all" || match.result === result) && reviewMatches && (hero === "all" || match.heroes?.includes(hero)) && (map === "all" || match.map === map);
  });
  document.querySelector("#matches-list").innerHTML = filtered.length ? filtered.map(matchRow).join("") : emptyState("⌕", "没有找到这场对局", "试试其他地图、英雄或结果。");
}

function closeModal() { document.querySelector("#modal-root").innerHTML = ""; document.body.classList.remove("modal-open"); }

function showModal(content, options = {}) {
  const root = document.querySelector("#modal-root");
  root.innerHTML = `<div class="modal-backdrop"><section class="modal ${options.wide ? "modal-wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close" data-action="close-modal" aria-label="关闭">×</button>${content}</section></div>`;
  document.body.classList.add("modal-open");
}

function openMatchForm(id = "") {
  const match = state.matches.find((item) => item.id === id) || demoRepository.makeEmptyMatch();
  const editing = Boolean(id);
  const stats = matchStats(match);
  const modes = ["混合", "运载", "控制", "闪点", "推进", "占领", "其他"];
  const modeOptions = modes.map((item) => `<option value="${item}" ${match.mode === item ? "selected" : ""}>${item}</option>`).join("");
  const numericField = (name, label, value, max = "100000") => `<label class="field"><span>${label} <small>选填</small></span><input name="${name}" type="number" min="0" max="${max}" step="1" value="${escapeHtml(value ?? "")}" placeholder="—" /></label>`;
  showModal(`<div class="modal-overline">${editing ? "EDIT MATCH" : "NEW MATCH"} <span>·</span> 对局资料</div><h2 class="modal-title" id="modal-title">${editing ? "编辑这场对局" : "记下刚结束的对局"}</h2><p class="modal-subtitle">可先记核心信息，战绩统计和复盘细节都能之后补上。</p><form id="match-form" data-id="${escapeHtml(match.id)}" class="stack-form">
    <div class="form-grid"><label class="field"><span>日期</span><input name="date" type="date" value="${escapeHtml(match.date)}" required /></label><label class="field"><span>开始时间 <small>选填</small></span><input name="time" type="time" value="${escapeHtml(match.time || "")}" /></label></div>
    <div class="form-grid"><label class="field"><span>地图</span><input name="map" placeholder="比如：国王大道" maxlength="60" value="${escapeHtml(match.map || "")}" required /></label><label class="field"><span>模式</span><select name="mode" required><option value="">选择模式</option>${modeOptions}</select></label></div>
    <label class="field"><span>使用的英雄 <small>多位英雄用顿号或逗号分开</small></span><input name="heroes" placeholder="比如：安娜、朱诺" maxlength="100" value="${escapeHtml((match.heroes || []).join("、"))}" /></label>
    <div class="form-grid"><label class="field"><span>主要位置</span><select name="role">${["支援", "重装", "输出", "灵活练习"].map((item) => `<option ${item === (match.role || state.profile.role) ? "selected" : ""}>${item}</option>`).join("")}</select></label><label class="field"><span>攻守方 <small>选填</small></span><select name="side"><option value="">不区分</option>${["进攻 / 先攻", "防守 / 后手", "不适用"].map((item) => `<option ${item === match.side ? "selected" : ""}>${item}</option>`).join("")}</select></label></div>
    <div class="form-grid"><label class="field"><span>对局结果</span><select name="result"><option value="win" ${match.result === "win" ? "selected" : ""}>胜利</option><option value="loss" ${match.result === "loss" ? "selected" : ""}>失败</option><option value="draw" ${match.result === "draw" ? "selected" : ""}>平局</option></select></label><label class="field"><span>当前段位 <small>选填</small></span><input name="rank" placeholder="比如：钻石 3" maxlength="32" value="${escapeHtml(match.rank || "")}" /></label></div>
    <div class="form-grid"><label class="field"><span>对局时长 <small>分钟</small></span><input name="duration" type="number" min="1" max="120" step="0.1" placeholder="选填" value="${match.duration ? (Number(match.duration) / 60).toFixed(1) : ""}" /></label><div class="match-form-hint"><strong>战绩数据</strong><span>按结算面板填写；不适用的项目可以留空。</span></div></div>
    <div class="form-grid match-stat-inputs">${numericField("eliminations", "消灭", stats.eliminations, "500")}${numericField("assists", "助攻", stats.assists, "500")}${numericField("deaths", "阵亡", stats.deaths, "100")}${numericField("damage", "伤害", stats.damage)}${numericField("healing", "治疗", stats.healing)}${numericField("mitigation", "减伤", stats.mitigation)}</div>
    <div class="form-divider"></div><div class="form-hint"><span>✳</span> 回放码、关键时刻和复盘结论可在下一步继续补充。</div><div class="modal-actions"><button type="button" class="button button-quiet" data-action="cancel-match-form" data-id="${escapeHtml(match.id)}">${editing ? "返回复盘" : "先不记了"}</button><button class="button button-primary" type="submit">${editing ? "保存对局资料" : "保存这场对局"} <span>→</span></button></div></form>`, { wide: true });
}

function openReview(id) {
  const match = state.matches.find((item) => item.id === id);
  if (!match) return;
  const review = match.review || { summary: "", nextAction: "", events: [] };
  const events = review.events?.length ? review.events : [{ kind: "关键操作", time: "", observation: "", interpretation: "", preventable: "unknown", action: "" }];
  const hero = (match.heroes || []).join(" / ") || "未填写英雄";
  const safeVideoUrl = isHttpUrl(match.videoUrl || "") ? match.videoUrl : "";
  const stats = matchStats(match);
  const statSummary = [["消灭", stats.eliminations], ["助攻", stats.assists], ["阵亡", stats.deaths], ["伤害", stats.damage], ["治疗", stats.healing], ["减伤", stats.mitigation]].filter(([, value]) => value !== "");
  showModal(`<div class="review-modal-header"><div class="result-mark ${resultClass(match.result)}">${resultMark(match.result)}</div><div><div class="modal-overline">${dateLabel(match.date)} · ${escapeHtml(match.time || "")} · ${escapeHtml(match.mode || "")}</div><h2 class="modal-title" id="modal-title">${escapeHtml(match.map)}</h2><div class="review-match-meta">${escapeHtml(hero)} <i>·</i> ${escapeHtml(match.role || state.profile.role)} <i>·</i> ${resultLabel(match.result)} ${match.duration ? ` <i>·</i> ${durationLabel(match.duration)}` : ""} ${match.rank ? ` <i>·</i> ${escapeHtml(match.rank)}` : ""}</div>${statSummary.length ? `<div class="review-stat-pills">${statSummary.map(([label, value]) => `<span>${label} <b>${Number(value).toLocaleString("zh-CN")}</b></span>`).join("")}</div>` : ""}</div><div class="review-header-actions"><button class="button button-outline button-small" data-action="edit-match" data-id="${escapeHtml(match.id)}">编辑资料</button><button class="delete-match" data-action="delete-match" data-id="${escapeHtml(match.id)}" title="删除这场对局">⌫</button></div></div>
    <form id="review-form" data-id="${escapeHtml(match.id)}" class="review-layout"><div class="review-form-column"><div class="review-section-label"><span>01</span> 本场复盘</div><label class="field"><span>整体回顾 <small>先说清这一局的主线</small></span><textarea name="summary" rows="3" maxlength="1200" placeholder="比如：前两波跟住队伍，最后一波分散后连续丢点……">${escapeHtml(review.summary)}</textarea></label><div class="review-guided-grid"><label class="field"><span>本场做得好的地方</span><textarea name="highlight" rows="3" maxlength="500" placeholder="哪次选择值得下次继续做？">${escapeHtml(review.highlight || "")}</textarea></label><label class="field"><span>最想改进的一次决策</span><textarea name="mainMistake" rows="3" maxlength="500" placeholder="影响最大的一次判断或失误是什么？">${escapeHtml(review.mainMistake || "")}</textarea></label></div><div class="review-section-label review-section-spaced"><span>02</span> 下一局的执行点</div><label class="field"><span>下次我会具体做什么</span><textarea name="nextAction" rows="2" maxlength="400" placeholder="写一个能在下一波检查的动作，比如：交战前确认撤退路线。">${escapeHtml(review.nextAction)}</textarea></label>
      <div class="review-section-label review-section-spaced"><span>03</span> 关键时刻与阵亡复盘 <small>可按回放时间查找</small></div><div class="events-list" id="events-list">${events.map(eventMarkup).join("")}</div><button type="button" class="add-event-button" data-action="add-event">＋ 添加关键时刻</button></div>
    <aside class="review-side-column"><div class="goal-check-card"><div class="side-card-head"><span class="side-card-icon goal-check-icon">✓</span><strong>本场训练自评</strong><span class="side-optional">选填</span></div><p>这场对局里，有做到“${escapeHtml(state.goal.title)}”吗？</p><label class="field"><span>给这局打个标记</span><select name="goalCheck"><option value="">暂不评估</option><option value="done" ${state.goal.checks[match.id] === "done" ? "selected" : ""}>这次做到了</option><option value="missed" ${state.goal.checks[match.id] === "missed" ? "selected" : ""}>下次再试试</option></select></label></div><div class="replay-card"><div class="side-card-head"><span class="side-card-icon">▷</span><strong>游戏内回放</strong><span class="side-optional">选填</span></div><p>回放码可以在游戏里导入观看；网页暂时不能直接播放。</p><label class="field"><span>回放代码</span><input name="replayCode" value="${escapeHtml(match.replayCode || "")}" maxlength="32" placeholder="粘贴回放代码" /></label><button class="copy-code-button" type="button" data-action="copy-code">复制代码</button></div><div class="video-card"><div class="side-card-head"><span class="side-card-icon">↗</span><strong>外部视频</strong><span class="side-optional">选填</span></div><p>如果你录了屏，可以保存视频链接，之后打开复看。</p><label class="field"><span>视频网址</span><input name="videoUrl" type="url" value="${escapeHtml(match.videoUrl || "")}" placeholder="https://…" /></label>${safeVideoUrl ? `<a class="open-video" href="${escapeHtml(safeVideoUrl)}" target="_blank" rel="noopener">打开视频 ↗</a>` : ""}</div><div class="private-note"><span>♙</span><span>这是你的私人记录。分享功能将在后续版本开放。</span></div></aside></form>
    <div class="review-modal-footer"><button class="button button-quiet" data-action="close-modal">取消</button><button class="button button-primary" type="submit" form="review-form">保存复盘 <span>→</span></button></div>`, { wide: true });
}

function eventMarkup(event = {}) {
  const kinds = ["阵亡", "大招时机", "站位/走位", "交战决策", "团队配合", "关键操作", "其他"];
  return `<div class="event-card"><div class="event-card-top"><label class="field event-kind-field"><span class="sr-only">事件类型</span><select name="eventKind">${kinds.map((kind) => `<option ${kind === (event.kind || "关键操作") ? "selected" : ""}>${kind}</option>`).join("")}</select></label><label class="field event-time-field"><span class="sr-only">回放时间</span><input name="eventTime" type="text" inputmode="numeric" maxlength="8" placeholder="回放时间 00:00" value="${escapeHtml(event.time || "")}" /></label><button type="button" class="remove-event" data-action="remove-event" aria-label="移除关键时刻">×</button></div><label class="field"><span>画面事实</span><textarea name="observation" rows="2" maxlength="300" placeholder="回放里能确认发生了什么？">${escapeHtml(event.observation || "")}</textarea></label><label class="field"><span>${event.kind === "阵亡" ? "阵亡原因 / 当时判断" : "当时判断"}</span><textarea name="interpretation" rows="2" maxlength="300" placeholder="当时看到了什么、为什么这样处理？">${escapeHtml(event.interpretation || "")}</textarea></label><label class="field"><span>这次是否可以避免</span><select name="preventable"><option value="unknown" ${!event.preventable || event.preventable === "unknown" ? "selected" : ""}>暂不判断</option><option value="yes" ${event.preventable === "yes" ? "selected" : ""}>可以避免</option><option value="partial" ${event.preventable === "partial" ? "selected" : ""}>部分可避免</option><option value="no" ${event.preventable === "no" ? "selected" : ""}>难以避免</option></select></label><label class="field"><span>下次的替代动作</span><input name="eventAction" maxlength="200" value="${escapeHtml(event.action || "")}" placeholder="下一次我会怎么做？" /></label></div>`;
}

function editGoal() {
  showModal(`<div class="modal-overline">YOUR FOCUS <span>·</span> 训练计划</div><h2 class="modal-title" id="modal-title">定下本周想练的一件事</h2><p class="modal-subtitle">目标越具体，结束后越容易判断有没有做到。</p><form id="goal-form" class="stack-form"><label class="field"><span>本周训练目标</span><input name="title" maxlength="90" required value="${escapeHtml(state.goal.title)}" placeholder="比如：交战前确认撤退路线" /></label><label class="field"><span>怎么判断做到</span><textarea name="criterion" rows="3" maxlength="250" required placeholder="比如：每次开团前，找到一处可以退回的掩体">${escapeHtml(state.goal.criterion)}</textarea></label><label class="field"><span>复盘提醒日期 <small>选填</small></span><input name="dueDate" type="date" value="${escapeHtml(state.goal.dueDate || "")}" /></label><div class="modal-actions"><button type="button" class="button button-quiet" data-action="close-modal">取消</button><button type="submit" class="button button-primary">保存目标 <span>→</span></button></div></form>`);
}

function showSignInHint() {
  showModal(`<div class="account-modal-icon">✳</div><div class="modal-overline">ACCOUNT & SYNC <span>·</span> 账号与同步</div><h2 class="modal-title" id="modal-title">这是一个可体验的演示版本</h2><p class="account-modal-copy">当前数据只保存在这台设备的浏览器中。正式账号登录、云端私密记录与跨设备同步，会在后续阶段接入。</p><div class="account-privacy"><span>♙</span><div><strong>你的真实记录默认只对自己可见</strong><small>分享单份复盘由你主动发起，可随时撤销。</small></div></div><button class="button button-primary account-modal-button" data-action="close-modal">继续体验 <span>→</span></button>`);
}

function showShareHint() {
  showModal(`<div class="account-modal-icon">↗</div><div class="modal-overline">PRIVATE BY DEFAULT <span>·</span> 分享复盘</div><h2 class="modal-title" id="modal-title">这份复盘目前只在本机可见</h2><p class="account-modal-copy">正式版将支持主动分享单份复盘、预览分享内容和随时撤销链接。当前演示不会生成真实的公开链接。</p><div class="account-privacy"><span>♙</span><div><strong>你决定分享哪一份</strong><small>对局记录默认只有本人可见，不设置公开广场或排行榜。</small></div></div><button class="button button-primary account-modal-button" data-action="close-modal">知道了</button>`);
}

function exportData() {
  const blob = new Blob([JSON.stringify({ schemaVersion: 2, exportedAt: new Date().toISOString(), data: state }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `huihe-training-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("JSON 备份已导出");
}

async function importData(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const imported = parsed.data ?? parsed;
    if (!Array.isArray(imported.matches) || !imported.goal || !imported.profile) throw new Error("format");
    pendingImport = demoRepository.normalizeState(imported);
    showModal(`<div class="account-modal-icon">↑</div><div class="modal-overline">IMPORT BACKUP <span>·</span> 导入备份</div><h2 class="modal-title" id="modal-title">替换当前演示记录？</h2><p class="account-modal-copy">这个备份包含 ${pendingImport.matches.length} 场对局。导入后会替换这台设备上的演示资料和训练目标。</p><div class="modal-actions"><button class="button button-quiet" data-action="cancel-import">暂不导入</button><button class="button button-primary" data-action="confirm-import">导入备份</button></div>`);
  } catch {
    showToast("无法读取这个备份文件");
  }
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-nav]");
  if (nav) {
    activePage = nav.dataset.nav;
    if (location.hash !== `#${activePage}`) location.hash = activePage;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  const action = event.target.closest("[data-action]");
  if (!action) {
    if (event.target.classList.contains("modal-backdrop")) closeModal();
    if (event.target.closest(".sign-in-button")) showSignInHint();
    return;
  }
  switch (action.dataset.action) {
    case "new-match": openMatchForm(); break;
    case "open-review": openReview(action.dataset.id); break;
    case "edit-match": openMatchForm(action.dataset.id); break;
    case "close-modal": closeModal(); break;
    case "cancel-match-form": if (state.matches.some((item) => item.id === action.dataset.id)) openReview(action.dataset.id); else closeModal(); break;
    case "edit-goal": editGoal(); break;
    case "add-event": document.querySelector("#events-list").insertAdjacentHTML("beforeend", eventMarkup()); break;
    case "remove-event": if (document.querySelectorAll(".event-card").length > 1) action.closest(".event-card").remove(); else showToast("至少留一个时间点位置"); break;
    case "copy-code": {
      const value = document.querySelector('[name="replayCode"]')?.value.trim();
      if (!value) { showToast("先填写回放代码"); break; }
      navigator.clipboard?.writeText(value).then(() => showToast("回放代码已复制")).catch(() => showToast("复制失败，请手动选择代码"));
      break;
    }
    case "delete-match": {
      showModal(`<div class="account-modal-icon">⌫</div><div class="modal-overline">REMOVE MATCH <span>·</span> 删除记录</div><h2 class="modal-title" id="modal-title">要删除这场对局吗？</h2><p class="account-modal-copy">这会同时移除它的复盘和训练自评。删除后无法恢复，请确认这场对局不再需要。</p><div class="modal-actions"><button class="button button-quiet" data-action="close-modal">先保留</button><button class="button button-primary" data-action="confirm-delete" data-id="${escapeHtml(action.dataset.id)}">删除对局</button></div>`);
      break;
    }
    case "confirm-delete": {
      const id = action.dataset.id;
      const match = state.matches.find((item) => item.id === id);
      if (!match) { closeModal(); break; }
      const priorMatches = state.matches;
      const priorChecks = state.goal.checks;
      state.matches = state.matches.filter((item) => item.id !== id);
      state.goal.checks = { ...state.goal.checks };
      delete state.goal.checks[id];
      if (!persist("对局已删除")) {
        state.matches = priorMatches;
        state.goal.checks = priorChecks;
        return;
      }
      closeModal(); render();
      break;
    }
    case "save-profile": {
      state.profile.nickname = document.querySelector("#profile-name").value.trim() || "回合玩家";
      state.profile.role = document.querySelector("#profile-role").value;
      persist("资料已保存"); render(); break;
    }
    case "export-data": exportData(); break;
    case "share-review": showShareHint(); break;
    case "cancel-import": pendingImport = null; closeModal(); break;
    case "confirm-import": {
      if (!pendingImport) { closeModal(); break; }
      const previous = { profile: state.profile, goal: state.goal, matches: state.matches };
      state.profile = pendingImport.profile;
      state.goal = pendingImport.goal;
      state.matches = pendingImport.matches;
      if (!persist("演示记录已导入")) {
        Object.assign(state, previous);
        pendingImport = null;
        return;
      }
      pendingImport = null;
      closeModal(); render();
      break;
    }
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.id === "match-form") {
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form));
    const existing = form.dataset.id ? state.matches.find((item) => item.id === form.dataset.id) : null;
    const match = existing || demoRepository.makeEmptyMatch();
    const previousMatches = structuredClone(state.matches);
    const numberOrBlank = (value) => value === "" || value == null ? "" : Number(value);
    const statData = Object.fromEntries(["eliminations", "assists", "deaths", "damage", "healing", "mitigation"].map((key) => [key, numberOrBlank(data[key])]));
    Object.assign(match, {
      date: data.date,
      time: data.time,
      map: data.map.trim(),
      mode: data.mode,
      heroes: data.heroes.split(/[、,，/]/).map((hero) => hero.trim()).filter(Boolean),
      role: data.role,
      side: data.side,
      result: data.result,
      rank: data.rank.trim(),
      duration: data.duration ? Math.round(Number(data.duration) * 60) : "",
      stats: statData,
      deaths: statData.deaths,
    });
    if (!existing) state.matches.unshift(match);
    if (!persist(existing ? "对局资料已更新" : "这场对局已记录")) {
      state.matches = previousMatches;
      return;
    }
    closeModal();
    if (existing) { render(); openReview(match.id); return; }
    activePage = "matches";
    if (location.hash !== "#matches") location.hash = "matches";
    render();
    return;
  }
  if (event.target.id === "review-form") {
    event.preventDefault();
    const form = event.target;
    const match = state.matches.find((item) => item.id === form.dataset.id);
    if (!match) return;
    const formData = new FormData(form);
    const values = (key) => formData.getAll(key).map((value) => String(value).trim());
    const videoUrl = String(formData.get("videoUrl") || "").trim();
    if (videoUrl && !isHttpUrl(videoUrl)) {
      showToast("视频链接请使用 http 或 https 地址");
      return;
    }
    const previousReplayCode = match.replayCode;
    const previousVideoUrl = match.videoUrl;
    const previousReview = structuredClone(match.review);
    const previousGoalChecks = state.goal.checks;
    match.replayCode = String(formData.get("replayCode") || "").trim();
    match.videoUrl = videoUrl;
    match.review = {
      summary: String(formData.get("summary") || "").trim(),
      highlight: String(formData.get("highlight") || "").trim(),
      mainMistake: String(formData.get("mainMistake") || "").trim(),
      nextAction: String(formData.get("nextAction") || "").trim(),
      events: values("observation").map((observation, index) => ({
        kind: values("eventKind")[index] || "关键操作",
        time: values("eventTime")[index] || "",
        observation,
        interpretation: values("interpretation")[index] || "",
        preventable: values("preventable")[index] || "unknown",
        action: values("eventAction")[index] || "",
      })).filter((item) => item.time || item.observation || item.interpretation || item.action || item.kind !== "关键操作"),
    };
    const goalCheck = String(formData.get("goalCheck") || "");
    state.goal.checks = { ...state.goal.checks };
    if (goalCheck === "done" || goalCheck === "missed") state.goal.checks[match.id] = goalCheck;
    else delete state.goal.checks[match.id];
    if (!persist("复盘已保存")) {
      match.replayCode = previousReplayCode;
      match.videoUrl = previousVideoUrl;
      match.review = previousReview;
      state.goal.checks = previousGoalChecks;
      return;
    }
    closeModal(); render();
    return;
  }
  if (event.target.id === "goal-form") {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    state.goal.title = data.title.trim();
    state.goal.criterion = data.criterion.trim();
    state.goal.dueDate = data.dueDate;
    if (!persist("训练目标已更新")) return;
    closeModal(); render();
  }
});

document.addEventListener("change", (event) => {
  if (event.target.id === "import-file") importData(event.target.files?.[0]);
});

window.addEventListener("hashchange", () => {
  activePage = location.hash.replace(/^#\/?/, "") || "home";
  render();
});
window.addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });

render();
