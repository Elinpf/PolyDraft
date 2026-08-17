import { useState, useEffect } from 'react'
import type { CandReview, CandSlot, CandVersion, Dimension, Provider, SharedState } from '../types'

// ============ 生成页逻辑 ============
// 纯 state + fetch + SSE + 操作，无 JSX 无 className 无 CSS import。
// 视图层（views/<theme>/GenerateView）接收返回的 logic 对象渲染。
// 状态存在此 hook 中，切主题时 View 组件树更换但 state 保留。

const EMPTY_REVIEW: CandReview = { score: 0, positive: '', reverse: '', accuracy: '', raw: '' }

// 把后端单份 candidate dict（slot/text/style/review/prompts）转成一个初始版本
function toVersion(c: any): CandVersion {
  return {
    text: c.text, review: c.review, edited: c.text,
    finalized: false, reReviewing: false, finalizing: false, generating: false,
    prompts: c.prompts,
  }
}

export function useGenerateLogic(s: SharedState) {
  const [candidates, setCandidates] = useState<CandSlot[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState('')
  const [stage, setStage] = useState<'input' | 'generating' | 'reviewing' | 'done'>('input')
  const [failureDetail, setFailureDetail] = useState<{ slot: number; error: string }[]>([])
  // 模型选择 + 补充输入：就地状态（页面常驻挂载保活），localStorage 持久化
  const [genProvider, setGenProvider] = useState(() => {
    try { const v = localStorage.getItem('copygen_provider'); if (v) return v } catch { /* ignore */ }
    return 'kimi'
  })
  useEffect(() => { try { localStorage.setItem('copygen_provider', genProvider) } catch { /* ignore */ } }, [genProvider])
  // 补充输入：后端持久化（跨设备同步）。启动 fetch 加载，变化 debounce 500ms 保存。
  const [extraInputs, setExtraInputs] = useState<Record<string, string>>({})
  const [extraInputsLoaded, setExtraInputsLoaded] = useState(false)
  useEffect(() => {
    let alive = true
    fetch('/extra-inputs').then((r) => r.json()).then((d: Record<string, string>) => {
      if (!alive) return
      const data = d || {}
      // localStorage 迁移：后端空时读旧 localStorage 上传，迁移后清
      if (Object.keys(data).length === 0) {
        try {
          const saved = localStorage.getItem('copygen_extra_inputs')
          if (saved) {
            const obj = JSON.parse(saved)
            if (obj.brand !== undefined) { obj['品牌'] = obj.brand; delete obj.brand }
            if (obj.tone !== undefined) { delete obj.tone }
            if (obj['语气'] !== undefined) { delete obj['语气'] }
            if (Object.keys(obj).length > 0) {
              setExtraInputs(obj)
              fetch('/extra-inputs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) })
              localStorage.removeItem('copygen_extra_inputs')
              setExtraInputsLoaded(true)
              return
            }
          }
        } catch { /* ignore */ }
        // 后端空 + localStorage 空 → 默认
        setExtraInputs({ '品牌': '爱他美' })
      } else {
        setExtraInputs(data)
      }
      setExtraInputsLoaded(true)
    }).catch(() => { if (alive) setExtraInputsLoaded(true) })
    return () => { alive = false }
  }, [])
  // 变化 debounce 500ms 保存到后端（加载完成前不保存，避免空对象覆盖）
  useEffect(() => {
    if (!extraInputsLoaded) return
    const id = setTimeout(() => {
      fetch('/extra-inputs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(extraInputs) }).catch(() => {})
    }, 500)
    return () => clearTimeout(id)
  }, [extraInputs, extraInputsLoaded])
  const [providers, setProviders] = useState<Provider[]>([])
  useEffect(() => {
    let alive = true
    fetch('/providers').then((r) => r.json()).then((d: Provider[]) => { if (alive) setProviders(d) }).catch(() => {})
    return () => { alive = false }
  }, [])
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [selections, setSelections] = useState<Record<string, string>>({})
  // 选用维度子集：勾选哪些维度渲染哪些下拉。按生成页方案 ID 存（当前 default）。
  const [selectedDims, setSelectedDims] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('copygen_selected_dims_default')
      if (saved) return JSON.parse(saved)
    } catch { /* ignore */ }
    return []  // 空表示首次，loadDims 后用全部维度填充
  })
  useEffect(() => { try { localStorage.setItem('copygen_selected_dims_default', JSON.stringify(selectedDims)) } catch { /* ignore */ } }, [selectedDims])

  async function loadDims() {
    const data: Dimension[] = await (await fetch('/dimensions')).json()
    setDimensions(data)
    // 首次（无存档）默认全勾现有维度；有存档则清理已不存在的维度（悬空清理）
    setSelectedDims((prev) => {
      if (prev.length === 0 && data.length > 0) return data.map((d) => d.name)
      return prev.filter((n) => data.some((d) => d.name === n))
    })
  }
  useEffect(() => { loadDims() }, [s.dimsTick])

  const inputVars = () => extraInputs

  async function parseSSE(r: Response, onEvent: (e: any) => void) {
    const reader = r.body!.getReader()
    const dec = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const parts = buf.split('\n\n')
      buf = parts.pop() || ''
      for (const p of parts) {
        const line = p.trim()
        if (line.startsWith('data: ')) onEvent(JSON.parse(line.slice(6)))
      }
    }
  }

  async function generate() {
    setLoading(true); setError(''); setCandidates([]); setFailureDetail([])
    setStage('generating'); setStatus('生成中…')
    try {
      const r = await fetch('/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input_vars: inputVars(), provider_name: genProvider, selections }) })
      if (!r.ok) throw new Error((await r.json()).detail || '请求失败')
      await parseSSE(r, (e) => {
        if (e.type === 'stage') { setStage(e.stage === 'generating' ? 'generating' : 'reviewing'); setStatus(e.stage === 'generating' ? '生成中…' : '审核中…') }
        else if (e.type === 'gen_progress') setStatus(`生成中 ${e.done}/${e.total}`)
        else if (e.type === 'review_progress') setStatus(`审核中 ${e.done}/${e.total}`)
        else if (e.type === 'done') {
          if (e.error) {
            setError(e.error); setStage('input'); setStatus('')
            setFailureDetail(e.failures || [])
          } else {
            const cs: CandSlot[] = (e.candidates || []).map((c: any) => ({
              slot: c.slot, style: c.style, active: 0, versions: [toVersion(c)],
            }))
            setCandidates(cs); setStage('done'); setStatus('')
          }
        }
      })
    } catch (e) { setError(String(e)); setStage('input'); setStatus('') } finally { setLoading(false) }
  }

  function patchCand(i: number, p: Partial<CandVersion>) {
    setCandidates((cs) => cs.map((s, idx) => {
      if (idx !== i) return s
      const vs = [...s.versions]
      vs[s.active] = { ...vs[s.active], ...p }
      return { ...s, versions: vs }
    }))
  }

  // 版本切换：在槽位 i 的版本列表内左右移动 active（边界内）
  function moveVersion(i: number, delta: number) {
    setCandidates((cs) => cs.map((s, idx) => {
      if (idx !== i) return s
      const next = Math.max(0, Math.min(s.versions.length - 1, s.active + delta))
      return { ...s, active: next }
    }))
  }

  // 单槽位重新生成：追加一版占位（generating）并切到它，结果回来后填入
  async function regenerateOne(i: number) {
    const s0 = candidates[i]
    if (!s0) return
    const placeholder: CandVersion = { text: '', review: { ...EMPTY_REVIEW }, edited: '', finalized: false, reReviewing: false, finalizing: false, generating: true }
    const newActive = s0.versions.length
    setCandidates((cs) => cs.map((s, idx) => (idx === i ? { ...s, versions: [...s.versions, placeholder], active: newActive } : s)))
    setStatus(`重新生成「${s0.style}」…`)
    try {
      const r = await fetch('/generate-one', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slot: s0.slot, input_vars: inputVars(), selections, provider_name: genProvider }) })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || '重新生成失败')
      setCandidates((cs) => cs.map((s, idx) => {
        if (idx !== i) return s
        const vs = [...s.versions]
        vs[newActive] = toVersion(data)
        return { ...s, versions: vs }
      }))
      setStatus('')
    } catch (e) { setStatus(''); alert(String(e)) } finally {
      // 清掉 generating 标记（若上面 patch 已覆盖则无副作用）
      setCandidates((cs) => cs.map((s, idx) => {
        if (idx !== i) return s
        const vs = [...s.versions]
        vs[newActive] = { ...vs[newActive], generating: false }
        return { ...s, versions: vs }
      }))
    }
  }

  // 全部重新生成：复用 /generate 流，结果作为新版本追加到每个对应槽位并切到新版
  async function regenerateAll() {
    if (candidates.length === 0) return
    setRegenerating(true); setError(''); setStatus('重新生成全部…')
    // 标记每个槽位追加一版占位并切过去
    setCandidates((cs) => cs.map((s) => {
      const placeholder: CandVersion = { text: '', review: { ...EMPTY_REVIEW }, edited: '', finalized: false, reReviewing: false, finalizing: false, generating: true }
      return { ...s, versions: [...s.versions, placeholder], active: s.versions.length }
    }))
    try {
      const r = await fetch('/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input_vars: inputVars(), provider_name: genProvider, selections }) })
      if (!r.ok) throw new Error((await r.json()).detail || '请求失败')
      const pending: Record<number, CandVersion> = {}
      await parseSSE(r, (e) => {
        if (e.type === 'stage') setStatus(e.stage === 'generating' ? `重新生成中…` : `重新审核中…`)
        else if (e.type === 'gen_progress') setStatus(`重新生成中 ${e.done}/${e.total}`)
        else if (e.type === 'review_progress') setStatus(`重新审核中 ${e.done}/${e.total}`)
        else if (e.type === 'done') {
          if (e.error) { setError(e.error); setFailureDetail(e.failures || []) }
          for (const c of (e.candidates || [])) pending[c.slot] = toVersion(c)
        }
      })
      // 把结果填入各槽位的最后一版占位；无结果的槽位保留占位并清 generating
      setCandidates((cs) => cs.map((s) => {
        const last = s.versions.length - 1
        const filled = pending[s.slot]
        const vs = [...s.versions]
        vs[last] = filled ? { ...filled } : { ...vs[last], generating: false }
        return { ...s, versions: vs, active: last }
      }))
      setStatus('')
    } catch (e) { setError(String(e)); setStatus('') } finally { setRegenerating(false) }
  }

  async function doFinalize(i: number) {
    const c = candidates[i]?.versions[candidates[i].active]
    if (!c) return
    patchCand(i, { finalizing: true })
    try {
      const r = await fetch('/finalized', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: genProvider, input_vars: inputVars(), selected_idx: i,
          text: c.edited, review: c.review.raw,
          score: c.review.score, positive: c.review.positive,
          reverse: c.review.reverse, accuracy: c.review.accuracy,
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || '保存失败')
      patchCand(i, { finalized: true })
      s.bumpFinalizeTick()   // 通知历史页刷新
    } catch (e) { alert(String(e)) } finally { patchCand(i, { finalizing: false }) }
  }

  async function reReviewOne(i: number) {
    const c = candidates[i]?.versions[candidates[i].active]
    if (!c) return
    patchCand(i, { reReviewing: true })
    try {
      const r = await fetch('/re-review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: c.edited, input_vars: inputVars(), selections, provider_name: genProvider }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || '失败')
      patchCand(i, { review: data.review, finalized: false })
    } catch (e) { alert(String(e)) } finally { patchCand(i, { reReviewing: false }) }
  }

  function changeInput() { setCandidates([]); setStage('input') }

  const steps = [
    { label: '输入', active: stage === 'input' || stage === 'generating', done: stage !== 'input' },
    { label: '生成', active: stage === 'generating' || stage === 'reviewing' || stage === 'done', done: stage === 'reviewing' || stage === 'done' },
    { label: '审核', active: stage === 'reviewing' || stage === 'done', done: stage === 'done' },
    { label: '定稿', active: stage === 'done', done: stage === 'done' },
  ]

  const scoreColor = (sc: number) => sc >= 80 ? '#2e7d32' : sc >= 60 ? '#b8860b' : '#c62828'

  return {
    // state
    candidates, status, loading, regenerating, error, stage, failureDetail,
    genProvider, setGenProvider, extraInputs, setExtraInputs,
    providers, dimensions, selections, setSelections,
    selectedDims, setSelectedDims,
    // 派生
    steps, scoreColor,
    // 操作
    generate, regenerateOne, regenerateAll, moveVersion,
    doFinalize, reReviewOne, changeInput, patchCand,
  }
}

export type GenerateLogic = ReturnType<typeof useGenerateLogic>
