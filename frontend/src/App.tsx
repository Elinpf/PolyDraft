import { useState, useEffect } from 'react'
import './App.css'

type Provider = { name: string; base_url: string; api_key: string; model: string }
type Slot = { slot: number; body: string; temperature: number }
type Choice = { id: number; dimension_id: number; label: string; value: string; prompt_fragment: string }
type Dimension = { id: number; name: string; kind: 'value' | 'prompt'; choices: Choice[] }
type KnowledgeItem = { series: string; body: string }
type CandReview = { score: number; positive: string; reverse: string; accuracy: string; raw: string }
type Candidate = { text: string; review: CandReview; edited: string; finalized: boolean; reReviewing: boolean; finalizing: boolean }
type Page = 'generate' | 'config' | 'slots' | 'options' | 'knowledge' | 'history' | 'docs'

// ====== 共享状态（提升到 App，切换页面不丢失）======

type SharedState = {
  // 生成页：模型选择 + 补充输入（name/value，会话内持久，localStorage 保留）
  genProvider: string
  setGenProvider: (v: string) => void
  extraInputs: Record<string, string>
  setExtraInputs: (v: Record<string, string>) => void
  // 配置页编辑态
  provEditing: Record<string, Provider>
  setProvEditing: (e: Record<string, Provider>) => void
  reloadProviders: () => void
}

// ============ 生成页 ============

function GeneratePage({ s }: { s: SharedState }) {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stage, setStage] = useState<'input' | 'generating' | 'reviewing' | 'done'>('input')
  const [failureDetail, setFailureDetail] = useState<{ slot: number; error: string }[]>([])
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [selections, setSelections] = useState<Record<string, string>>({})

  async function loadDims() {
    const data: Dimension[] = await (await fetch('/dimensions')).json()
    setDimensions(data)
  }
  useEffect(() => { loadDims() }, [])

  const inputVars = () => s.extraInputs

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
      const r = await fetch('/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input_vars: inputVars(), provider_name: s.genProvider, selections }) })
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
              text: c.text, review: c.review, edited: c.text, finalized: false, reReviewing: false, finalizing: false,
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
          provider: s.genProvider, input_vars: inputVars(), selected_idx: i,
          text: c.edited, review: c.review.raw,
          score: c.review.score, positive: c.review.positive,
          reverse: c.review.reverse, accuracy: c.review.accuracy,
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || '保存失败')
      patchCand(i, { finalized: true })
    } catch (e) { alert(String(e)) } finally { patchCand(i, { finalizing: false }) }
  }

  async function reReviewOne(i: number) {
    const c = candidates[i]
    if (!c) return
    patchCand(i, { reReviewing: true })
    try {
      const r = await fetch('/re-review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: c.edited, input_vars: inputVars(), selections, provider_name: s.genProvider }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || '失败')
      patchCand(i, { review: data.review, finalized: false })
    } catch (e) { alert(String(e)) } finally { patchCand(i, { reReviewing: false }) }
  }

  function changeInput() { setCandidates([]); setStage('input') }

  const steps = [
    { num: '①', label: '输入', active: stage === 'input' || stage === 'generating' },
    { num: '②', label: '生成', active: stage === 'generating' || stage === 'reviewing' || stage === 'done' },
    { num: '③', label: '审核', active: stage === 'reviewing' || stage === 'done' },
    { num: '④', label: '定稿', active: stage === 'done' },
  ]

  const scoreColor = (sc: number) => sc >= 80 ? '#2e7d32' : sc >= 60 ? '#b8860b' : '#c62828'

  return (
    <div className="container">
      <div className="stepper">
        {steps.map((st) => <div key={st.num} className={'step' + (st.active ? ' active' : '')}><span className="num">{st.num}</span>{st.label}</div>)}
      </div>

      <div className="panel">
        <div className="panel-header"><div className="icon">📋</div><h2>步骤1：输入</h2><span className="tag">输入</span></div>
        <div className="form-row">
          <div className="form-group"><label>🤖 模型</label>
            <select value={s.genProvider} onChange={(e) => s.setGenProvider(e.target.value)}>
              <option value="kimi">kimi</option><option value="custom">自定义模型</option>
            </select>
          </div>
          <div className="form-group"><label>🏷️ 品牌 <code className="var-tag">{'{品牌}'}</code></label>
            <input value={s.extraInputs['品牌'] ?? ''} placeholder="如 爱他美" onChange={(e) => s.setExtraInputs({ ...s.extraInputs, '品牌': e.target.value })} />
          </div>
          <div className="form-group"><label>🎨 语气 <code className="var-tag">{'{语气}'}</code></label>
            <input value={s.extraInputs['语气'] ?? ''} placeholder="如 专业 / 亲切" onChange={(e) => s.setExtraInputs({ ...s.extraInputs, '语气': e.target.value })} />
          </div>
        </div>
        {dimensions.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>尚未配置选项维度。请到「选项维度」页配置产品系列 / 文案类型等，再回到这里选择生成。</p>
        )}
        <div className="form-row">
          {dimensions.map((d) => (
            <div className="form-group" key={d.id}>
              <label>{d.kind === 'prompt' ? '✍️' : '🏷️'} {d.name} <code className="var-tag">{'{'+d.name+'}'}</code>{d.kind === 'prompt' && <code className="var-tag" style={{ marginLeft: 4 }}>{'{'+d.name+'约束}'}</code>}</label>
              <select value={selections[d.name] ?? ''} onChange={(e) => setSelections({ ...selections, [d.name]: e.target.value })}>
                <option value="">— 请选择 {d.name} —</option>
                {d.choices.map((c) => <option key={c.id} value={c.label}>{c.label}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>补充输入（在提示词里用对应 <code>{'{var}'}</code> 引用）：</div>
          {Object.entries(s.extraInputs).filter(([k]) => k !== '品牌' && k !== '语气').map(([name, value]) => (
            <div className="form-row" key={name} style={{ alignItems: 'flex-end' }}>
              <div className="form-group"><label>变量名</label>
                <input value={name} onChange={(e) => {
                  const rest = { ...s.extraInputs }; delete rest[name]; rest[e.target.value] = value; s.setExtraInputs(rest)
                }} />
              </div>
              <div className="form-group" style={{ flex: 2 }}><label>值 <code className="var-tag">{'{'+name+'}'}</code></label>
                <input value={value} onChange={(e) => s.setExtraInputs({ ...s.extraInputs, [name]: e.target.value })} />
              </div>
              <button className="btn btn-danger" style={{ padding: '8px 12px', fontSize: 12 }} onClick={() => { const rest = { ...s.extraInputs }; delete rest[name]; s.setExtraInputs(rest) }}>🗑️</button>
            </div>
          ))}
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => {
            let n = 1; while (s.extraInputs[`var${n}`]) n++; s.setExtraInputs({ ...s.extraInputs, [`var${n}`]: '' })
          }}>＋ 添加补充输入</button>
        </div>

        {stage === 'input' && <div className="btn-row" style={{ marginTop: 10 }}><button className="btn btn-primary" onClick={generate} disabled={loading}>🚀 生成文案 →</button></div>}
        {status && <div className={'status-line' + (loading ? ' generating' : '')}>{status}</div>}
        {error && (
          <div className="error-line">
            <div>⚠️ {error}</div>
            {failureDetail.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.8 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>失败明细：</div>
                {failureDetail.map((f, i) => (
                  <div key={i} style={{ padding: '4px 0', borderTop: i ? '1px dashed rgba(198,40,40,0.2)' : 'none' }}>
                    <strong>风格 {f.slot}：</strong>
                    <span style={{ color: '#6b6375', marginLeft: 4 }}>{f.error}</span>
                  </div>
                ))}
                <div style={{ marginTop: 8, fontSize: 11, color: '#8a8276' }}>
                  💡 常见原因：API 密钥无效或额度用尽、接口地址不可达、模型名错误。可在「模型配置」页测试连通。
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {candidates.length > 0 && (
        <div className="panel">
          <div className="panel-header"><div className="icon">✍️</div><h2>步骤2/3/4：候选文案 · 独立审核 · 定稿</h2><span className="tag">{candidates.length} 份</span></div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>每份候选文案独立审核（综合打分 + 正向亲和 / 反向亲和 / 产品知识准确性）。可编辑后单份重审，逐份定稿保留。</p>
          {candidates.map((c, i) => {
            // 审核状态：已定稿优先；有 raw 审核原文=已审；编辑后文本与原候选不一致=待重审；否则待审
            const reviewed = !!c.review.raw
            const pendingRe = reviewed && c.edited !== c.text
            const revStatus = c.finalized ? '已定稿' : pendingRe ? '待重审' : reviewed ? '已审' : '待审'
            const revColor = c.finalized ? '#2e7d32' : pendingRe ? '#b8860b' : reviewed ? 'var(--gold-dark)' : '#8a8276'
            return (
            <div className="list-item" key={i}>
              <div className="item-head">
                <span className="item-name">📝 候选文案 {i + 1}</span>
                <span className="item-meta" style={{ color: revColor, fontWeight: 700, marginRight: 10 }}>审核状态：{revStatus}</span>
                {reviewed && <span className="item-meta" style={{ color: scoreColor(c.review.score), fontWeight: 700 }}>打分 {c.review.score}</span>}
              </div>
              <textarea className="copy-preview" style={{ width: '100%', minHeight: 140 }}
                value={c.edited} onChange={(e) => patchCand(i, { edited: e.target.value, finalized: false })} />
              {reviewed && (
              <div className="review-box" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.8 }}>
                <div><strong style={{ color: 'var(--gold-dark)' }}>正向亲和：</strong>{c.review.positive || '—'}</div>
                <div><strong style={{ color: 'var(--gold-dark)' }}>反向亲和：</strong>{c.review.reverse || '—'}</div>
                <div><strong style={{ color: 'var(--gold-dark)' }}>产品知识准确性：</strong>{c.review.accuracy || '—'}</div>
                {c.review.raw && (c.review.positive || c.review.reverse || c.review.accuracy) === '' && <div style={{ marginTop: 6, fontSize: 12, color: '#8a8276' }}>原文：{c.review.raw}</div>}
              </div>
              )}
              <div className="btn-row" style={{ justifyContent: 'flex-start' }}>
                <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => navigator.clipboard.writeText(c.edited)}>📋 复制</button>
                <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => reReviewOne(i)} disabled={c.reReviewing}>{c.reReviewing ? '审核中…' : '🔄 重新审核'}</button>
                <button className="btn btn-success" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => doFinalize(i)} disabled={c.finalizing}>{c.finalizing ? '保存中…' : '✅ 定稿'}</button>
              </div>
            </div>
            )
          })}
          <div className="btn-row" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
            <button className="btn btn-secondary" onClick={changeInput}>← 改输入</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ 配置页 ============

function ConfigPage({ s }: { s: SharedState }) {
  const [testing, setTesting] = useState<Record<string, boolean | null>>({})
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})

  useEffect(() => { s.reloadProviders() }, [])

  async function save(name: string) {
    const cfg = s.provEditing[name]
    if (!cfg.api_key) { if (!confirm('api_key 为空，确认保存？空 key 将无法调用。')) return }
    await fetch('/providers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
    alert('已保存到数据库')
    s.reloadProviders()
  }
  async function test(name: string) {
    setTesting({ ...testing, [name]: null })
    const data = await (await fetch(`/providers/${name}/test`, { method: 'POST' })).json()
    setTesting({ ...testing, [name]: data.ok })
  }

  const providers = Object.keys(s.provEditing)

  return (
    <div className="container">
      <div className="panel">
        <div className="panel-header"><div className="icon">🔑</div><h2>模型配置</h2><span className="tag">配置</span></div>
        {providers.map((name) => {
          const p = s.provEditing[name]
          const t = testing[name]
          return (
            <div className="list-item" key={name}>
              <div className="item-head"><span className="item-name">📦 {name}</span>
                {t === null && <span className="item-meta generating">测试中…</span>}
                {t === true && <span className="item-meta" style={{ color: '#2e7d32' }}>🟢 连通</span>}
                {t === false && <span className="item-meta" style={{ color: '#c62828' }}>🔴 失败</span>}
              </div>
              <div className="form-row">
                <div className="form-group"><label>base_url</label><input value={p?.base_url ?? ''} onChange={(e) => s.setProvEditing({ ...s.provEditing, [name]: { ...p, base_url: e.target.value } })} /></div>
                <div className="form-group"><label>api_key</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input style={{ flex: 1 }} type={showKey[name] ? 'text' : 'password'} value={p?.api_key ?? ''} placeholder="填写 API Key" onChange={(e) => s.setProvEditing({ ...s.provEditing, [name]: { ...p, api_key: e.target.value } })} />
                    <button type="button" className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 14 }} title={showKey[name] ? '隐藏' : '显示明文'} onClick={() => setShowKey({ ...showKey, [name]: !showKey[name] })}>{showKey[name] ? '🙈' : '👁️'}</button>
                  </div>
                </div>
              </div>
              <div className="form-row"><div className="form-group"><label>model</label><input value={p?.model ?? ''} onChange={(e) => s.setProvEditing({ ...s.provEditing, [name]: { ...p, model: e.target.value } })} /></div></div>
              <div className="btn-row" style={{ justifyContent: 'flex-start' }}>
                <button className="btn btn-primary" onClick={() => save(name)}>💾 保存</button>
                <button className="btn btn-ghost" onClick={() => test(name)}>🔌 测试连通</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============ 文案风格管理页 ============

function SlotsPage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [reviewBody, setReviewBody] = useState('')
  const [systemBody, setSystemBody] = useState('')

  async function load() {
    const [s, r, sy] = await Promise.all([fetch('/slots'), fetch('/prompts/review'), fetch('/prompts/system')])
    setSlots(await s.json())
    setReviewBody((await r.json()).body)
    setSystemBody((await sy.json()).body)
  }
  useEffect(() => { load() }, [])

  async function saveSlot(sl: Slot) {
    await fetch('/slots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sl) })
    alert('已保存')
  }
  async function delSlot(slot: number) { await fetch(`/slots/${slot}`, { method: 'DELETE' }); load() }
  async function saveReview() {
    await fetch('/prompts/review?body=' + encodeURIComponent(reviewBody), { method: 'POST' }); alert('已保存')
  }
  async function saveSystem() {
    await fetch('/prompts/system?body=' + encodeURIComponent(systemBody), { method: 'POST' }); alert('已保存')
  }

  return (
    <div className="container">
      <div className="panel">
        <div className="panel-header"><div className="icon">🧠</div><h2>写作设定</h2><span className="tag">设定</span></div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>所有内容的起点。放稳定的背景：身份、品牌调性等。每次生成都带。可用 {'{var}'} 引用变量（如 {'{品牌}'}、{'{产品知识}'}）。</p>
        <div className="form-group"><textarea style={{ minHeight: 140 }} value={systemBody} onChange={(e) => setSystemBody(e.target.value)} /></div>
        <div className="btn-row" style={{ justifyContent: 'flex-start' }}><button className="btn btn-primary" onClick={saveSystem}>💾 保存</button></div>
      </div>

      <div className="panel">
        <div className="panel-header"><div className="icon">🎨</div><h2>文案风格管理</h2><span className="tag">风格</span></div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>每个风格 = 一种写法，独立提示词。并行时各跑一份，一次产出多份候选文案。</p>
        {slots.map((sl, i) => {
          return (
            <div className="list-item" key={i}>
              <div className="item-head"><span className="item-name">🎨 风格 {sl.slot}</span></div>
              <div className="form-row"><div className="form-group"><label>风格号</label><input type="number" value={sl.slot} onChange={(e) => { const ns = [...slots]; ns[i] = { ...sl, slot: Number(e.target.value) }; setSlots(ns) }} /></div></div>
              <div className="form-group"><label>提示词</label><textarea style={{ minHeight: 100 }} value={sl.body} onChange={(e) => { const ns = [...slots]; ns[i] = { ...sl, body: e.target.value }; setSlots(ns) }} /></div>
              <div className="btn-row" style={{ justifyContent: 'flex-start' }}>
                <button className="btn btn-primary" onClick={() => saveSlot(slots[i])}>💾 保存</button>
                <button className="btn btn-danger" onClick={() => delSlot(sl.slot)}>🗑️ 删除</button>
              </div>
            </div>
          )
        })}
        <div className="btn-row" style={{ justifyContent: 'flex-start' }}>
          <button className="btn btn-success" onClick={() => setSlots([...slots, { slot: slots.length, body: '', temperature: 1 }])}>+ 新增风格</button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header"><div className="icon">🔎</div><h2>审核意见设定</h2><span className="tag">审核</span></div>
        <div className="form-group"><textarea style={{ minHeight: 120 }} value={reviewBody} onChange={(e) => setReviewBody(e.target.value)} /></div>
        <div className="btn-row" style={{ justifyContent: 'flex-start' }}><button className="btn btn-primary" onClick={saveReview}>💾 保存</button></div>
      </div>
    </div>
  )
}

// ============ 使用文档页 ============

function DocsPage() {
  return (
    <div className="container">
      <div className="panel">
        <div className="panel-header"><div className="icon">📖</div><h2>使用文档</h2><span className="tag">文档</span></div>
        <div style={{ fontSize: 14, lineHeight: 1.9, color: 'var(--text)' }}>

          <h3 style={{ marginTop: 16, color: 'var(--gold-dark)' }}>一、整体流程</h3>
          <p>本引擎是一个文案生成流水线：<b>选条件 → 并行生成多份风格候选 → 逐份独立审核 → 逐份定稿</b>。一次生成会按你的多个「文案风格」并行产出多份候选文案，每份都独立审核（综合打分 + 正向亲和 / 反向亲和 / 产品知识准确性三维度），最终由你逐份定稿保留。</p>

          <h3 style={{ marginTop: 16, color: 'var(--gold-dark)' }}>二、快速上手（5 步）</h3>
          <ol style={{ paddingLeft: 20 }}>
            <li><b>🔑 配置模型</b>：进「模型配置」页，填写接口地址（base_url）、密钥（api_key）、模型名（model），点「保存」后「测试连通」确认可用。</li>
            <li><b>🧠 写写作设定</b>：进「文案风格」页最顶部，编辑写作设定（身份、品牌调性）。可用 <code>{'{var}'}</code> 引用变量。</li>
            <li><b>🎨 配文案风格</b>：在「文案风格」页编辑每种风格的提示词。每个风格 = 一种写法，并行各跑一份。</li>
            <li><b>🎚️ 配选项 + 📚 产品知识</b>：在「选项配置」维护产品系列 / 文案类型等下拉选项（文案类型可带约束片段）；在「产品知识」按系列维护知识，生成时按所选系列自动注入。</li>
            <li><b>✍️ 生成与定稿</b>：进「生成」页选好各下拉条件 → 点「生成」→ 等待进度（生成中 N/M、审核中 N/M）→ 每份候选可编辑、单份重审、逐份定稿保存到历史。</li>
          </ol>

          <h3 style={{ marginTop: 16, color: 'var(--gold-dark)' }}>三、提示词怎么拼</h3>
          <p>每次生成由两部分组成：</p>
          <ul style={{ paddingLeft: 20 }}>
            <li><b>写作设定</b>（稳定背景）：放身份、调性。每次生成都带。</li>
            <li><b>风格提示词</b>（本次任务）：放本次主题、场景等。</li>
          </ul>
          <p>变量用 <code>{'{var}'}</code> 引用，写在哪个提示词里就在哪部分渲染。例如 <code>{'{品牌}'}</code> 写进写作设定就进背景，写进风格提示词就进本次任务。</p>

          <h3 style={{ marginTop: 16, color: 'var(--gold-dark)' }}>四、选项、产品知识与补充输入</h3>
          <ul style={{ paddingLeft: 20 }}>
            <li><b>🎚️ 选项配置</b>：维护生成页的下拉维度。纯值维度（如产品系列）只注入值；带约束维度（如文案类型）的每个选项可带一段约束文本，选中后用 <code>{'{文案类型约束}'}</code> 注入。维度名即变量名（如 <code>{'{产品系列}'}</code>）。</li>
            <li><b>📚 产品知识</b>：按产品系列一条文本。生成页选某系列时，对应内容通过 <code>{'{产品知识}'}</code> 注入。系列名需与「选项配置」里产品系列的选项值匹配。</li>
            <li><b>⌨️ 补充输入</b>：生成页「品牌」「语气」是固定输入（提示词里用 <code>{'{品牌}'}</code>/<code>{'{语气}'}</code> 引用）；下方还可增删自定义 name/value 字段，会保留在浏览器本地。</li>
          </ul>
          <p>提示词里 <code>{'{var}'}</code> 未提供值时，后端会保留占位不崩——可在补充输入补上，或直接删掉占位。</p>

          <h3 style={{ marginTop: 16, color: 'var(--gold-dark)' }}>五、生成与定稿</h3>
          <ul style={{ paddingLeft: 20 }}>
            <li><b>进度</b>：实时显示「生成中 N/M」「审核中 N/M」。</li>
            <li><b>候选文案</b>：多份风格不同的候选，各自带审核结果（打分 + 三维度意见），可直接在文本框编辑。</li>
            <li><b>定稿</b>：每份候选独立点「✅ 定稿」，全部保留，在「历史」页查看。</li>
            <li><b>重新审核</b>：每份候选单独点「🔄 重新审核」，只重审这一份（编辑后重审会基于编辑后的文本）。</li>
            <li><b>失败容忍</b>：部分风格失败仍返回其余候选；全部失败会列出每个风格的具体错误。</li>
          </ul>

          <h3 style={{ marginTop: 16, color: 'var(--gold-dark)' }}>六、常见问题</h3>
          <ul style={{ paddingLeft: 20 }}>
            <li><b>生成失败提示额度用尽</b>：模型 API 额度耗尽，需到模型平台续费或换可用密钥。</li>
            <li><b>测试连通失败</b>：检查密钥（api_key）是否有效、接口地址（base_url）是否可达、模型名（model）是否正确。</li>
            <li><b>候选里出现 <code>{'{xxx}'}</code></b>：该变量未提供值，后端保留占位。在生成页补充输入里加上对应 name，或在提示词里删掉。</li>
            <li><b>定稿后刷新页面丢失</b>：定稿已存数据库，去「历史」页查看；生成页的候选是会话态，刷新会清。</li>
          </ul>

        </div>
      </div>
    </div>
  )
}

// ============ 选项维度管理页 ============

function OptionsPage() {
  const [dims, setDims] = useState<Dimension[]>([])
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<'value' | 'prompt'>('value')

  async function load() {
    setDims(await (await fetch('/dimensions')).json())
  }
  useEffect(() => { load() }, [])

  async function addDim() {
    if (!newName.trim()) return alert('维度名不能为空')
    const r = await fetch('/dimensions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName, kind: newKind }) })
    if (!r.ok) { const d = await r.json(); return alert(d.detail || '失败') }
    setNewName(''); load()
  }
  async function updDim(d: Dimension, name: string, kind: 'value' | 'prompt') {
    const r = await fetch(`/dimensions/${d.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, kind }) })
    if (!r.ok) { const dd = await r.json(); return alert(dd.detail || '失败') }
    load()
  }
  async function delDim(d: Dimension) {
    if (!confirm(`删除维度「${d.name}」及其所有选项？`)) return
    await fetch(`/dimensions/${d.id}`, { method: 'DELETE' }); load()
  }
  async function addChoice(d: Dimension, label: string, value: string, frag: string) {
    if (!label.trim()) return alert('选项 label 不能为空')
    const r = await fetch(`/dimensions/${d.id}/choices`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, value, prompt_fragment: frag }) })
    if (!r.ok) { const dd = await r.json(); return alert(dd.detail || '失败') }
    load()
  }
  async function updChoice(c: Choice, label: string, value: string, frag: string) {
    await fetch(`/choices/${c.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, value, prompt_fragment: frag }) })
    load()
  }
  async function delChoice(c: Choice) {
    if (!confirm(`删除选项「${c.label}」？`)) return
    await fetch(`/choices/${c.id}`, { method: 'DELETE' }); load()
  }

  return (
    <div className="container">
      <div className="panel">
        <div className="panel-header"><div className="icon">🎚️</div><h2>选项配置</h2><span className="tag">{dims.length}</span></div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
          维度即生成页的下拉选项。纯值维度（如产品系列）只注入值；带约束维度（如文案类型）的每个选项可带约束片段，选中后用 <code>{'{维度名约束}'}</code> 注入。维度名即变量 key（如 <code>{'{产品系列}'}</code>）。
        </p>

        <div className="form-row">
          <div className="form-group"><label>类型</label>
            <select value={newKind} onChange={(e) => setNewKind(e.target.value as 'value' | 'prompt')}>
              <option value="value">🏷️ 纯值维度（只注入值）</option>
              <option value="prompt">✍️ 带约束（每选项带约束片段）</option>
            </select>
          </div>
          <div className="form-group"><label>维度名</label><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="如 产品系列 / 文案类型" /></div>
        </div>
        <div className="btn-row" style={{ justifyContent: 'flex-start' }}><button className="btn btn-success" onClick={addDim}>➕ 新增维度</button></div>
      </div>

      {dims.map((d) => (
        <div className="panel" key={d.id}>
          <div className="panel-header"><div className="icon">{d.kind === 'prompt' ? '✍️' : '🏷️'}</div>
            <h2>{d.name}</h2><span className="tag">{d.kind === 'prompt' ? '带约束' : '纯值'} · {d.choices.length} 选项</span>
          </div>
          <div className="form-row" style={{ alignItems: 'flex-end' }}>
            <div className="form-group"><label>维度名</label><input defaultValue={d.name} onBlur={(e) => { if (e.target.value !== d.name) updDim(d, e.target.value, d.kind) }} /></div>
            <div className="form-group"><label>类型</label>
              <select defaultValue={d.kind} onChange={(e) => updDim(d, d.name, e.target.value as 'value' | 'prompt')}>
                <option value="value">纯值</option><option value="prompt">带约束</option>
              </select>
            </div>
            <button className="btn btn-danger" onClick={() => delDim(d)}>🗑️ 删除维度</button>
          </div>

          <h3 style={{ fontSize: 13, margin: '14px 0 8px', color: 'var(--text-secondary)' }}>选项列表</h3>
          {d.choices.map((c) => (
            <div className="list-item" key={c.id}>
              <div className="item-head"><span className="item-name">▪️ {c.label}</span>
                <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 11 }} onClick={() => delChoice(c)}>🗑️</button></div>
              <div className="form-row">
                <div className="form-group"><label>选项名（显示/选择）</label><input defaultValue={c.label} onBlur={(e) => updChoice(c, e.target.value, c.value, c.prompt_fragment)} /></div>
                <div className="form-group"><label>注入值（可空，空则用选项名）</label><input defaultValue={c.value} onBlur={(e) => updChoice(c, c.label, e.target.value, c.prompt_fragment)} /></div>
              </div>
              {d.kind === 'prompt' && (
                <div className="form-group"><label>约束片段（用 <code>{'{'+d.name+'约束}'}</code> 注入）</label>
                  <textarea style={{ minHeight: 80 }} defaultValue={c.prompt_fragment} onBlur={(e) => updChoice(c, c.label, c.value, e.target.value)} />
                </div>
              )}
            </div>
          ))}

          <AddChoiceRow onAdd={(label, value, frag) => addChoice(d, label, value, frag)} promptKind={d.kind} />
        </div>
      ))}
    </div>
  )
}

function AddChoiceRow({ onAdd, promptKind }: { onAdd: (label: string, value: string, frag: string) => void; promptKind: 'value' | 'prompt' }) {
  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')
  const [frag, setFrag] = useState('')
  return (
    <div className="list-item" style={{ borderStyle: 'dashed' }}>
      <div className="item-head"><span className="item-name">➕ 新增选项</span>
        <button className="btn btn-success" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => { if (!label.trim()) return alert('选项名不能为空'); onAdd(label, value, frag); setLabel(''); setValue(''); setFrag('') }}>添加</button>
      </div>
      <div className="form-row">
        <div className="form-group"><label>选项名</label><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="如 朋友圈" /></div>
        <div className="form-group"><label>注入值（可空）</label><input value={value} onChange={(e) => setValue(e.target.value)} placeholder="空则用选项名" /></div>
      </div>
      {promptKind === 'prompt' && (
        <div className="form-group"><label>约束片段</label><textarea style={{ minHeight: 70 }} value={frag} onChange={(e) => setFrag(e.target.value)} placeholder="如：不超过7行，每行…" /></div>
      )}
    </div>
  )
}

// ============ 产品知识页 ============

function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [newSeries, setNewSeries] = useState('')

  async function load() {
    setItems(await (await fetch('/product-knowledge')).json())
  }
  useEffect(() => { load() }, [])

  async function save(series: string, body: string) {
    const r = await fetch('/product-knowledge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ series, body }) })
    if (!r.ok) { const d = await r.json(); return alert(d.detail || '失败') }
    alert('已保存')
  }
  async function add() {
    if (!newSeries.trim()) return alert('产品系列名不能为空')
    await save(newSeries, '')
    setNewSeries(''); load()
  }
  async function del(series: string) {
    if (!confirm(`删除系列「${series}」的知识？`)) return
    await fetch(`/product-knowledge/${encodeURIComponent(series)}`, { method: 'DELETE' }); load()
  }

  return (
    <div className="container">
      <div className="panel">
        <div className="panel-header"><div className="icon">📚</div><h2>产品知识</h2><span className="tag">{items.length} 系列</span></div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
          按产品系列维护知识文本（卖点、受众、范文等）。生成页选某产品系列时，对应内容通过 <code>{'{产品知识}'}</code> 注入。系列名需与「选项配置」里产品系列的选项值匹配。
        </p>
        {items.length === 0 && <div className="empty-state"><p>暂无产品知识。先在「选项配置」配置产品系列选项，再回到这里维护对应知识。</p></div>}
        {items.map((it) => (
          <div className="list-item" key={it.series}>
            <div className="item-head"><span className="item-name">🏷️ 系列 {it.series}</span>
              <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 11 }} onClick={() => del(it.series)}>🗑️</button></div>
            <div className="form-group"><textarea style={{ minHeight: 160, resize: 'vertical' }} defaultValue={it.body} onBlur={(e) => save(it.series, e.target.value)} /></div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-header"><div className="icon">➕</div><h2>新增系列知识</h2></div>
        <div className="form-row">
          <div className="form-group"><label>产品系列名</label><input value={newSeries} onChange={(e) => setNewSeries(e.target.value)} placeholder="如 A / B / 卓傲（需与产品系列维度选项值匹配）" /></div>
        </div>
        <div className="btn-row" style={{ justifyContent: 'flex-start' }}><button className="btn btn-success" onClick={add}>➕ 添加</button></div>
      </div>
    </div>
  )
}

// ============ 历史页 ============

type FinalizedItem = { id: number; ts: string; provider: string; input_vars: string; selected_idx: number; text: string; review: string; score: number | null; positive: string; reverse: string; accuracy: string }

function HistoryPage() {
  const [items, setItems] = useState<FinalizedItem[]>([])
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  async function load() { setItems(await (await fetch('/finalized')).json()) }
  useEffect(() => { load() }, [])

  async function del(id: number) {
    if (!confirm('确定删除这条定稿？')) return
    await fetch(`/finalized/${id}`, { method: 'DELETE' }); load()
  }
  function copy(text: string) { navigator.clipboard.writeText(text); alert('已复制') }

  function fmtTs(ts: string) {
    try { return new Date(ts).toLocaleString('zh-CN') } catch { return ts }
  }
  function fmtInputs(s: string) {
    try { return Object.entries(JSON.parse(s)).map(([k, v]) => `${k}: ${v}`).join(' · ') } catch { return s }
  }

  return (
    <div className="container">
      <div className="panel">
        <div className="panel-header"><div className="icon">📚</div><h2>定稿历史</h2><span className="tag">{items.length} 条</span></div>
        {items.length === 0 && <div className="empty-state"><p>暂无定稿。生成文案并定稿后将出现在这里。</p></div>}
        {items.map((it) => (
          <div className="list-item" key={it.id}>
            <div className="item-head">
              <span className="item-name">📄 定稿 #{it.id}</span>
              <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 11 }} onClick={() => del(it.id)}>🗑️</button>
            </div>
            <div className="item-meta">📅 {fmtTs(it.ts)} · 🤖 {it.provider} · 📝 候选 {it.selected_idx}{it.score != null ? ` · 打分 ${it.score}` : ''}</div>
            <div className="item-meta">输入：{fmtInputs(it.input_vars)}</div>
            <div className="copy-preview" style={{ marginTop: 8, maxHeight: expanded[it.id] ? 'none' : 100, overflow: 'hidden' }}>{it.text}</div>
            <div className="btn-row" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
              <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => copy(it.text)}>📋 复制</button>
              <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => setExpanded({ ...expanded, [it.id]: !expanded[it.id] })}>{expanded[it.id] ? '收起' : '展开全文'}</button>
            </div>
            {(it.score != null || it.positive || it.reverse || it.accuracy || it.review) && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: 12, color: 'var(--gold-dark)', cursor: 'pointer' }}>🔎 审核结果</summary>
                <div className="review-box" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.8 }}>
                  {it.score != null && <div><strong style={{ color: 'var(--gold-dark)' }}>综合打分：</strong>{it.score}</div>}
                  {it.positive && <div><strong style={{ color: 'var(--gold-dark)' }}>正向亲和：</strong>{it.positive}</div>}
                  {it.reverse && <div><strong style={{ color: 'var(--gold-dark)' }}>反向亲和：</strong>{it.reverse}</div>}
                  {it.accuracy && <div><strong style={{ color: 'var(--gold-dark)' }}>产品知识准确性：</strong>{it.accuracy}</div>}
                  {it.review && !it.positive && !it.reverse && !it.accuracy && <div>{it.review}</div>}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============ App ============

function App() {
  const [page, setPage] = useState<Page>('generate')
  // 提升到顶层的共享状态
  const [genProvider, setGenProvider] = useState('kimi')
  // 补充输入：name/value，localStorage 持久化，默认 品牌/语气
  const [extraInputs, setExtraInputs] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('copygen_extra_inputs')
      if (saved) {
        const obj = JSON.parse(saved)
        // 旧版用 brand/tone，迁移到中文 key
        if (obj.brand !== undefined) { obj['品牌'] = obj.brand; delete obj.brand }
        if (obj.tone !== undefined) { obj['语气'] = obj.tone; delete obj.tone }
        return obj
      }
    } catch { /* ignore */ }
    return { '品牌': '爱他美', '语气': '专业' }
  })
  useEffect(() => { try { localStorage.setItem('copygen_extra_inputs', JSON.stringify(extraInputs)) } catch { /* ignore */ } }, [extraInputs])
  const [provEditing, setProvEditing] = useState<Record<string, Provider>>({})

  async function reloadProviders() {
    const data = await (await fetch('/providers')).json()
    const e: Record<string, Provider> = {}
    data.forEach((p: Provider) => (e[p.name] = { ...p }))
    setProvEditing(e)
  }
  useEffect(() => { reloadProviders() }, [])

  const shared: SharedState = {
    genProvider, setGenProvider,
    extraInputs, setExtraInputs,
    provEditing, setProvEditing, reloadProviders,
  }

  const navItems: { key: Page; label: string; icon: string }[] = [
    { key: 'generate', label: '生成', icon: '✍️' },
    { key: 'slots', label: '文案风格', icon: '🎨' },
    { key: 'options', label: '选项配置', icon: '🎚️' },
    { key: 'knowledge', label: '产品知识', icon: '📚' },
    { key: 'history', label: '历史', icon: '🗂️' },
    { key: 'config', label: '模型配置', icon: '🔑' },
  ]

  return (
    <div>
      <div className="topbar">
        <h1>🍼 文案生成引擎</h1>
        <div className="row">
          {navItems.map((n) => (
            <button key={n.key} className={'nav-btn' + (page === n.key ? ' active' : '')} onClick={() => setPage(n.key)}>{n.icon} {n.label}</button>
          ))}
          <button className={'nav-btn' + (page === 'docs' ? ' active' : '')} onClick={() => setPage('docs')} title="使用文档">📖 文档</button>
          <span className="badge">多风格 · 并行 · 审核</span>
        </div>
      </div>
      {page === 'generate' ? <GeneratePage s={shared} /> : page === 'config' ? <ConfigPage s={shared} /> : page === 'slots' ? <SlotsPage /> : page === 'options' ? <OptionsPage /> : page === 'knowledge' ? <KnowledgePage /> : page === 'history' ? <HistoryPage /> : <DocsPage />}
    </div>
  )
}

export default App
