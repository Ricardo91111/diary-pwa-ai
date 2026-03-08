/**
 * 日期工具与常量，供任务、日记、周报等使用。
 */

const weekdayMap = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
const weekdayShortMap = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const enWeekdayMap = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

function getTodayKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const date = `${d.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${date}`;
}

function dateKeyToDate(key) {
  const [y, m, d] = key.split("-").map((n) => Number(n));
  return new Date(y, m - 1, d);
}

function dateToKey(d) {
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const date = `${d.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${date}`;
}

function addDaysToKey(key, deltaDays) {
  const d = dateKeyToDate(key);
  d.setDate(d.getDate() + deltaDays);
  return dateToKey(d);
}

/** 安全的日期加减：基于 new Date(y, m-1, d)，避免时区字符串解析问题 */
function addDays(dateStr, deltaDays) {
  return addDaysToKey(dateStr, deltaDays);
}

function formatDateLabel(key) {
  const d = dateKeyToDate(key);
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const weekday = weekdayMap[d.getDay()];
  return `${month}月${date}日 ${weekday}`;
}

function formatWeekdayShort(key) {
  return weekdayShortMap[dateKeyToDate(key).getDay()];
}

/** 选中日期所在月的第一天 YYYY-MM-01 */
function getMonthStart(key) {
  const [y, m] = key.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

/** 选中日期所在月的最后一天，正确处理 2 月与闰年 */
function getMonthEnd(key) {
  const d = dateKeyToDate(key);
  const y = d.getFullYear();
  const m = d.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

export {
  weekdayMap,
  weekdayShortMap,
  enWeekdayMap,
  getTodayKey,
  dateKeyToDate,
  dateToKey,
  addDaysToKey,
  addDays,
  formatDateLabel,
  formatWeekdayShort,
  getMonthStart,
  getMonthEnd,
};
