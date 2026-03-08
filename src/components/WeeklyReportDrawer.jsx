// src/components/WeeklyReportDrawer.jsx
/** 周报抽屉：过去 7 天任务统计、AI 总结、复制（含/不含 AI）。 */
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, X } from "lucide-react";

export default function WeeklyReportDrawer({
  open,
  onClose,
  weeklyReport,
  aiLoading,
  aiError,
  aiResult,
  isCopied,
  isCopiedWithAi,
  onAiSummary,
  onCopyWeekly,
  onCopyWithAi,
  getTagLabel,
  taskTagOptions,
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
          {/* 遮罩 */}
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={onClose}
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
                  onClick={onClose}
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

              {Object.keys(weeklyReport.tagStats).length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-gray-500 mb-1.5">按标签统计</div>
                  <div className="flex flex-wrap gap-2">
                    {taskTagOptions.map((o) => o.value)
                      .filter((value) => weeklyReport.tagStats[value])
                      .map((value) => (
                        <div
                          key={value || "_unset"}
                          className="rounded-xl bg-slate-50 ring-1 ring-slate-50 ring-inset px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-gray-700">
                            {getTagLabel(value)}：{weeklyReport.tagStats[value].total} / {weeklyReport.tagStats[value].completed}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* AI 总结 */}
            <div className="px-5 py-3 border-b border-gray-100 space-y-3">
              <button
                type="button"
                disabled={aiLoading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-100 text-indigo-700 px-4 py-2.5 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] transition-transform"
                onClick={onAiSummary}
              >
                {aiLoading ? "生成中…" : "AI总结"}
              </button>
              {aiError && (
                <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 flex flex-col gap-2">
                  <p className="break-words">{aiError}</p>
                  <button
                    type="button"
                    className="self-start rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-800 active:scale-95"
                    onClick={onAiSummary}
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
                onClick={onCopyWeekly}
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
                onClick={onCopyWithAi}
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
  );
}
