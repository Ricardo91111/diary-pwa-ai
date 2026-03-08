// src/components/MonthlyReportDrawer.jsx
/** 月报抽屉：当月统计、月历、单日详情、按标签统计、AI 总结、复制。 */
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, X, CheckCircle2, CheckSquare } from "lucide-react";

export default function MonthlyReportDrawer({
  open,
  onClose,
  monthlyReport,
  monthlyCalendarGrid,
  monthlyDetailDate,
  monthlyDetailDayData,
  selectedDate,
  monthlyAiLoading,
  monthlyAiError,
  monthlyAiResult,
  hasMonthlyDataForAi,
  isMonthlyCopied,
  onSelectDetailDate,
  onMonthlyAiSummary,
  onCopyMonthly,
  getTagLabel,
  normalizeTag,
  taskTagOptions,
  dateKeyToDate,
  getMonthStart,
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={onClose}
            aria-label="关闭月报"
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            initial={{ y: 24 }}
            animate={{ y: 0 }}
            exit={{ y: 24 }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-y-auto flex-1 min-h-0">
            <div className="px-5 pt-4 pb-3 border-b border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">月报</h3>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {monthlyReport.start} ~ {monthlyReport.end}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 bg-white active:scale-95 transition-transform"
                  onClick={onClose}
                  aria-label="关闭"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-50 ring-inset px-3 py-2">
                  <div className="text-xs text-gray-500">总任务</div>
                  <div className="mt-0.5 text-lg font-semibold text-gray-900">{monthlyReport.total}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-50 ring-inset px-3 py-2">
                  <div className="text-xs text-gray-500">已完成</div>
                  <div className="mt-0.5 text-lg font-semibold text-gray-900">{monthlyReport.completed}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-50 ring-inset px-3 py-2">
                  <div className="text-xs text-gray-500">完成率</div>
                  <div className="mt-0.5 text-lg font-semibold text-gray-900">{monthlyReport.completionRate}%</div>
                </div>
                <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-50 ring-inset px-3 py-2">
                  <div className="text-xs text-gray-500">活跃天数</div>
                  <div className="mt-0.5 text-lg font-semibold text-gray-900">{monthlyReport.activeDays}</div>
                </div>
              </div>

              {/* 月历网格：周一～周日 */}
              <div className="mt-4">
                <div className="text-xs text-gray-500 mb-2">月历</div>
                <div className="grid grid-cols-7 gap-0.5 text-center">
                  {["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((w) => (
                    <div key={w} className="py-1 text-xs font-medium text-gray-500">
                      {w}
                    </div>
                  ))}
                  {monthlyCalendarGrid.cells.map((cell, idx) => {
                    const isPad = cell.dateKey === null;
                    const isSelected = !isPad && cell.dateKey === (monthlyDetailDate || getMonthStart(selectedDate));
                    let bg = "bg-gray-200/80";
                    if (!isPad) {
                      if (cell.total === 0) bg = "bg-gray-200/80";
                      else if (cell.completed === 0) bg = "bg-orange-200/90";
                      else if (cell.completed < cell.total) bg = "bg-amber-200/90";
                      else bg = "bg-emerald-200/90";
                    }
                    return (
                      <button
                        key={isPad ? `pad-${idx}` : cell.dateKey}
                        type="button"
                        disabled={isPad}
                        onClick={() => !isPad && onSelectDetailDate(cell.dateKey)}
                        className={`min-h-[2.25rem] rounded-lg text-sm font-medium transition-all ${isPad ? "cursor-default bg-transparent" : "active:scale-95 " + bg} ${isSelected ? "ring-2 ring-indigo-500 ring-offset-1" : ""} ${!isPad ? "relative" : ""}`}
                      >
                        {cell.dayNumber ?? ""}
                        {!isPad && cell.hasDiary && (
                          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-indigo-400" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* 图例 */}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-600">
                  <span className="flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 rounded bg-gray-200/80" /> 无任务
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 rounded bg-orange-200/90" /> 有任务未完成
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 rounded bg-amber-200/90" /> 部分完成
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-3.5 w-3.5 rounded bg-emerald-200/90" /> 全部完成
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" /> 有日记
                  </span>
                </div>
              </div>
            </div>

            {/* 单日详情卡片（月历下方） */}
            <div className="px-5 py-3 border-b border-gray-100">
              {monthlyDetailDayData && (
                <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-100 ring-inset p-3 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900">
                    {dateKeyToDate(monthlyDetailDayData.dateKey).getMonth() + 1} 月 {dateKeyToDate(monthlyDetailDayData.dateKey).getDate()} 日 {monthlyDetailDayData.weekdayLabel}
                  </h4>
                  {monthlyDetailDayData.total === 0 && !monthlyDetailDayData.hasDiary ? (
                    <p className="text-sm text-gray-500">当天没有任务和日记记录</p>
                  ) : (
                    <>
                      <div className="flex gap-4 text-xs text-gray-600">
                        <span>总任务：{monthlyDetailDayData.total}</span>
                        <span>已完成：{monthlyDetailDayData.completed}</span>
                        <span>完成率：{monthlyDetailDayData.completionRate}%</span>
                      </div>
                      {monthlyDetailDayData.tasks.length > 0 && (
                        <ul className="space-y-1.5">
                          {monthlyDetailDayData.tasks.map((t) => (
                            <li key={t.id} className="flex items-center gap-2 text-sm">
                              <span className={`flex-shrink-0 ${t.isCompleted ? "text-indigo-500" : "text-gray-400"}`}>
                                {t.isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                              </span>
                              <span className={t.isCompleted ? "line-through text-gray-500" : "text-gray-800"}>{t.text}</span>
                              {normalizeTag(t.tag) && (
                                <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-gray-200/80 text-gray-600">
                                  {getTagLabel(normalizeTag(t.tag))}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div>
                        {monthlyDetailDayData.hasDiary ? (
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{monthlyDetailDayData.diary.trim()}</p>
                        ) : (
                          <p className="text-sm text-gray-400">当天未记录日记</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 按标签统计 */}
            {Object.keys(monthlyReport.tagStats).length > 0 && (
              <div className="px-5 py-3 border-b border-gray-100">
                <div className="text-xs text-gray-500 mb-1.5">按标签统计</div>
                <div className="flex flex-wrap gap-2">
                  {taskTagOptions.map((o) => o.value)
                    .filter((value) => monthlyReport.tagStats[value])
                    .map((value) => (
                      <div
                        key={value || "_unset"}
                        className="rounded-xl bg-slate-50 ring-1 ring-slate-50 ring-inset px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-gray-700">
                          {getTagLabel(value)}：{monthlyReport.tagStats[value].total} / {monthlyReport.tagStats[value].completed}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* 月报 AI 总结 */}
            <div className="px-5 py-3 border-b border-gray-100 space-y-3">
              <button
                type="button"
                disabled={monthlyAiLoading || !hasMonthlyDataForAi}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-100 text-indigo-700 px-4 py-2.5 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] transition-transform"
                onClick={onMonthlyAiSummary}
              >
                {monthlyAiLoading ? "生成中…" : hasMonthlyDataForAi ? "AI总结" : "本月暂无任务或日记"}
              </button>
              {monthlyAiError && (
                <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 flex flex-col gap-2">
                  <p className="break-words">{monthlyAiError}</p>
                  <button
                    type="button"
                    className="self-start rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-800 active:scale-95"
                    onClick={onMonthlyAiSummary}
                  >
                    重试
                  </button>
                </div>
              )}
              {monthlyAiResult && !monthlyAiLoading && (
                <div className="rounded-xl bg-slate-50 ring-1 ring-slate-50 ring-inset px-3 py-2.5 space-y-2 text-sm">
                  <p className="text-gray-800">{monthlyAiResult.comment}</p>
                  {monthlyAiResult.highlights?.length > 0 && (
                    <div>
                      <span className="font-medium text-gray-600">亮点 </span>
                      <ul className="mt-0.5 list-disc list-inside text-gray-700">
                        {monthlyAiResult.highlights.slice(0, 3).map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {monthlyAiResult.suggestions?.length > 0 && (
                    <div>
                      <span className="font-medium text-gray-600">建议 </span>
                      <ul className="mt-0.5 list-disc list-inside text-gray-700">
                        {monthlyAiResult.suggestions.slice(0, 3).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            </div>

            <div className="absolute inset-x-0 bottom-0 bg-white/90 backdrop-blur border-t border-gray-100 px-5 py-3">
              <button
                type="button"
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-indigo-500 text-white px-4 py-3 font-medium shadow-sm active:scale-[0.99] transition-transform"
                onClick={onCopyMonthly}
              >
                {isMonthlyCopied ? (
                  <>
                    <Copy className="h-4 w-4" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    复制月报（Markdown）
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
