/**
 * 任务标签系统：配置与工具逻辑（single source of truth）
 * 供任务列表、周报统计、AI payload 等使用。
 */

/** 任务标签配置：value 存数据，label 做展示 */
export const TASK_TAG_OPTIONS = [
  { value: "", label: "未分类" },
  { value: "work", label: "工作" },
  { value: "study", label: "学习" },
  { value: "life", label: "生活" },
  { value: "fitness", label: "健身" }
];

const TASK_TAG_VALUES = new Set(TASK_TAG_OPTIONS.map((o) => o.value));

/** 根据 tag value 获取中文 label */
export function getTagLabel(tagValue) {
  if (typeof tagValue !== "string") return "未分类";
  const opt = TASK_TAG_OPTIONS.find((o) => o.value === tagValue);
  return opt ? opt.label : "未分类";
}

/** 判断是否为合法 tag value */
export function isTagValue(tagValue) {
  return typeof tagValue === "string" && TASK_TAG_VALUES.has(tagValue);
}

/** 旧数据归一化：中文或非法值 -> 稳定 value */
export function normalizeTag(tag) {
  if (tag === "" || tag === undefined || tag === null) return "";
  if (typeof tag !== "string") return "";
  const labelToValue = {
    工作: "work",
    学习: "study",
    生活: "life",
    健身: "fitness"
  };
  if (labelToValue[tag]) return labelToValue[tag];
  return isTagValue(tag) ? tag : "";
}
