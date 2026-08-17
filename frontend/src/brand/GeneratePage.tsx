import { useState, useEffect } from 'react'
import type { Candidate, Dimension, Provider, SharedState } from '../types'

// ============ 品牌高级感 · 生成页 ============
// 逻辑与 pages/generate.tsx 一致（复用同一组 API + localStorage key），
// 仅套用 brand-ui.css 的品牌高级感样式。/new 路由下挂载，不影响现有页面。

export function BrandGeneratePage({ s }: { s: SharedState }) {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stage, setStage] = useState<'input' | 'generating' | 'reviewing' | 'done'>('input')
  const [failureDetail, setFailureDetail] = useState<{ slot: number; error: string }[]>([])
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
  const [selectedDims, setSelectedDims] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('copygen_selected_dims_default')
      if (saved) return JSON.parse(saved)
    } catch { /* ignore */ }
    return []
  })
  useEffect(() => { try { localStorage.setItem('copygen_selected_dims_default', JSON.stringify(selectedDims)) } catch { /* ignore */ } }, [selectedDims])

  async function loadDims() {
    const data: Dimension[] = await (await fetch('/dimensions')).json()
    setDimensions(data)
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
      s.bumpFinalizeTick()
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
    { num: 'Ⅰ', label: '输入', active: stage === 'input' || stage === 'generating', done: stage !== 'input' },
    { num: 'Ⅱ', label: '生成', active: stage === 'generating' || stage === 'reviewing' || stage === 'done', done: stage === 'reviewing' || stage === 'done' },
    { num: 'Ⅲ', label: '审核', active: stage === 'reviewing' || stage === 'done', done: stage === 'done' },
    { num: 'Ⅳ', label: '定稿', active: stage === 'done', done: stage === 'done' },
  ]

  const scoreColor = (sc: number) => sc >= 80 ? '#9bbf6a' : sc >= 60 ? '#c9a35a' : '#c97a5a'

  return (
    <div className="brand-container">
      <div className="brand-stepper">
        {steps.map((st) => (
          <div key={st.num} className={'bs-step' + (st.active ? ' active' : '') + (st.done ? ' done' : '')}>
            <span className="bs-num">{st.num}</span>
            <span className="bs-label">{st.label}</span>
          </div>
        ))}
      </div>

      <div className="brand-panel">
        <div className="brand-panel-head">
          <div className="bp-icon">◇</div>
          <div className="bp-title">步骤一 · 输入</div>
          <span className="bp-tag">Input</span>
        </div>

        <div className="brand-form-row">
          <div className="brand-form-group">
            <label>模型</label>
            <select value={genProvider} onChange={(e) => setGenProvider(e.target.value)}>
              {providers.length === 0 && <option value="kimi">kimi</option>}
              {providers.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div className="brand-form-group">
            <label>品牌 <code className="brand-var-tag">{'{品牌}'}</code></label>
            <input value={extraInputs['品牌'] ?? ''} placeholder="如 爱他美" onChange={(e) => setExtraInputs({ ...extraInputs, '品牌': e.target.value })} />
          </div>
        </div>

        {dimensions.length === 0 && (
          <p className="brand-panel-sub">尚未配置选项维度。请到「选项配置」页配置产品系列 / 文案类型等，再回到这里选择生成。</p>
        )}
        {dimensions.length > 0 && (
          <div>
            <div className="brand-panel-sub">选用维度（勾选的才显示下拉，可随时增减）</div>
            <div className="brand-dim-chips">
              {dimensions.map((d) => {
                const on = selectedDims.includes(d.name)
                return (
                  <button key={d.id} type="button" className={'brand-dim-chip' + (on ? ' on' : '')}
                    onClick={() => setSelectedDims((prev) => on ? prev.filter((n) => n !== d.name) : [...prev, d.name])}>
                    {on ? '✓' : '+'} {d.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <div className="brand-form-row brand-dim-grid">
          {dimensions.filter((d) => selectedDims.includes(d.name)).map((d) => (
            <div className="brand-form-group" key={d.id}>
              <label>{d.kind === 'prompt' ? '✍ ' : '◈ '}{d.name} <code className="brand-var-tag">{'{'+d.name+'}'}</code></label>
              <select value={selections[d.name] ?? ''} onChange={(e) => setSelections({ ...selections, [d.name]: e.target.value })}>
                <option value="">— 请选择 {d.name} —</option>
                {d.choices.map((c) => <option key={c.id} value={c.label}>{c.label}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div>
          <div className="brand-panel-sub">补充输入（在提示词里用对应 <code>{'{var}'}</code> 引用）</div>
          {Object.entries(extraInputs).filter(([k]) => k !== '品牌').map(([name, value], idx) => (
            <div className="brand-form-row" key={idx}>
              <div className="brand-form-group"><label>变量名</label>
                <input value={name} onChange={(e) => {
                  const rest = { ...extraInputs }; delete rest[name]; rest[e.target.value] = value; setExtraInputs(rest)
                }} />
              </div>
              <div className="brand-form-group" style={{ flex: 2 }}><label>值 <code className="brand-var-tag">{'{'+name+'}'}</code></label>
                <input value={value} onChange={(e) => setExtraInputs({ ...extraInputs, [name]: e.target.value })} />
              </div>
              <button className="brand-btn brand-btn-danger" style={{ padding: '10px 14px', fontSize: 12 }} onClick={() => { const rest = { ...extraInputs }; delete rest[name]; setExtraInputs(rest) }}>删除</button>
            </div>
          ))}
          <button className="brand-btn brand-btn-ghost" style={{ fontSize: 12 }} onClick={() => {
            let n = 1; while (`var${n}` in extraInputs) n++; setExtraInputs({ ...extraInputs, [`var${n}`]: '' })
          }}>＋ 添加补充输入</button>
        </div>

        {stage === 'input' && (
          <div className="brand-btn-row">
            <button className="brand-btn brand-btn-primary" onClick={generate} disabled={loading}>生成文案 →</button>
          </div>
        )}
        {status && <div className={'brand-status' + (loading ? ' brand-pulsing' : '')}>{status}</div>}
        {error && (
          <div className="brand-error">
            <div>⚠ {error}</div>
            {failureDetail.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.9 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>失败明细：</div>
                {failureDetail.map((f, i) => (
                  <div key={i} style={{ padding: '4px 0', borderTop: i ? '1px dashed rgba(180,60,60,0.2)' : 'none' }}>
                    <strong>风格 {f.slot}：</strong>
                    <span style={{ color: 'var(--b-muted)', marginLeft: 4 }}>{f.error}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {candidates.length > 0 && (
        <div className="brand-panel">
          <div className="brand-panel-head">
            <div className="bp-icon">✦</div>
            <div className="bp-title">候选文案 · 独立审核 · 定稿</div>
            <span className="bp-tag">{candidates.length} 份</span>
          </div>
          <p className="brand-panel-sub">每份候选文案独立审核（综合打分 + 正向亲和 / 反向亲和 / 产品知识准确性）。可编辑后单份重审，逐份定稿保留。</p>
          {candidates.map((c, i) => {
            const reviewed = !!c.review.raw
            const pendingRe = reviewed && c.edited !== c.text
            const revStatus = c.finalized ? '已定稿' : pendingRe ? '待重审' : reviewed ? '已审' : '待审'
            const revColor = c.finalized ? '#9bbf6a' : pendingRe ? '#c9a35a' : reviewed ? 'var(--b-gold-soft)' : 'var(--b-muted)'
            return (
              <div className="brand-cand" key={i}>
                <div className="brand-cand-head">
                  <span className="brand-cand-name">候选 {i + 1}{c.style ? ` · ${c.style}` : ''}</span>
                  <span className="brand-cand-meta" style={{ color: revColor }}>{revStatus}</span>
                  {reviewed && <span className="brand-cand-score" style={{ color: scoreColor(c.review.score) }}>{c.review.score}</span>}
                </div>
                <textarea className="brand-copy-area"
                  value={c.edited} onChange={(e) => patchCand(i, { edited: e.target.value, finalized: false })} />
                {reviewed && (
                  <div className="brand-review">
                    <div className="br-item"><span className="br-label">正向亲和</span><span className="br-text">{c.review.positive || '—'}</span></div>
                    <div className="br-item"><span className="br-label">反向亲和</span><span className="br-text">{c.review.reverse || '—'}</span></div>
                    <div className="br-item"><span className="br-label">知识准确</span><span className="br-text">{c.review.accuracy || '—'}</span></div>
                  </div>
                )}
                <div className="brand-btn-row" style={{ justifyContent: 'flex-start' }}>
                  <button className="brand-btn brand-btn-ghost" style={{ padding: '8px 16px', fontSize: 12 }} onClick={() => navigator.clipboard.writeText(c.edited)}>复制</button>
                  <button className="brand-btn brand-btn-ghost" style={{ padding: '8px 16px', fontSize: 12 }} onClick={() => reReviewOne(i)} disabled={c.reReviewing}>{c.reReviewing ? '审核中…' : '重新审核'}</button>
                  <button className="brand-btn brand-btn-success" style={{ padding: '8px 16px', fontSize: 12 }} onClick={() => doFinalize(i)} disabled={c.finalizing || c.finalized}>{c.finalized ? '✓ 已定稿' : c.finalizing ? '保存中…' : '定稿'}</button>
                </div>
              </div>
            )
          })}
          <div className="brand-btn-row">
            <button className="brand-btn brand-btn-ghost" onClick={changeInput}>← 改输入</button>
          </div>
        </div>
      )}
    </div>
  )
}
