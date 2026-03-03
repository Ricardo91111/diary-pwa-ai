// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { ChevronLeft, ChevronRight, Copy, FileText, Send, Trash2, X } from "lucide-react";
import InstallPrompt from "./InstallPrompt.jsx";

const weekdayMap = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

const getTodayKey = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const date = `${d.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${date}`;
};

const dateKeyToDate = (key) => {
  const [y, m, d] = key.split("-").map((n) => Number(n));
  return new Date(y, m - 1, d);
};

const dateToKey = (d) => {
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const date = `${d.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${date}`;
};

const addDaysToKey = (key, deltaDays) => {
  const d = dateKeyToDate(key);
  d.setDate(d.getDate() + deltaDays);
  return dateToKey(d);
};

// 安全的日期加减：基于 new Date(y, m-1, d)，避免时区字符串解析问题
const addDays = (dateStr, deltaDays) => addDaysToKey(dateStr, deltaDays);

const formatDateLabel = (key) => {
  const d = dateKeyToDate(key);
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const weekday = weekdayMap[d.getDay()];
  return `${month}月${date}日 ${weekday}`;
};

const weekdayShortMap = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const formatWeekdayShort = (key) => weekdayShortMap[dateKeyToDate(key).getDay()];

const STORAGE_KEY = "diary_tasks";

const AI_SUMMARY_URL = "/api/weekly-summary";
const AI_SUMMARY_TIMEOUT_MS = 20000;

async function requestAiWeeklySummary(payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_SUMMARY_TIMEOUT_MS);
  try {
    const res = await fetch(AI_SUMMARY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.snippet = data?.snippet;
      throw err;
    }
    if (!data.ok || !data.result) {
      const err = new Error(data?.error || "invalid_response");
      err.snippet = data?.snippet;
      throw err;
    }
    return data.result;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === "AbortError") {
      const err = new Error("timeout");
      err.isAbort = true;
      throw err;
    }
    throw e;
  }
}

function TaskItem({ task, onToggle, onDelete, highlight }) {
  const controls = useAnimationControls();
  const [isDragging, setIsDragging] = useState(false);
  const DELETE_THRESHOLD = -80;
  const MAX_LEFT = -100;

  useEffect(() => {
    if (!highlight) return;
    controls.set({ backgroundColor: "#e0f2fe" });
    controls.start({
      backgroundColor: task.isCompleted ? "#f3f4f6" : "#f8fafc",
      transition: { duration: 0.8, delay: 0.1 }
    });
  }, [controls, highlight, task.isCompleted]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, scale: 0.9, overflow: "hidden" }}
      transition={{ duration: 0.25 }}
      className="relative mb-3 rounded-xl overflow-hidden bg-transparent"
    >
      {/* 2. 底层红色删除区 */}
      <div className="absolute inset-[1px] bg-red-500 flex items-center justify-end pr-4 rounded-xl">
        <Trash2 className="text-white w-5 h-5" />
      </div>

      {/* 3. 顶层滑动区（可左滑） */}
      <motion.div
        className={`relative z-10 p-4 rounded-xl shadow-sm flex items-center gap-3 ring-1 ring-inset transform-gpu will-change-transform touch-pan-y ${
          task.isCompleted ? "bg-gray-100 ring-gray-100" : "bg-slate-50 ring-slate-50"
        }`}
        drag="x"
        dragConstraints={{ left: MAX_LEFT, right: 0 }}
        dragElastic={{ left: 0.2, right: 0.05 }}
        dragMomentum={false}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={(e, info) => {
          setIsDragging(false);
          if (info.offset.x < DELETE_THRESHOLD) {
            onDelete(task.id);
            return;
          }
          controls.start({
            x: 0,
            transition: { type: "spring", stiffness: 420, damping: 38 }
          });
        }}
        animate={controls}
        initial={{ x: 0 }}
        onClick={() => {
          if (isDragging) return;
          onToggle(task.id);
        }}
      >
        <button
          type="button"
          className={`relative inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-all ${
            task.isCompleted ? "border-indigo-500 bg-indigo-500/90" : "border-gray-300 bg-white"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(task.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {task.isCompleted && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
        </button>

        <p
          className={`text-sm leading-snug ${
            task.isCompleted ? "line-through text-gray-400" : "text-gray-800"
          }`}
        >
          {task.text}
        </p>
      </motion.div>
    </motion.div>
  );
}

const getInitialTasks = () => {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore parse errors and fall back to mock data
  }

  const todayKey = getTodayKey();
  return [
    {
      id: Date.now() - 4000,
      text: "早晨写 5 分钟日记",
      isCompleted: false,
      date: todayKey
    },
    {
      id: Date.now() - 3000,
      text: "整理今天的三件重要任务",
      isCompleted: true,
      date: todayKey
    },
    {
      id: Date.now() - 2000,
      text: "晚上复盘今天的情绪与收获",
      isCompleted: false,
      date: todayKey
    },
    {
      id: Date.now() - 1000,
      text: "为明天预留 10 分钟计划时间",
      isCompleted: true,
      date: todayKey
    }
  ];
};

function App() {
  const [tasks, setTasks] = useState(getInitialTasks);
  const [input, setInput] = useState("");
  const todayKey = useMemo(() => getTodayKey(), []);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [highlightTaskId, setHighlightTaskId] = useState(null);
  const highlightTimerRef = useRef(null);
  const [isWeeklyOpen, setIsWeeklyOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const copiedTimerRef = useRef(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiResult, setAiResult] = useState(null);

  const selectedDateLabel = useMemo(() => formatDateLabel(selectedDate), [selectedDate]);
  const isToday = selectedDate === todayKey;

  const filteredTasks = useMemo(
    () => tasks.filter((t) => t.date === selectedDate),
    [tasks, selectedDate]
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // ignore write errors
    }
  }, [tasks]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      if (copiedWithAiTimerRef.current) window.clearTimeout(copiedWithAiTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isWeeklyOpen) {
      setAiError(null);
      setAiResult(null);
    }
  }, [isWeeklyOpen]);

  const handleAddTask = () => {
    const text = input.trim();
    if (!text) return;

    const id = Date.now();
    const newTask = {
      id,
      text,
      isCompleted: false,
      date: selectedDate
    };

    setTasks((prev) => [newTask, ...prev]);
    setInput("");
    setHighlightTaskId(id);
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(() => setHighlightTaskId(null), 1200);
  };

  const handleToggleTask = (id) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, isCompleted: !task.isCompleted } : task
      )
    );
  };

  const handleDeleteTask = (id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTask();
    }
  };

  const handlePrevDay = () => setSelectedDate((prev) => addDaysToKey(prev, -1));
  const handleNextDay = () => setSelectedDate((prev) => addDaysToKey(prev, 1));

  const weeklyReport = useMemo(() => {
    const end = selectedDate;
    const datesAsc = Array.from({ length: 7 }, (_, i) => addDays(end, i - 6)); // D-6 ... D
    const start = datesAsc[0];
    const dateSet = new Set(datesAsc);

    const tasksInRange = tasks.filter((t) => dateSet.has(t.date));
    const total = tasksInRange.length;
    const completed = tasksInRange.filter((t) => t.isCompleted).length;
    const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);

    const daysAsc = datesAsc.map((date) => ({
      date,
      weekdayLabel: formatWeekdayShort(date),
      tasks: tasks.filter((t) => t.date === date)
    }));

    const daysDesc = [...daysAsc].reverse();
    const activeDays = daysAsc.filter((d) => d.tasks.length > 0).length;

    const markdown = [
      `# 周报（${start} ~ ${end})`.replace(")", "）").replace("（", "（"), // keep full-width parens
      `- 总任务：${total}`,
      `- 已完成：${completed}`,
      `- 完成率：${completionRate}%`,
      ""
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
      markdown
    };
  }, [selectedDate, tasks]);

  const handleAiSummary = async () => {
    setAiError(null);
    setAiLoading(true);
    const daysAsc = [...weeklyReport.daysDesc].reverse();
    const payload = {
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
        tasks: d.tasks.map((t) => ({ text: t.text, isCompleted: t.isCompleted }))
      }))
    };
    try {
      const result = await requestAiWeeklySummary(payload);
      setAiResult(result);
    } catch (e) {
      console.error("[AI Summary]", e.name, e.message, "status:", e.status);
      const message =
        e.isAbort || e.message === "timeout"
          ? "请求超时，请稍后重试"
          : e.message === "Failed to fetch"
            ? "网络错误，请检查后端是否启动"
            : e.snippet
              ? `请求失败：${e.snippet.slice(0, 60)}…`
              : `请求失败：${e.message || "未知错误"}`;
      setAiError(message);
    } finally {
      setAiLoading(false);
    }
  };

  const getMarkdownWithAi = () => {
    let text = weeklyReport.markdown;
    if (aiResult) {
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
    }
    return text;
  };

  const handleCopyWeekly = async () => {
    try {
      await navigator.clipboard.writeText(weeklyReport.markdown);
      setIsCopied(true);
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setIsCopied(false), 2000);
    } catch {
      try {
        const el = document.createElement("textarea");
        el.value = weeklyReport.markdown;
        el.setAttribute("readonly", "true");
        el.style.position = "fixed";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setIsCopied(true);
        if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = window.setTimeout(() => setIsCopied(false), 2000);
      } catch {
        // ignore
      }
    }
  };

  const [isCopiedWithAi, setIsCopiedWithAi] = useState(false);
  const copiedWithAiTimerRef = useRef(null);

  const handleCopyWithAi = async () => {
    const text = getMarkdownWithAi();
    try {
      await navigator.clipboard.writeText(text);
      setIsCopiedWithAi(true);
      if (copiedWithAiTimerRef.current) window.clearTimeout(copiedWithAiTimerRef.current);
      copiedWithAiTimerRef.current = window.setTimeout(() => setIsCopiedWithAi(false), 2000);
    } catch {
      try {
        const el = document.createElement("textarea");
        el.value = text;
        el.setAttribute("readonly", "true");
        el.style.position = "fixed";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setIsCopiedWithAi(true);
        if (copiedWithAiTimerRef.current) window.clearTimeout(copiedWithAiTimerRef.current);
        copiedWithAiTimerRef.current = window.setTimeout(() => setIsCopiedWithAi(false), 2000);
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-6">
      <InstallPrompt />
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg flex flex-col overflow-hidden relative">
        {/* 顶部日期区 */}
        <header className="px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 bg-white active:scale-95 transition-transform"
              onClick={handlePrevDay}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs font-medium tracking-wide text-indigo-500 uppercase">
                {isToday ? "今天" : "日期"}
              </span>
              <span className="text-base font-semibold text-gray-900">
                {selectedDateLabel}
                {isToday && <span className="ml-1 text-sm font-medium text-gray-400">(今天)</span>}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-gray-200 text-gray-600 bg-white px-3 active:scale-95 transition-transform"
                onClick={() => setIsWeeklyOpen(true)}
              >
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">周报</span>
              </button>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 bg-white active:scale-95 transition-transform"
                onClick={handleNextDay}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* 任务列表区 */}
        <main className="flex-1 px-5 pt-4 pb-24 overflow-y-auto bg-gradient-to-b from-white via-white to-gray-50">
          <section>
            <h2 className="mb-3 text-sm font-medium text-gray-500 tracking-wide">
              {isToday ? "今日任务" : "当天任务"}
            </h2>
            {filteredTasks.length === 0 ? (
              <p className="text-sm text-gray-400">
                {isToday ? "今天还没有任务，试着记录一个小目标吧。" : "这一天还没有任务，试着补记一个目标吧。"}
              </p>
            ) : (
              <AnimatePresence initial={false}>
                {filteredTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={handleToggleTask}
                    onDelete={handleDeleteTask}
                    highlight={task.id === highlightTaskId}
                  />
                ))}
              </AnimatePresence>
            )}
          </section>
        </main>

        {/* 底部输入区 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-4">
          <div className="pointer-events-auto w-full px-4">
            <div className="mx-auto w-full max-w-md rounded-full bg-white shadow-lg shadow-gray-200/70 border border-gray-100 px-3.5 py-2.5 flex items-center gap-2.5">
              <input
                type="text"
                placeholder="快速记录一个任务或想法…"
                className="flex-1 bg-transparent outline-none text-base text-gray-900 placeholder:text-gray-400"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleInputKeyDown}
              />
              <button
                type="button"
                className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500 text-white shadow-sm active:scale-95 transition-transform disabled:opacity-40 disabled:active:scale-100"
                disabled={!input.trim()}
                onClick={handleAddTask}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 周报 Drawer（过去 7 天） */}
      <AnimatePresence>
        {isWeeklyOpen && (
          <motion.div
            className="fixed inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* 遮罩 */}
            <button
              type="button"
              className="absolute inset-0 bg-black/30"
              onClick={() => setIsWeeklyOpen(false)}
              aria-label="关闭周报"
            />

            {/* 抽屉 */}
            <motion.div
              className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl bg-white shadow-2xl overflow-hidden"
              initial={{ y: 24 }}
              animate={{ y: 0 }}
              exit={{ y: 24 }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 pt-4 pb-3 border-b border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">周报（过去7天）</h3>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {weeklyReport.start} ~ {weeklyReport.end}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 bg-white active:scale-95 transition-transform"
                    onClick={() => setIsWeeklyOpen(false)}
                    aria-label="关闭"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-50 ring-inset px-3 py-2">
                    <div className="text-xs text-gray-500">总任务</div>
                    <div className="mt-0.5 text-lg font-semibold text-gray-900">
                      {weeklyReport.total}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-50 ring-inset px-3 py-2">
                    <div className="text-xs text-gray-500">已完成</div>
                    <div className="mt-0.5 text-lg font-semibold text-gray-900">
                      {weeklyReport.completed}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-50 ring-inset px-3 py-2">
                    <div className="text-xs text-gray-500">完成率</div>
                    <div className="mt-0.5 text-lg font-semibold text-gray-900">
                      {weeklyReport.completionRate}%
                    </div>
                  </div>
                </div>
              </div>

              {/* AI 总结 */}
              <div className="px-5 py-3 border-b border-gray-100 space-y-3">
                <button
                  type="button"
                  disabled={aiLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-100 text-indigo-700 px-4 py-2.5 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] transition-transform"
                  onClick={handleAiSummary}
                >
                  {aiLoading ? "生成中…" : "AI总结"}
                </button>
                {aiError && (
                  <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 flex flex-col gap-2">
                    <p className="break-words">{aiError}</p>
                    <button
                      type="button"
                      className="self-start rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-800 active:scale-95"
                      onClick={handleAiSummary}
                    >
                      重试
                    </button>
                  </div>
                )}
                {aiResult && !aiLoading && (
                  <div className="rounded-xl bg-slate-50 ring-1 ring-slate-50 ring-inset px-3 py-2.5 space-y-2 text-sm">
                    <p className="text-gray-800">{aiResult.comment}</p>
                    {aiResult.highlights?.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-600">亮点 </span>
                        <ul className="mt-0.5 list-disc list-inside text-gray-700">
                          {aiResult.highlights.slice(0, 3).map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aiResult.suggestions?.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-600">建议 </span>
                        <ul className="mt-0.5 list-disc list-inside text-gray-700">
                          {aiResult.suggestions.slice(0, 3).map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="max-h-[65vh] overflow-y-auto px-5 py-4 pb-24 bg-gradient-to-b from-white via-white to-gray-50">
                <div className="space-y-4">
                  {weeklyReport.daysDesc.map((day) => (
                    <section key={day.date}>
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-gray-900">
                          {day.date.slice(5)} {day.weekdayLabel}
                        </h4>
                        <span className="text-xs text-gray-400">{day.date}</span>
                      </div>

                      <div className="mt-2 rounded-2xl bg-slate-50 ring-1 ring-slate-50 ring-inset px-3 py-2.5">
                        {day.tasks.length === 0 ? (
                          <p className="text-sm text-gray-400">无任务</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {day.tasks.map((t) => (
                              <li
                                key={t.id}
                                className={`text-sm ${
                                  t.isCompleted ? "text-gray-500" : "text-gray-800"
                                }`}
                              >
                                <span className="font-mono">
                                  - [{t.isCompleted ? "x" : " "}]
                                </span>{" "}
                                <span className={t.isCompleted ? "line-through" : ""}>
                                  {t.text}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              </div>

              {/* 底部复制按钮 */}
              <div className="absolute inset-x-0 bottom-0 bg-white/90 backdrop-blur border-t border-gray-100 px-5 py-3 flex flex-col gap-2">
                <button
                  type="button"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-indigo-500 text-white px-4 py-3 font-medium shadow-sm active:scale-[0.99] transition-transform"
                  onClick={handleCopyWeekly}
                >
                  {isCopied ? (
                    <>
                      <Copy className="h-4 w-4" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      复制周报（Markdown）
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-indigo-500 text-indigo-600 px-4 py-3 font-medium shadow-sm active:scale-[0.99] transition-transform"
                  onClick={handleCopyWithAi}
                >
                  {isCopiedWithAi ? (
                    <>
                      <Copy className="h-4 w-4" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      复制（含AI点评）
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
