/**
 * 轻量复制工具：优先 clipboard API，失败时 fallback 到 execCommand。
 * 不抛错、不处理 UI 状态，仅返回是否复制成功。
 */

/**
 * 将文本写入剪贴板。
 * @param {string} text - 要复制的文本
 * @returns {Promise<boolean>} 任一方式成功返回 true，都失败返回 false
 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
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
      return true;
    } catch {
      return false;
    }
  }
}
