import { useState, useEffect } from 'react'
import type { Candidate, Dimension, Provider, SharedState } from '../types'

// ============ 生成页逻辑 ============
// 纯 state + fetch + SSE + 操作，无 JSX 无 className 无 CSS import。
// 视图层（views/<theme>/GenerateView）接收返回的 logic 对象渲染。
// 状态存在此 hook 中，切主题时 View 组件树更换但 state 保留。

export function useGenerateLogic(s: SharedState) {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stage, setStage] = useState<'input' | 'generating' | 'reviewing' | 'done'>('input')
  const [failureDetail, setFailureDetail] = useState<{ slot: number; error: string }[]>([])
  // 模型选择 + 补充输入：就地状态（页面常驻挂载保活），localStorage 持久化
  const [genProvider, setGenProvider] = useState(() => {
    try { const v = localStorage.getItem('copygen_provider'); if (v) return v } catch { /* ignore */ }
    return 'kimi'
  })
  useEffect(() => { try { localStorage.setItem('copygen_provider', genProvider) } catch { /* ignore */ } }, [genProvider])
  const [extraInputs, setExtraInputs] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('copygen_extra_inputs')
      if (saved) {
        const obj = JSON.parse(saved)
        // 旧版用 brand/tone，迁移到中文 key；语气已移除（改由文案风格控制）
        if (obj.brand !== undefined) { obj['品牌'] = obj.brand; delete obj.brand }
        if (obj.tone !== undefined) { delete obj.tone }
        if (obj['语气'] !== undefined) { delete obj['语气'] }
        return obj
      }
    } catch { /* ignore */ }
    return { '品牌': '爱他美' }
  })
  useEffect(() => { try { localStorage.setItem('copygen_extra_inputs', JSON.stringify(extraInputs)) } catch { /* ignore */ } }, [extraInputs])
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
            const cs: Candidate[] = (e.candidates || []).map((c: any) => ({
              text: c.text, style: c.style, review: c.review, edited: c.text, finalized: false, reReviewing: false, finalizing: false,
              prompts: c.prompts,
            }))
            setCandidates(cs); setStage('done'); setStatus('')
          }
        }
      })
    } catch (e) { setError(String(e)); setStage('input'); setStatus('') } finally { setLoading(false) }
  }

  function patchCand(i: number, p: Partial<Candidate>) {
    setCandidates((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...p } : c)))
  }

  async function doFinalize(i: number) {
    const c = candidates[i]
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
    const c = candidates[i]
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
    candidates, status, loading, error, stage, failureDetail,
    genProvider, setGenProvider, extraInputs, setExtraInputs,
    providers, dimensions, selections, setSelections,
    selectedDims, setSelectedDims,
    // 派生
    steps, scoreColor,
    // 操作
    generate, doFinalize, reReviewOne, changeInput, patchCand,
  }
}

export type GenerateLogic = ReturnType<typeof useGenerateLogic>
