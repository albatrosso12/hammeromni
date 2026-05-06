/** @module utils */

export function uuid() {
  return crypto?.randomUUID?.() ?? `p_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function safeText(v) {
  return String(v ?? '').replace(/[&<>"']/g, s => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s]))
}

export function cloneState(v) {
  try { return structuredClone(v) } catch { return JSON.parse(JSON.stringify(v)) }
}

export function debounce(fn, delay) {
  let timer = null
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay) }
}