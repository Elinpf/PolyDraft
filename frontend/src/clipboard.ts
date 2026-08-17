// ============ 剪贴板复制 ============
// navigator.clipboard 在非安全上下文（http://非localhost）不可用，
// 且 Promise 可能因 focus/权限 reject。降级到 execCommand 保证兼容。
// 返回是否成功。

export async function copyText(text: string): Promise<boolean> {
  // 优先现代 API
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch { /* 落到降级 */ }
  }
  // 降级：临时 textarea + execCommand
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
