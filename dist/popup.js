const currentTimeElement = document.getElementById("current-time");
const currentDateElement = document.getElementById("current-date");
const currentStatusElement = document.getElementById("current-status");
const lunarDateElement = document.getElementById("lunar-date");
const solarTermElement = document.getElementById("solar-term");
const metricListElement = document.getElementById("metric-list");

const WEEKDAY_NAMES = [
  "星期日",
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六"
];

const LUNAR_FORMATTER = new Intl.DateTimeFormat("zh-Hans-CN-u-ca-chinese", {
  month: "numeric",
  day: "numeric"
});

const LUNAR_DISPLAY_FORMATTER = new Intl.DateTimeFormat("zh-Hans-CN-u-ca-chinese", {
  month: "long",
  day: "numeric"
});

const lunarFestivalCache = new Map();
const metricElements = new Map();
let lastDateKey = "";
const METRIC_ICONS = {
  lunch: "🍱",
  "off-work": "⏰",
  "crazy-thursday": "🍗",
  weekend: "🌴",
  "month-half": "💵",
  "month-end": "📆",
  "year-end": "🎯",
  "dragon-boat": "🍙",
  "mid-autumn": "🌕",
  "national-day": "🇨🇳"
};
const CHINESE_LUNAR_DAYS = [
  "初一",
  "初二",
  "初三",
  "初四",
  "初五",
  "初六",
  "初七",
  "初八",
  "初九",
  "初十",
  "十一",
  "十二",
  "十三",
  "十四",
  "十五",
  "十六",
  "十七",
  "十八",
  "十九",
  "二十",
  "廿一",
  "廿二",
  "廿三",
  "廿四",
  "廿五",
  "廿六",
  "廿七",
  "廿八",
  "廿九",
  "三十"
];
const SOLAR_TERM_NAMES = [
  "小寒",
  "大寒",
  "立春",
  "雨水",
  "惊蛰",
  "春分",
  "清明",
  "谷雨",
  "立夏",
  "小满",
  "芒种",
  "夏至",
  "小暑",
  "大暑",
  "立秋",
  "处暑",
  "白露",
  "秋分",
  "寒露",
  "霜降",
  "立冬",
  "小雪",
  "大雪",
  "冬至"
];
const SOLAR_TERM_INFO = [
  0,
  21208,
  42467,
  63836,
  85337,
  107014,
  128867,
  150921,
  173149,
  195551,
  218072,
  240693,
  263343,
  285989,
  308563,
  331033,
  353350,
  375494,
  397447,
  419210,
  440795,
  462224,
  483532,
  504758
];
const CHINA_HOLIDAY_RULES_2026 = {
  holidays: [
    ["2026-01-01", "2026-01-03"],
    ["2026-02-15", "2026-02-23"],
    ["2026-04-04", "2026-04-06"],
    ["2026-05-01", "2026-05-05"],
    ["2026-06-19", "2026-06-21"],
    ["2026-09-25", "2026-09-27"],
    ["2026-10-01", "2026-10-07"]
  ],
  workdays: new Set([
    "2026-01-04",
    "2026-02-14",
    "2026-02-28",
    "2026-05-09",
    "2026-09-20",
    "2026-10-10"
  ])
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getCalendarDayDiff(fromDate, toDate) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(toDate) - startOfDay(fromDate)) / oneDay);
}

function getDaysUntilWeekend(now) {
  const day = now.getDay();
  if (day === 0 || day === 6) {
    return null;
  }

  return 6 - day;
}

function getDaysUntilMonthHalf(now) {
  const currentDate = now.getDate();
  if (currentDate > 15) {
    return null;
  }

  return 15 - currentDate;
}

function getDaysUntilMonthEnd(now) {
  const lastDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return lastDate - now.getDate();
}

function getDaysUntilYearEnd(now) {
  const yearEnd = new Date(now.getFullYear(), 11, 31);
  return getCalendarDayDiff(now, yearEnd);
}

function getDaysUntilCrazyThursday(now) {
  const day = now.getDay();
  if (day === 0 || day === 5 || day === 6) {
    return null;
  }

  return 4 - day;
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isDateInRange(dateKey, start, end) {
  return dateKey >= start && dateKey <= end;
}

function getHolidayStatus(now) {
  const dateKey = toDateKey(now);

  if (now.getFullYear() === 2026) {
    if (CHINA_HOLIDAY_RULES_2026.workdays.has(dateKey)) {
      return {
        text: "调休上班",
        tone: "adjusted-workday"
      };
    }

    const isHoliday = CHINA_HOLIDAY_RULES_2026.holidays.some(([start, end]) =>
      isDateInRange(dateKey, start, end)
    );

    if (isHoliday) {
      return {
        text: "放假",
        tone: "holiday"
      };
    }
  }

  const day = now.getDay();
  if (day === 0 || day === 6) {
    return {
      text: "周末",
      tone: "weekend"
    };
  }

  return {
    text: "工作日",
    tone: "workday"
  };
}

function getLunarDateText(now) {
  const parts = LUNAR_DISPLAY_FORMATTER.formatToParts(now);
  const month = parts.find((part) => part.type === "month")?.value ?? "--";
  const dayNumber = Number(parts.find((part) => part.type === "day")?.value ?? "0");
  const day = CHINESE_LUNAR_DAYS[dayNumber - 1] ?? "--";
  return `农历 ${month}${day}`;
}

function getSolarTermDay(year, termIndex) {
  const utcBase = Date.UTC(1900, 0, 6, 2, 5);
  const utcTime = utcBase + (31556925974.7 * (year - 1900)) + SOLAR_TERM_INFO[termIndex] * 60000;
  return new Date(utcTime).getUTCDate();
}

function getSolarTermDate(year, termIndex) {
  const month = Math.floor(termIndex / 2);
  return new Date(year, month, getSolarTermDay(year, termIndex));
}

function getCurrentSolarTerm(now) {
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
  const events = years
    .flatMap((year) =>
      SOLAR_TERM_NAMES.map((name, index) => ({
        name,
        date: getSolarTermDate(year, index)
      }))
    )
    .sort((left, right) => left.date - right.date);

  let current = events[0];
  for (const event of events) {
    if (event.date > now) {
      break;
    }
    current = event;
  }

  return current?.name ?? "--";
}

function getOffWorkMessage(now) {
  const offWork = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    18,
    30,
    0
  );
  const diffMs = offWork.getTime() - now.getTime();

  if (diffMs < 0) {
    return {
      text: "已过下班时间",
      tone: "muted"
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    text: `距离 18:30 还剩 ${hours} 小时 ${minutes} 分钟 ${seconds} 秒`,
    tone: "accent"
  };
}

function getLunchMessage(now) {
  const lunch = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    11,
    50,
    0
  );
  const diffMs = lunch.getTime() - now.getTime();

  if (diffMs <= 0) {
    return null;
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    text: `距离吃中饭还剩 ${hours} 小时 ${minutes} 分钟 ${seconds} 秒`,
    tone: "accent"
  };
}

function getLunarFestivalDate(year, month, day) {
  const cacheKey = `${year}-${month}-${day}`;
  if (lunarFestivalCache.has(cacheKey)) {
    return lunarFestivalCache.get(cacheKey);
  }

  for (let date = new Date(year, 0, 1); date.getFullYear() === year; date.setDate(date.getDate() + 1)) {
    const parts = LUNAR_FORMATTER.formatToParts(date);
    const lunarMonth = parts.find((part) => part.type === "month")?.value;
    const lunarDay = parts.find((part) => part.type === "day")?.value;

    if (lunarMonth === String(month) && lunarDay === String(day)) {
      const festivalDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      lunarFestivalCache.set(cacheKey, festivalDate);
      return festivalDate;
    }
  }

  lunarFestivalCache.set(cacheKey, null);
  return null;
}

function getFestivalMessage(now, label, festivalDate) {
  if (!festivalDate) {
    return null;
  }

  const remainingDays = getCalendarDayDiff(now, festivalDate);
  if (remainingDays < 0) {
    return null;
  }

  return {
    label,
    value: `距离${label}开始还剩 ${remainingDays} 天`,
    tone: remainingDays <= 3 ? "accent" : "default"
  };
}

function getCrazyThursdayMetric(now) {
  const remainingDays = getDaysUntilCrazyThursday(now);
  if (remainingDays === null) {
    return null;
  }

  return {
    label: "疯狂星期四",
    value: `距离疯狂星期四还剩 ${remainingDays} 天`,
    tone: remainingDays <= 1 ? "accent" : "default"
  };
}

function buildStaticMetrics(now) {
  const currentYear = now.getFullYear();
  const dragonBoatFestival = getLunarFestivalDate(currentYear, 5, 5);
  const midAutumnFestival = getLunarFestivalDate(currentYear, 8, 15);
  const nationalDay = new Date(currentYear, 9, 1);
  const crazyThursday = getCrazyThursdayMetric(now);
  const weekendDays = getDaysUntilWeekend(now);
  const monthHalfDays = getDaysUntilMonthHalf(now);

  const metrics = [
    withMetricKey("crazy-thursday", crazyThursday),
    {
      key: "weekend",
      label: "周末进度",
      value: weekendDays === null ? "已放假" : `距离周末开始还剩 ${weekendDays} 天`,
      tone: weekendDays === null || weekendDays <= 1 ? "accent" : "default"
    },
    {
      key: "month-half",
      label: "月中进度",
      value: monthHalfDays === null ? "月已过半" : `距离 15 号还剩 ${monthHalfDays} 天`,
      tone: monthHalfDays === null ? "muted" : "default"
    },
    {
      key: "month-end",
      label: "月末进度",
      value: `距离月末还剩 ${getDaysUntilMonthEnd(now)} 天`,
      tone: "default"
    },
    withMetricKey("dragon-boat", getFestivalMessage(now, "端午节", dragonBoatFestival)),
    withMetricKey("mid-autumn", getFestivalMessage(now, "中秋节", midAutumnFestival)),
    withMetricKey("national-day", getFestivalMessage(now, "国庆节", nationalDay)),
    {
      key: "year-end",
      label: "年末进度",
      value: `距离年末还剩 ${getDaysUntilYearEnd(now)} 天`,
      tone: "default"
    }
  ];

  return metrics.filter(Boolean);
}

function withMetricKey(key, metric) {
  if (!metric) {
    return null;
  }

  return {
    key,
    ...metric
  };
}

function upsertMetric(metric, index) {
  let item = metricElements.get(metric.key);
  if (!item) {
    item = document.createElement("li");
    item.className = "metric-item";

    const body = document.createElement("div");
    body.className = "metric-body";

    const label = document.createElement("span");
    label.className = "metric-label";

    const value = document.createElement("span");
    value.className = "metric-value";

    const icon = document.createElement("span");
    icon.className = "metric-icon";
    icon.setAttribute("aria-hidden", "true");

    body.append(label, value);
    item.append(body, icon);
    metricElements.set(metric.key, item);
  }

  item.classList.toggle("is-accent", metric.tone === "accent");
  item.classList.toggle("is-muted", metric.tone === "muted");
  item.children[0].children[0].textContent = metric.label;
  item.children[0].children[1].textContent = metric.value;
  item.children[1].textContent = METRIC_ICONS[metric.key] ?? "•";

  const currentItem = metricListElement.children[index];
  if (currentItem !== item) {
    metricListElement.insertBefore(item, currentItem ?? null);
  }
}

function removeMetric(key) {
  const item = metricElements.get(key);
  if (!item) {
    return;
  }

  item.remove();
  metricElements.delete(key);
}

function renderStaticMetrics(now, startIndex) {
  const metrics = buildStaticMetrics(now);
  const activeKeys = new Set(["lunch", "off-work", ...metrics.map((metric) => metric.key)]);

  for (const [key, element] of metricElements.entries()) {
    if (!activeKeys.has(key)) {
      element.remove();
      metricElements.delete(key);
    }
  }

  metrics.forEach((metric, index) => {
    upsertMetric(metric, startIndex + index);
  });
}

function updateDynamicMetrics(now) {
  const lunch = getLunchMessage(now);
  let dynamicCount = 0;

  if (lunch) {
    upsertMetric(
      {
        key: "lunch",
        label: "午饭进度",
        value: lunch.text,
        tone: lunch.tone
      },
      dynamicCount
    );
    dynamicCount += 1;
  } else {
    removeMetric("lunch");
  }

  const offWork = getOffWorkMessage(now);
  upsertMetric(
    {
      key: "off-work",
      label: "下班进度",
      value: offWork.text,
      tone: offWork.tone
    },
    dynamicCount
  );

  return dynamicCount + 1;
}

function updateClock(now) {
  currentTimeElement.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function updateHeaderMeta(now) {
  currentDateElement.textContent =
    `${now.getFullYear()}年${pad(now.getMonth() + 1)}月${pad(now.getDate())}日 ${WEEKDAY_NAMES[now.getDay()]}`;
  const holidayStatus = getHolidayStatus(now);
  currentStatusElement.textContent = holidayStatus.text;
  currentStatusElement.className = `hero-status is-${holidayStatus.tone}`;
  lunarDateElement.textContent = getLunarDateText(now);
  solarTermElement.textContent = `节气 ${getCurrentSolarTerm(now)}`;
}

function refreshStaticMetricsIfNeeded(now, dynamicCount) {
  const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  if (dateKey !== lastDateKey) {
    updateHeaderMeta(now);
    renderStaticMetrics(now, dynamicCount);
    lastDateKey = dateKey;
  }
}

function initialize() {
  const now = new Date();
  updateClock(now);
  updateHeaderMeta(now);
  const dynamicCount = updateDynamicMetrics(now);
  renderStaticMetrics(now, dynamicCount);
  lastDateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
}

function tick() {
  const now = new Date();
  updateClock(now);
  const dynamicCount = updateDynamicMetrics(now);
  refreshStaticMetricsIfNeeded(now, dynamicCount);
}

initialize();
setInterval(tick, 1000);
