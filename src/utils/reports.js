/**
 * 周报 / 月报 / 趋势 / 月历相关纯计算逻辑，供 App.jsx 通过 useMemo 调用。
 * 不包含 React、浏览器副作用，仅依赖 utils/date.js 与 utils/taskTags.js。
 */

import {
  addDays,
  dateKeyToDate,
  formatWeekdayShort,
  getMonthEnd,
  getMonthStart,
} from "./date.js";
import { getTagLabel, normalizeTag, TASK_TAG_OPTIONS } from "./taskTags.js";

/**
 * 周报计算：以 selectedDate 为结束日的过去 7 天。
 * @param {string} selectedDate - 日期键 YYYY-MM-DD
 * @param {Array} tasks - 任务列表
 * @returns {{ start, end, total, completed, completionRate, activeDays, daysDesc, tagStats, markdown }}
 */
export function computeWeeklyReport(selectedDate, tasks) {
  const end = selectedDate;
  const datesAsc = Array.from({ length: 7 }, (_, i) => addDays(end, i - 6));
  const start = datesAsc[0];
  const dateSet = new Set(datesAsc);

  const tasksInRange = tasks.filter((t) => dateSet.has(t.date));
  const total = tasksInRange.length;
  const completed = tasksInRange.filter((t) => t.isCompleted).length;
  const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);

  const daysAsc = datesAsc.map((date) => ({
    date,
    weekdayLabel: formatWeekdayShort(date),
    tasks: tasks.filter((t) => t.date === date),
  }));

  const daysDesc = [...daysAsc].reverse();
  const activeDays = daysAsc.filter((d) => d.tasks.length > 0).length;

  const tagStats = {};
  for (const t of tasksInRange) {
    const tag = normalizeTag(t.tag);
    if (!tagStats[tag]) tagStats[tag] = { total: 0, completed: 0 };
    tagStats[tag].total += 1;
    if (t.isCompleted) tagStats[tag].completed += 1;
  }

  const markdown = [
    `# 周报（${start} ~ ${end})`.replace(")", "）").replace("（", "（"),
    `- 总任务：${total}`,
    `- 已完成：${completed}`,
    `- 完成率：${completionRate}%`,
    "",
  ]
    .join("\n")
    .concat(
      daysDesc
        .map((day) => {
          const title = `## ${day.date.slice(5)} ${day.weekdayLabel}`;
          if (!day.tasks.length) return `${title}\n- 无任务\n`;
          const lines = day.tasks.map((t) => `- [${t.isCompleted ? "x" : " "}] ${t.text}`);
          return `${title}\n${lines.join("\n")}\n`;
        })
        .join("\n")
        .trimEnd()
    );

  return {
    start,
    end,
    total,
    completed,
    completionRate,
    activeDays,
    daysDesc,
    tagStats,
    markdown,
  };
}

/**
 * 最近 4 周趋势：以 selectedDate 所在周为最后一周，向前 3 周，共 4 周。
 * @param {string} selectedDate
 * @param {Array} tasks
 * @returns {Array<{ start, end, total, completed, completionRate, activeDays }>}
 */
export function computeRecentWeeklyTrends(selectedDate, tasks) {
  const weeks = [];
  for (let i = 0; i < 4; i++) {
    const end = addDays(selectedDate, -i * 7);
    const start = addDays(end, -6);
    const dateSet = new Set(
      Array.from({ length: 7 }, (_, j) => addDays(start, j))
    );
    const tasksInRange = tasks.filter((t) => dateSet.has(t.date));
    const total = tasksInRange.length;
    const completed = tasksInRange.filter((t) => t.isCompleted).length;
    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);
    const activeDays = new Set(tasksInRange.map((t) => t.date)).size;
    weeks.push({ start, end, total, completed, completionRate, activeDays });
  }
  return weeks;
}

/**
 * 月报计算：selectedDate 所在月的任务统计与 markdown。
 * @param {string} selectedDate
 * @param {Array} tasks
 * @returns {{ start, end, total, completed, completionRate, activeDays, daysDesc, tagStats, markdown }}
 */
export function computeMonthlyReport(selectedDate, tasks) {
  const start = getMonthStart(selectedDate);
  const end = getMonthEnd(selectedDate);
  const tasksInRange = tasks.filter((t) => t.date >= start && t.date <= end);
  const total = tasksInRange.length;
  const completed = tasksInRange.filter((t) => t.isCompleted).length;
  const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);
  const activeDays = new Set(tasksInRange.map((t) => t.date)).size;

  const tagStats = {};
  for (const t of tasksInRange) {
    const tag = normalizeTag(t.tag);
    if (!tagStats[tag]) tagStats[tag] = { total: 0, completed: 0 };
    tagStats[tag].total += 1;
    if (t.isCompleted) tagStats[tag].completed += 1;
  }

  const datesWithTasks = [...new Set(tasksInRange.map((t) => t.date))].sort().reverse();
  const daysDesc = datesWithTasks.map((date) => ({
    date,
    weekdayLabel: formatWeekdayShort(date),
    tasks: tasksInRange.filter((t) => t.date === date),
  }));

  const tagLines = TASK_TAG_OPTIONS.map((o) => o.value)
    .filter((value) => tagStats[value])
    .map((value) => `- ${getTagLabel(value)}：${tagStats[value].total} / ${tagStats[value].completed}`);

  const markdownParts = [
    `# 月报（${start} ~ ${end})`.replace(")", "）").replace("（", "（"),
    `- 总任务：${total}`,
    `- 已完成：${completed}`,
    `- 完成率：${completionRate}%`,
    `- 活跃天数：${activeDays}`,
    "",
  ];
  if (tagLines.length > 0) {
    markdownParts.push("## 按标签统计", ...tagLines, "");
  }
  const dayBlocks = daysDesc.map((day) => {
    const title = `## ${day.date.slice(5)} ${day.weekdayLabel}`;
    if (!day.tasks.length) return `${title}\n- 无任务\n`;
    const lines = day.tasks.map((t) => `- [${t.isCompleted ? "x" : " "}] ${t.text}`);
    return `${title}\n${lines.join("\n")}\n`;
  });
  markdownParts.push(dayBlocks.join("\n").trimEnd());

  return {
    start,
    end,
    total,
    completed,
    completionRate,
    activeDays,
    daysDesc,
    tagStats,
    markdown: markdownParts.join("\n"),
  };
}

/**
 * 月历网格：7 列（周一～周日），每格含 dateKey | null、dayNumber、total、completed、hasDiary。
 * @param {string} selectedDate
 * @param {Array} tasks
 * @param {Object} diaries - 日期键 -> 日记内容
 * @returns {{ cells: Array, start: string, end: string }}
 */
export function computeMonthlyCalendarGrid(selectedDate, tasks, diaries) {
  const start = getMonthStart(selectedDate);
  const end = getMonthEnd(selectedDate);
  const firstDay = dateKeyToDate(start);
  const firstWeekdayMon0 = (firstDay.getDay() + 6) % 7;
  const lastDayNum = parseInt(end.slice(8), 10);
  const tasksInMonth = tasks.filter((t) => t.date >= start && t.date <= end);
  const dayStats = {};
  for (let d = 1; d <= lastDayNum; d++) {
    const dateKey = `${start.slice(0, 7)}-${String(d).padStart(2, "0")}`;
    const dayTasks = tasksInMonth.filter((t) => t.date === dateKey);
    const total = dayTasks.length;
    const completed = dayTasks.filter((t) => t.isCompleted).length;
    const hasDiary = typeof diaries[dateKey] === "string" && diaries[dateKey].trim().length > 0;
    dayStats[dateKey] = { total, completed, hasDiary };
  }
  const cells = [];
  for (let i = 0; i < firstWeekdayMon0; i++) cells.push({ dateKey: null, dayNumber: null, total: 0, completed: 0, hasDiary: false });
  for (let d = 1; d <= lastDayNum; d++) {
    const dateKey = `${start.slice(0, 7)}-${String(d).padStart(2, "0")}`;
    const s = dayStats[dateKey] || { total: 0, completed: 0, hasDiary: false };
    cells.push({ dateKey, dayNumber: d, ...s });
  }
  const remainder = cells.length % 7;
  if (remainder !== 0) for (let i = 0; i < 7 - remainder; i++) cells.push({ dateKey: null, dayNumber: null, total: 0, completed: 0, hasDiary: false });
  return { cells, start, end };
}

/**
 * 月报单日详情：指定日的任务与日记，用于月历点击后的详情卡片。
 * @param {string | null} monthlyDetailDate - 当前选中的详情日期
 * @param {string} selectedDate - 当前选中的导航日期（决定月份）
 * @param {Array} tasks
 * @param {Object} diaries
 * @returns {Object | null} { dateKey, weekdayLabel, total, completed, completionRate, tasks, diary, hasDiary } 或 null
 */
export function computeMonthlyDetailDayData(monthlyDetailDate, selectedDate, tasks, diaries) {
  const dateKey = monthlyDetailDate || getMonthStart(selectedDate);
  const start = getMonthStart(selectedDate);
  const end = getMonthEnd(selectedDate);
  const inMonth = dateKey >= start && dateKey <= end;
  if (!inMonth) return null;
  const dayTasks = tasks.filter((t) => t.date === dateKey);
  const total = dayTasks.length;
  const completed = dayTasks.filter((t) => t.isCompleted).length;
  const diaryStr = typeof diaries[dateKey] === "string" ? diaries[dateKey] : "";
  const hasDiary = diaryStr.trim().length > 0;
  return {
    dateKey,
    weekdayLabel: formatWeekdayShort(dateKey),
    total,
    completed,
    completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
    tasks: dayTasks,
    diary: diaryStr,
    hasDiary,
  };
}

/**
 * 本月内有任务或有日记的日期列表（升序），用于月报 AI payload。
 * @param {string} selectedDate
 * @param {Array} tasks
 * @param {Object} diaries
 * @returns {Array<{ date, weekdayLabel, tasks, diary }>}
 */
export function computeMonthlyDaysForAi(selectedDate, tasks, diaries) {
  const start = getMonthStart(selectedDate);
  const end = getMonthEnd(selectedDate);
  const tasksInRange = tasks.filter((t) => t.date >= start && t.date <= end);
  const datesWithTasks = new Set(tasksInRange.map((t) => t.date));
  const dayList = [];
  let d = start;
  while (d <= end) {
    const hasTasks = datesWithTasks.has(d);
    const diaryStr = typeof diaries[d] === "string" ? diaries[d].trim() : "";
    const hasDiary = diaryStr.length > 0;
    if (hasTasks || hasDiary) {
      dayList.push({
        date: d,
        weekdayLabel: formatWeekdayShort(d),
        tasks: tasksInRange.filter((t) => t.date === d).map((t) => {
          const tagValue = normalizeTag(t.tag);
          return { text: t.text, isCompleted: t.isCompleted, tag: tagValue, tagLabel: getTagLabel(tagValue) };
        }),
        diary: typeof diaries[d] === "string" ? diaries[d] : "",
      });
    }
    if (d === end) break;
    d = addDays(d, 1);
  }
  return dayList;
}

/**
 * 周报 AI 请求 payload 组装，与 requestAiWeeklySummary 调用处结构一致。
 * @param {Object} weeklyReport - computeWeeklyReport 的返回值
 * @param {Object} diaries - 日期键 -> 日记内容
 * @returns {{ range: { start, end }, stats: Object, days: Array }}
 */
export function buildWeeklyAiPayload(weeklyReport, diaries) {
  const daysAsc = [...weeklyReport.daysDesc].reverse();
  return {
    range: { start: weeklyReport.start, end: weeklyReport.end },
    stats: {
      total: weeklyReport.total,
      completed: weeklyReport.completed,
      completionRate: weeklyReport.completionRate,
      activeDays: weeklyReport.activeDays
    },
    days: daysAsc.map((d) => ({
      date: d.date,
      weekdayLabel: d.weekdayLabel,
      tasks: d.tasks.map((t) => {
        const tagValue = normalizeTag(t.tag);
        return {
          text: t.text,
          isCompleted: t.isCompleted,
          tag: tagValue,
          tagLabel: getTagLabel(tagValue)
        };
      }),
      diary: typeof diaries[d.date] === "string" ? diaries[d.date] : ""
    }))
  };
}

/**
 * 月报 AI 请求 payload 组装，与 requestAiMonthlySummary 调用处结构一致。
 * @param {Object} monthlyReport - computeMonthlyReport 的返回值
 * @param {Array} monthlyDaysForAi - computeMonthlyDaysForAi 的返回值
 * @returns {{ range: { start, end }, stats: Object, days: Array }}
 */
export function buildMonthlyAiPayload(monthlyReport, monthlyDaysForAi) {
  return {
    range: { start: monthlyReport.start, end: monthlyReport.end },
    stats: {
      total: monthlyReport.total,
      completed: monthlyReport.completed,
      completionRate: monthlyReport.completionRate,
      activeDays: monthlyReport.activeDays
    },
    days: monthlyDaysForAi
  };
}

/**
 * 含 AI 点评的周报 Markdown 拼接，用于复制导出。
 * @param {string} weeklyMarkdown - 周报原始 markdown
 * @param {Object | null} aiResult - { comment, highlights?, suggestions? } 或 null
 * @returns {string} 完整 markdown 文本
 */
export function buildWeeklyMarkdownWithAi(weeklyMarkdown, aiResult) {
  if (!aiResult) return weeklyMarkdown;
  let text = weeklyMarkdown;
  const lines = ["\n---\n\n## AI 点评\n", `${aiResult.comment}\n`];
  if (aiResult.highlights?.length) {
    lines.push("**亮点**\n");
    aiResult.highlights.slice(0, 3).forEach((h) => lines.push(`- ${h}\n`));
  }
  if (aiResult.suggestions?.length) {
    lines.push("\n**建议**\n");
    aiResult.suggestions.slice(0, 3).forEach((s) => lines.push(`- ${s}\n`));
  }
  text += lines.join("");
  return text;
}
