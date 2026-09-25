const STORAGE_KEY = "huihe.demo.v1";

const toLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
};

const today = new Date();
const day = (offset) => {
  const date = new Date(today);
  date.setDate(date.getDate() + offset);
  return toLocalDate(date);
};

const sampleMatches = [
  {
    id: "demo-001", date: day(-1), time: "21:16", map: "国王大道", mode: "混合", heroes: ["安娜"], role: "支援", side: "防守 / 后手", result: "win", duration: 548, deaths: 5, rank: "钻石 3", replayCode: "DEMO7A", videoUrl: "", stats: { eliminations: 9, assists: 16, deaths: 5, damage: 6130, healing: 9470, mitigation: 0 },
    review: { summary: "第一波跟住坦克转角，技能留给了第二次交战。最后一波我先看到了侧翼，所以队伍有时间回头。", highlight: "最后一波提前报出侧翼，队友一起转火。", mainMistake: "前半场盯前排太久，差点漏掉高台视野。", nextAction: "下次交战前先报清楚侧翼，再跟队友一起转火。", events: [{ kind: "站位/走位", time: "04:12", observation: "左侧高台出现敌方黑百合。", interpretation: "我第一秒想继续治疗前排，视线停留得太久。", preventable: "yes", action: "先报点，找墙角遮挡后再回到队友身边。" }] }
  },
  {
    id: "demo-002", date: day(-1), time: "20:42", map: "釜山", mode: "控制", heroes: ["朱诺"], role: "支援", side: "不适用", result: "loss", duration: 621, deaths: 8, rank: "钻石 3", replayCode: "", videoUrl: "", stats: { eliminations: 7, assists: 12, deaths: 8, damage: 7520, healing: 8230, mitigation: 0 },
    review: { summary: "第二波为了追残血离开了队伍，转点时没有留意新的交战路线。", highlight: "队伍集合后两次及时回防。", mainMistake: "追击离开队友，导致转点时被先手。", nextAction: "进点前先找撤退路线；队友回撤时不单独追人。", events: [{ kind: "阵亡", time: "05:14", observation: "追击残血后与队伍断开，转角处被集火。", interpretation: "我只看目标血量，没有确认队友位置和撤回路线。", preventable: "yes", action: "追人前先确认队友能否跟进；不满足就回到掩体。" }] }
  },
  {
    id: "demo-003", date: day(-2), time: "22:03", map: "苏拉瓦萨", mode: "闪点", heroes: ["雾子"], role: "支援", result: "win", duration: 583, deaths: 3, rank: "钻石 4", replayCode: "Q8W2K1", videoUrl: "", stats: { eliminations: 10, assists: 13, deaths: 3, damage: 5710, healing: 8890, mitigation: 0 },
    review: { summary: "两次转点都提前靠近队伍，避免了单独走长路。", highlight: "转点前提前跟队伍汇合。", mainMistake: "第二波净化交得偏早。", nextAction: "保持转点时跟着队伍行动。", events: [] }
  },
  {
    id: "demo-004", date: day(-3), time: "19:48", map: "香巴里寺", mode: "运载", heroes: ["卢西奥"], role: "支援", result: "win", duration: 712, deaths: 4, rank: "钻石 4", replayCode: "", videoUrl: "", stats: { eliminations: 6, assists: 18, deaths: 4, damage: 4480, healing: 9420, mitigation: 0 },
    review: { summary: "拐角后等队伍再开加速，几次交战节奏更整齐。", highlight: "加速时机和坦克推进对齐了。", mainMistake: "有一次队伍已撤退，我还在推车边多停了一秒。", nextAction: "继续在转角观察队伍位置。", events: [] }
  },
  {
    id: "demo-005", date: day(-4), time: "20:09", map: "新皇后街", mode: "推进", heroes: ["巴蒂斯特"], role: "支援", result: "loss", duration: 646, deaths: 7, rank: "钻石 4", replayCode: "", videoUrl: "", stats: { eliminations: 8, assists: 14, deaths: 7, damage: 8040, healing: 7860, mitigation: 1820 },
    review: { summary: "最后一波站位太靠前，没能及时退回掩体。", highlight: "在前两次推进里保住了大招。", mainMistake: "最后一波站位靠前，被迫交保命技能后才撤退。", nextAction: "每次开团前确认最近的掩体。", events: [] }
  },
];

const initialState = {
  profile: { nickname: "回合玩家", role: "支援" },
  goal: { title: "交战前确认撤退路线", criterion: "每波开团前，找到一处可退回的掩体", dueDate: "", checks: { "demo-001": "done", "demo-002": "missed", "demo-003": "done" } },
  matches: sampleMatches,
};

const statFields = ["eliminations", "assists", "deaths", "damage", "healing", "mitigation"];

function normalizeMatch(match) {
  const source = match && typeof match === "object" ? match : {};
  const review = source.review && typeof source.review === "object" ? source.review : {};
  return {
    ...makeEmptyMatch(),
    ...source,
    heroes: Array.isArray(source.heroes) ? source.heroes : String(source.heroes || "").split(/[、,，/]/).map((hero) => hero.trim()).filter(Boolean),
    stats: { ...Object.fromEntries(statFields.map((field) => [field, ""])), ...(source.stats || {}), deaths: source.stats?.deaths ?? source.deaths ?? "" },
    review: {
      summary: "", highlight: "", mainMistake: "", nextAction: "", events: [], ...review,
      events: Array.isArray(review.events) ? review.events.map((item) => ({ kind: "关键操作", time: "", observation: "", interpretation: "", preventable: "unknown", action: "", ...item })) : [],
    },
  };
}

function normalizeState(data) {
  const source = data && typeof data === "object" ? data : {};
  return {
    ...structuredClone(initialState),
    ...source,
    profile: { ...initialState.profile, ...(source.profile || {}) },
    goal: { ...initialState.goal, ...(source.goal || {}), checks: { ...initialState.goal.checks, ...(source.goal?.checks || {}) } },
    matches: Array.isArray(source.matches) ? source.matches.map(normalizeMatch) : structuredClone(initialState.matches).map(normalizeMatch),
  };
}

function loadDemoState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialState));
      return normalizeState(initialState);
    }
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch {
    return normalizeState(initialState);
  }
}

function saveDemoState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function makeEmptyMatch() {
  return {
    id: crypto.randomUUID?.() ?? `match-${Date.now()}`,
    date: toLocalDate(new Date()),
    time: new Date().toTimeString().slice(0, 5),
    map: "", mode: "", heroes: [], role: "", side: "", result: "win", duration: "", rank: "", replayCode: "", videoUrl: "",
    stats: { eliminations: "", assists: "", deaths: "", damage: "", healing: "", mitigation: "" },
    review: { summary: "", highlight: "", mainMistake: "", nextAction: "", events: [] },
  };
}

window.HuiheDemoRepository = { loadDemoState, saveDemoState, makeEmptyMatch, normalizeState, normalizeMatch };
