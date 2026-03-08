// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import {
  ArrowLeft,
  Book,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  ShieldCheck,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import InstallPrompt from "./InstallPrompt.jsx";
import MonthlyReportDrawer from "./components/MonthlyReportDrawer.jsx";
import TrendDrawer from "./components/TrendDrawer.jsx";
import WeeklyReportDrawer from "./components/WeeklyReportDrawer.jsx";
import {
  addDaysToKey,
  dateKeyToDate,
  enWeekdayMap,
  formatDateLabel,
  formatWeekdayShort,
  getMonthEnd,
  getMonthStart,
  getTodayKey,
} from "./utils/date.js";
import { getTagLabel, isTagValue, normalizeTag, TASK_TAG_OPTIONS } from "./utils/taskTags.js";
import { requestAiMonthlySummary, requestAiWeeklySummary } from "./services/ai.js";
import {
  buildMonthlyAiPayload,
  buildWeeklyAiPayload,
  buildWeeklyMarkdownWithAi,
  computeMonthlyCalendarGrid,
  computeMonthlyDetailDayData,
  computeMonthlyDaysForAi,
  computeMonthlyReport,
  computeRecentWeeklyTrends,
  computeWeeklyReport,
} from "./utils/reports.js";
import { copyText } from "./utils/clipboard.js";

const STORAGE_KEY = "diary_tasks";

/** 任务列表筛选项「全部」的 value，仅用于前端筛选状态，不写入任务数据 */
const TASK_FILTER_ALL = "ALL";

const DIARIES_KEY = "diary_daily_entries";

const getInitialDiaries = () => {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(DIARIES_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
};

function TaskItem({ task, onToggle, onDelete, highlight, tagLabel }) {
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
        {tagLabel && (
          <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-gray-200/80 text-gray-600">
            {tagLabel}
          </span>
        )}
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
      if (Array.isArray(parsed)) {
        return parsed.map((t) => ({
          ...t,
          tag: normalizeTag(t.tag)
        }));
      }
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
      date: todayKey,
      tag: ""
    },
    {
      id: Date.now() - 3000,
      text: "整理今天的三件重要任务",
      isCompleted: true,
      date: todayKey,
      tag: ""
    },
    {
      id: Date.now() - 2000,
      text: "晚上复盘今天的情绪与收获",
      isCompleted: false,
      date: todayKey,
      tag: ""
    },
    {
      id: Date.now() - 1000,
      text: "为明天预留 10 分钟计划时间",
      isCompleted: true,
      date: todayKey,
      tag: ""
    }
  ];
};

function App() {
  const [tasks, setTasks] = useState(getInitialTasks);
  const [input, setInput] = useState("");
  const [taskTag, setTaskTag] = useState("");
  const todayKey = useMemo(() => getTodayKey(), []);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [selectedTaskFilterTag, setSelectedTaskFilterTag] = useState(TASK_FILTER_ALL);
  const [highlightTaskId, setHighlightTaskId] = useState(null);
  const highlightTimerRef = useRef(null);
  const [isWeeklyOpen, setIsWeeklyOpen] = useState(false);
  const [isMonthlyOpen, setIsMonthlyOpen] = useState(false);
  const [isTrendOpen, setIsTrendOpen] = useState(false);
  /** 月报 Drawer 内当前选中的日期，用于月历点击与单日详情展示；打开时重置为 selectedDate */
  const [monthlyDetailDate, setMonthlyDetailDate] = useState(null);
  const [isCopied, setIsCopied] = useState(false);
  const copiedTimerRef = useRef(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [monthlyAiLoading, setMonthlyAiLoading] = useState(false);
  const [monthlyAiError, setMonthlyAiError] = useState(null);
  const [monthlyAiResult, setMonthlyAiResult] = useState(null);

  const [diaries, setDiaries] = useState(getInitialDiaries);
  const [viewMode, setViewMode] = useState("home");
  const [diaryMode, setDiaryMode] = useState("read");
  const [diaryInput, setDiaryInput] = useState("");
  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionCursorPos, setMentionCursorPos] = useState(null);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [copiedType, setCopiedType] = useState("");

  const selectedDateLabel = useMemo(() => formatDateLabel(selectedDate), [selectedDate]);
  const isToday = selectedDate === todayKey;

  const filteredTasks = useMemo(
    () => tasks.filter((t) => t.date === selectedDate),
    [tasks, selectedDate]
  );

  /** 任务视图中展示的列表：先按日期，再按选中标签筛选（仅用于任务列表视图） */
  const displayedTasksInTaskView = useMemo(() => {
    if (selectedTaskFilterTag === TASK_FILTER_ALL) return filteredTasks;
    return filteredTasks.filter((t) => normalizeTag(t.tag) === selectedTaskFilterTag);
  }, [filteredTasks, selectedTaskFilterTag]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // ignore write errors
    }
  }, [tasks]);

  /** 打开月报 Drawer 时，默认选中 selectedDate；若不在当月则选当月第一天 */
  useEffect(() => {
    if (!isMonthlyOpen) return;
    const start = getMonthStart(selectedDate);
    const end = getMonthEnd(selectedDate);
    const inRange = selectedDate >= start && selectedDate <= end;
    setMonthlyDetailDate(inRange ? selectedDate : start);
  }, [isMonthlyOpen, selectedDate]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    };
  }, []);

  /** 卸载时清理周报/月报复制定时器，避免泄漏 */
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      if (copiedWithAiTimerRef.current) window.clearTimeout(copiedWithAiTimerRef.current);
      if (monthlyCopiedTimerRef.current) window.clearTimeout(monthlyCopiedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isWeeklyOpen) {
      setAiError(null);
      setAiResult(null);
    }
  }, [isWeeklyOpen]);

  useEffect(() => {
    if (!isMonthlyOpen) {
      setMonthlyAiError(null);
      setMonthlyAiResult(null);
    }
  }, [isMonthlyOpen]);

  useEffect(() => {
    try {
      window.localStorage.setItem(DIARIES_KEY, JSON.stringify(diaries));
    } catch {}
  }, [diaries]);

  const handleAddTask = () => {
    const text = input.trim();
    if (!text) return;

    const id = Date.now();
    const newTask = {
      id,
      text,
      isCompleted: false,
      date: selectedDate,
      tag: isTagValue(taskTag) ? taskTag : ""
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

  const handleDiaryChange = (e) => {
    const val = e.target.value;
    setDiaryInput(val);
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@([^\s@]*)$/);
    if (match) {
      setMentionQuery(match[1].toLowerCase());
      setShowMention(true);
      setMentionCursorPos(cursorPos - match[1].length - 1);
    } else {
      setShowMention(false);
    }
  };

  const handleSelectMention = (taskText) => {
    const before = diaryInput.slice(0, mentionCursorPos);
    const after = diaryInput.slice(mentionCursorPos + 1 + mentionQuery.length);
    const insertText = `\n> 🎯 任务：${taskText}\n`;
    setDiaryInput(before + insertText + after);
    setShowMention(false);
  };

  const handleSaveDiary = () => {
    setDiaries((prev) => ({
      ...prev,
      [selectedDate]: diaryInput
    }));
    setDiaryMode("read");
  };

  const handleEditDiary = () => {
    setDiaryInput(diaries[selectedDate] || "");
    setDiaryMode("edit");
  };

  const renderDiaryContent = (text) => {
    if (!text)
      return (
        <p className="text-sm text-gray-400 mt-4 text-center">
          今天还没有写日记，点击右上角开始记录吧...
        </p>
      );
    return text.split("\n").map((line, i) => {
      if (line.startsWith("> 🎯 任务：")) {
        const taskName = line.replace("> 🎯 任务：", "").trim();
        return (
          <div
            key={i}
            className="my-3 p-3 bg-indigo-50/80 border-l-4 border-indigo-400 rounded-r-xl shadow-sm"
          >
            <span className="text-xs font-semibold text-indigo-500 mb-1 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              关联任务
            </span>
            <p className="text-sm text-gray-800 font-medium">{taskName}</p>
          </div>
        );
      }
      return (
        <p key={i} className="text-sm text-gray-700 min-h-[1.5rem] leading-relaxed">
          {line}
        </p>
      );
    });
  };

  const weeklyReport = useMemo(
    () => computeWeeklyReport(selectedDate, tasks),
    [selectedDate, tasks]
  );

  /** 最近 4 周趋势：以 selectedDate 所在周为最后一周，向前 3 周，共 4 周；每周统计与周报口径一致（连续 7 天，end 为当周最后一天） */
  const recentWeeklyTrends = useMemo(
    () => computeRecentWeeklyTrends(selectedDate, tasks),
    [selectedDate, tasks]
  );

  const monthlyReport = useMemo(
    () => computeMonthlyReport(selectedDate, tasks),
    [selectedDate, tasks]
  );

  /** 月报月历网格：7 列（周一～周日），每格含 dateKey | null、dayNumber、total、completed、hasDiary */
  const monthlyCalendarGrid = useMemo(
    () => computeMonthlyCalendarGrid(selectedDate, tasks, diaries),
    [selectedDate, tasks, diaries]
  );

  /** 月报单日详情：当前选中日的任务与日记，用于详情卡片 */
  const monthlyDetailDayData = useMemo(
    () => computeMonthlyDetailDayData(monthlyDetailDate, selectedDate, tasks, diaries),
    [monthlyDetailDate, selectedDate, tasks, diaries]
  );

  /** 本月内有任务或有日记的日期（升序），用于月报 AI payload */
  const monthlyDaysForAi = useMemo(
    () => computeMonthlyDaysForAi(selectedDate, tasks, diaries),
    [selectedDate, tasks, diaries]
  );

  const hasMonthlyDataForAi = monthlyDaysForAi.length > 0;

  const handleMonthlyAiSummary = async () => {
    if (!hasMonthlyDataForAi) return;
    setMonthlyAiError(null);
    setMonthlyAiLoading(true);
    const payload = buildMonthlyAiPayload(monthlyReport, monthlyDaysForAi);
    try {
      const result = await requestAiMonthlySummary(payload);
      setMonthlyAiResult(result);
    } catch (e) {
      console.error("[Monthly AI Summary]", e?.message);
      const message =
        e?.isAbort || e?.message === "timeout"
          ? "请求超时，请稍后重试"
          : e?.message === "Failed to fetch"
            ? "网络错误，请检查后端是否启动"
            : e?.snippet
              ? `请求失败：${String(e.snippet).slice(0, 60)}…`
              : `请求失败：${e?.message || "未知错误"}`;
      setMonthlyAiError(message);
    } finally {
      setMonthlyAiLoading(false);
    }
  };

  const handleAiSummary = async () => {
    setAiError(null);
    setAiLoading(true);
    const payload = buildWeeklyAiPayload(weeklyReport, diaries);
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

  const handleCopyWeekly = async () => {
    const ok = await copyText(weeklyReport.markdown);
    if (ok) {
      setIsCopied(true);
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const [isCopiedWithAi, setIsCopiedWithAi] = useState(false);
  const copiedWithAiTimerRef = useRef(null);
  const [isMonthlyCopied, setIsMonthlyCopied] = useState(false);
  const monthlyCopiedTimerRef = useRef(null);

  const handleCopyWithAi = async () => {
    const text = buildWeeklyMarkdownWithAi(weeklyReport.markdown, aiResult);
    const ok = await copyText(text);
    if (ok) {
      setIsCopiedWithAi(true);
      if (copiedWithAiTimerRef.current) window.clearTimeout(copiedWithAiTimerRef.current);
      copiedWithAiTimerRef.current = window.setTimeout(() => setIsCopiedWithAi(false), 2000);
    }
  };

  const handleCopyMonthly = async () => {
    const ok = await copyText(monthlyReport.markdown);
    if (ok) {
      setIsMonthlyCopied(true);
      if (monthlyCopiedTimerRef.current) window.clearTimeout(monthlyCopiedTimerRef.current);
      monthlyCopiedTimerRef.current = window.setTimeout(() => setIsMonthlyCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-6">
      <InstallPrompt />
      <div className="w-full max-w-md bg-[#fdfcf9] sm:rounded-3xl sm:shadow-xl flex flex-col overflow-hidden relative h-[100dvh] sm:h-screen sm:max-h-[90vh]">

        {/* =============== 1. 首页视图 (Home) =============== */}
        {viewMode === "home" && (
          <div className="flex flex-col h-full w-full relative">
            <header className="px-5 pt-6 pb-2 flex justify-between items-center z-10">
              <button type="button" onClick={handlePrevDay} className="p-2.5 rounded-full border border-gray-200 text-gray-400 bg-white hover:text-gray-600 active:scale-95 transition-transform">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setIsWeeklyOpen(true)} className="p-2.5 rounded-full border border-gray-200 text-gray-500 bg-white hover:bg-gray-50 active:scale-95 transition-transform" title="周报">
                  <FileText className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setIsMonthlyOpen(true)} className="p-2.5 rounded-full border border-gray-200 text-gray-500 bg-white hover:bg-gray-50 active:scale-95 transition-transform" title="月报">
                  <Calendar className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setIsTrendOpen(true)} className="p-2.5 rounded-full border border-gray-200 text-gray-500 bg-white hover:bg-gray-50 active:scale-95 transition-transform" title="趋势">
                  <TrendingUp className="w-4 h-4" />
                </button>
              </div>
              <button type="button" onClick={handleNextDay} className="p-2.5 rounded-full border border-gray-200 text-gray-400 bg-white hover:text-gray-600 active:scale-95 transition-transform">
                <ChevronRight className="w-4 h-4" />
              </button>
            </header>

            <div className="flex-1 flex flex-col items-center justify-center -mt-16">
              <span className="text-sm font-medium tracking-[0.2em] text-gray-400 uppercase mb-3">
                {isToday ? "Today" : selectedDate}
              </span>
              <h1 className="text-5xl sm:text-6xl font-serif text-slate-800 tracking-widest text-center px-4">
                {enWeekdayMap[dateKeyToDate(selectedDate).getDay()]}
              </h1>
              <p className="mt-4 text-sm text-gray-400">{formatWeekdayShort(selectedDate)}</p>
            </div>

            <div className="px-5 pb-8 flex gap-4 w-full">
              <button
                type="button"
                onClick={() => setViewMode("tasks")}
                className="flex-1 h-44 rounded-[2rem] bg-[#9cb3c9] text-white p-5 flex flex-col justify-between shadow-md shadow-[#9cb3c9]/30 active:scale-95 transition-transform text-left"
              >
                <div className="w-10 h-10 rounded-full bg-white/25 flex items-center justify-center backdrop-blur-sm">
                  <CheckSquare className="text-white w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-1">任务</h3>
                  <p className="text-sm text-white/80">{filteredTasks.length} 个待办</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setViewMode("diary"); setDiaryMode("read"); }}
                className="flex-1 h-44 rounded-[2rem] bg-[#c2a8a4] text-white p-5 flex flex-col justify-between shadow-md shadow-[#c2a8a4]/30 active:scale-95 transition-transform text-left"
              >
                <div className="w-10 h-10 rounded-full bg-white/25 flex items-center justify-center backdrop-blur-sm">
                  <Book className="text-white w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-1">日记</h3>
                  <p className="text-sm text-white/80">{diaries[selectedDate] ? "已记录" : "未记录"}</p>
                </div>
              </button>
            </div>
            {/* 反馈与联系入口 */}
            <div className="pb-8 pt-2 flex justify-center w-full">
              <button
                type="button"
                onClick={() => {
                  setIsContactOpen(true);
                  setIsVerified(false);
                }}
                className="text-xs text-gray-400 hover:text-[#c2a8a4] active:scale-95 transition-all flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>联系开发者 / 反馈建议</span>
              </button>
            </div>
          </div>
        )}

        {/* =============== 2. 任务列表视图 (Tasks) =============== */}
        {viewMode === "tasks" && (
          <div className="flex flex-col h-full bg-[#fdfcf9]">
            <header className="px-5 pt-4 pb-3 border-b border-gray-100/50 flex items-center justify-between bg-[#fdfcf9]">
              <button type="button" onClick={() => setViewMode("home")} className="p-2 -ml-2 text-gray-500 hover:text-gray-800 active:scale-95 transition-transform">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-base font-semibold text-gray-900">{selectedDateLabel} - 任务</span>
              <div className="w-9" />
            </header>

            {/* 按标签筛选：仅任务列表视图 */}
            <div className="px-5 py-2 border-b border-gray-100/50 bg-[#fdfcf9] overflow-x-auto">
              <div className="flex gap-2 min-w-0">
                {[{ value: TASK_FILTER_ALL, label: "全部" }, ...TASK_TAG_OPTIONS].map((opt) => (
                  <button
                    key={opt.value === "" ? "_empty" : opt.value}
                    type="button"
                    onClick={() => setSelectedTaskFilterTag(opt.value)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      selectedTaskFilterTag === opt.value
                        ? "bg-[#9cb3c9] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <main className="flex-1 px-5 pt-4 pb-24 overflow-y-auto bg-[#fdfcf9]">
              <AnimatePresence initial={false}>
                {displayedTasksInTaskView.length === 0 ? (
                  <p className="text-sm text-gray-400 mt-4 text-center">
                    {filteredTasks.length === 0
                      ? "还没有添加任务，在下方输入吧。"
                      : "当前标签下还没有任务。"}
                  </p>
                ) : (
                  displayedTasksInTaskView.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={handleToggleTask}
                      onDelete={handleDeleteTask}
                      highlight={task.id === highlightTaskId}
                      tagLabel={getTagLabel(task.tag)}
                    />
                  ))
                )}
              </AnimatePresence>
            </main>

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#fdfcf9] via-[#fdfcf9] to-transparent pb-4 pt-8">
              <div className="px-4">
                <div className="mx-auto w-full max-w-md rounded-full bg-white shadow-lg border border-gray-100 px-3.5 py-2.5 flex items-center gap-2">
                    <select
                      value={taskTag}
                      onChange={(e) => setTaskTag(e.target.value)}
                      className="flex-shrink-0 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-[#9cb3c9]"
                      aria-label="任务标签"
                    >
                      <option value="">未分类</option>
                      {TASK_TAG_OPTIONS.filter((o) => o.value !== "").map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="快速记录任务…"
                      className="flex-1 bg-transparent outline-none text-base text-gray-900 placeholder:text-gray-400"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                    />
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#9cb3c9] text-white shadow-sm active:scale-95 transition-transform disabled:opacity-40"
                      disabled={!input.trim()}
                      onClick={handleAddTask}
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
        )}

        {/* =============== 3. 日记视图 (Diary) =============== */}
        {viewMode === "diary" && (
          <div className="flex flex-col h-full bg-[#fdfcf9]">
            <header className="px-5 pt-4 pb-3 border-b border-gray-100/50 flex items-center justify-between bg-[#fdfcf9]">
              <button type="button" onClick={() => setViewMode("home")} className="p-2 -ml-2 text-gray-500 hover:text-gray-800 active:scale-95 transition-transform">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-base font-semibold text-gray-900">{selectedDateLabel} - 日记</span>
              {diaryMode === "read" ? (
                <button type="button" onClick={handleEditDiary} className="text-sm text-[#c2a8a4] font-medium bg-[#c2a8a4]/10 px-3 py-1.5 rounded-full active:scale-95 transition-transform">
                  {diaries[selectedDate] ? "编辑" : "编写"}
                </button>
              ) : (
                <button type="button" onClick={handleSaveDiary} className="text-sm text-white font-medium bg-[#c2a8a4] px-3 py-1.5 rounded-full shadow-sm active:scale-95 transition-transform">
                  保存
                </button>
              )}
            </header>

            <main className="flex-1 p-5 overflow-y-auto bg-[#fdfcf9] relative">
              {diaryMode === "read" ? (
                <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-gray-100 min-h-[50vh]">
                  {renderDiaryContent(diaries[selectedDate])}
                </div>
              ) : (
                <div className="relative h-full min-h-[60vh] flex flex-col">
                  <textarea
                    autoFocus
                    value={diaryInput}
                    onChange={handleDiaryChange}
                    placeholder="写下今天的日记... (输入 @ 引用今天的任务)"
                    className="w-full flex-1 p-5 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#c2a8a4]/50 text-base leading-relaxed resize-none bg-white/80"
                  />
                  {showMention && (
                    <div className="absolute bottom-4 left-4 right-4 bg-white shadow-xl rounded-xl border border-gray-100 overflow-hidden z-10">
                      <div className="bg-gray-50 px-3 py-2 text-xs text-gray-500 font-medium border-b border-gray-100">
                        选择要引用的任务
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {filteredTasks
                          .filter((t) => t.text.toLowerCase().includes(mentionQuery))
                          .map((task) => (
                            <button
                              key={task.id}
                              type="button"
                              onClick={() => handleSelectMention(task.text)}
                              className="w-full text-left px-4 py-3 text-sm hover:bg-[#c2a8a4]/10 flex items-center gap-2 border-b border-gray-50 last:border-0"
                            >
                              <span className={`w-2 h-2 rounded-full ${task.isCompleted ? "bg-[#c2a8a4]" : "bg-gray-300"}`} />
                              <span className={task.isCompleted ? "text-gray-500 line-through" : "text-gray-800"}>{task.text}</span>
                            </button>
                          ))}
                        {filteredTasks.filter((t) => t.text.toLowerCase().includes(mentionQuery)).length === 0 && (
                          <div className="px-4 py-3 text-sm text-gray-400 text-center">没有匹配的任务</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </main>
          </div>
        )}
      </div>

      {/* 周报 Drawer（过去 7 天） */}
      <WeeklyReportDrawer
        open={isWeeklyOpen}
        onClose={() => setIsWeeklyOpen(false)}
        weeklyReport={weeklyReport}
        aiLoading={aiLoading}
        aiError={aiError}
        aiResult={aiResult}
        isCopied={isCopied}
        isCopiedWithAi={isCopiedWithAi}
        onAiSummary={handleAiSummary}
        onCopyWeekly={handleCopyWeekly}
        onCopyWithAi={handleCopyWithAi}
        getTagLabel={getTagLabel}
        taskTagOptions={TASK_TAG_OPTIONS}
      />

      <MonthlyReportDrawer
        open={isMonthlyOpen}
        onClose={() => setIsMonthlyOpen(false)}
        monthlyReport={monthlyReport}
        monthlyCalendarGrid={monthlyCalendarGrid}
        monthlyDetailDate={monthlyDetailDate}
        monthlyDetailDayData={monthlyDetailDayData}
        selectedDate={selectedDate}
        monthlyAiLoading={monthlyAiLoading}
        monthlyAiError={monthlyAiError}
        monthlyAiResult={monthlyAiResult}
        hasMonthlyDataForAi={hasMonthlyDataForAi}
        isMonthlyCopied={isMonthlyCopied}
        onSelectDetailDate={setMonthlyDetailDate}
        onMonthlyAiSummary={handleMonthlyAiSummary}
        onCopyMonthly={handleCopyMonthly}
        getTagLabel={getTagLabel}
        normalizeTag={normalizeTag}
        taskTagOptions={TASK_TAG_OPTIONS}
        dateKeyToDate={dateKeyToDate}
        getMonthStart={getMonthStart}
      />

      {/* 趋势 Drawer（最近 4 周） */}
      <TrendDrawer
        open={isTrendOpen}
        onClose={() => setIsTrendOpen(false)}
        weeks={recentWeeklyTrends}
      />

      {/* =============== 开发者联系方式弹窗 =============== */}
      <AnimatePresence>
        {isContactOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm px-5"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="w-full max-w-sm bg-[#fdfcf9] rounded-3xl p-6 shadow-2xl border border-gray-100/50 flex flex-col items-center relative"
            >
              <button
                type="button"
                onClick={() => setIsContactOpen(false)}
                className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {!isVerified ? (
                <div className="flex flex-col items-center py-6">
                  <div className="w-16 h-16 bg-[#9cb3c9]/10 rounded-full flex items-center justify-center mb-4 text-[#9cb3c9]">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">安全验证</h3>
                  <p className="text-sm text-gray-500 text-center mb-6">
                    为了防止恶意采集，请点击下方按钮<br />以查看开发者联系方式。
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsVerifying(true);
                      setTimeout(() => {
                        setIsVerifying(false);
                        setIsVerified(true);
                      }, 1200);
                    }}
                    disabled={isVerifying}
                    className="w-full max-w-[200px] py-3 rounded-2xl bg-[#9cb3c9] text-white font-medium shadow-md shadow-[#9cb3c9]/30 active:scale-95 transition-all flex justify-center items-center gap-2"
                  >
                    {isVerifying ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> 验证中...</>
                    ) : (
                      "点击进行人机验证"
                    )}
                  </button>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full pt-2 pb-2"
                >
                  <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-4 mx-auto text-green-500">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-6 text-center">联系开发者</h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3.5 bg-white/80 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-3 text-gray-600">
                        <MessageCircle className="w-5 h-5 text-[#9cb3c9]" />
                        <span className="font-medium tracking-wide">1773217335</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText("1773217335");
                          setCopiedType("qq");
                          setTimeout(() => setCopiedType(""), 2000);
                        }}
                        className="px-3 py-1.5 bg-[#fdfcf9] text-xs text-gray-500 rounded-xl hover:text-[#9cb3c9] transition-colors flex items-center gap-1 border border-gray-100"
                      >
                        {copiedType === "qq" ? <span className="text-green-500">已复制</span> : <><Copy className="w-3 h-3" /> 复制</>}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-white/80 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-3 text-gray-600">
                        <Mail className="w-5 h-5 text-[#c2a8a4]" />
                        <span className="font-medium text-sm">1773217335@qq.com</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText("1773217335@qq.com");
                          setCopiedType("email");
                          setTimeout(() => setCopiedType(""), 2000);
                        }}
                        className="px-3 py-1.5 bg-[#fdfcf9] text-xs text-gray-500 rounded-xl hover:text-[#c2a8a4] transition-colors flex items-center gap-1 border border-gray-100"
                      >
                        {copiedType === "email" ? <span className="text-green-500">已复制</span> : <><Copy className="w-3 h-3" /> 复制</>}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
