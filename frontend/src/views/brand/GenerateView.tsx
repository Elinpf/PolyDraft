import { useState } from 'react'
import type { GenerateLogic } from '../../logic/useGenerateLogic'
import { copyText } from '../../clipboard'

// ============ 品牌高级感生成页视图 ============
// 纯渲染，接收 logic 对象解构使用，无逻辑。className 对应 brand-ui.css。

export function BrandGenerateView({ logic }: { logic: GenerateLogic }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const {
    candidates, status, loading, error, stage, failureDetail,
    genProvider, setGenProvider, extraInputs, setExtraInputs,
    providers, dimensions, selections, setSelections,
    selectedDims, setSelectedDims,
    steps, scoreColor, generate, doFinalize, reReviewOne, changeInput, patchCand,
  } = logic

  const stepNums = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ']

  return (
    <div className="brand-container">
      <div className="brand-stepper">
        {steps.map((st, i) => (
          <div key={i} className={'bs-step' + (st.active ? ' active' : '') + (st.done ? ' done' : '')}>
            <span className="bs-num">{stepNums[i]}</span>
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
                  <button className="brand-btn brand-btn-ghost" style={{ padding: '8px 16px', fontSize: 12 }} onClick={() => copyText(c.edited).then((ok) => {
                    if (ok) { setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 1500) }
                  })}>{copiedIdx === i ? '✓ 已复制' : '复制'}</button>
                  <button className="brand-btn brand-btn-ghost" style={{ padding: '8px 16px', fontSize: 12 }} onClick={() => reReviewOne(i)} disabled={c.reReviewing}>{c.reReviewing ? '审核中…' : '重新审核'}</button>
                  <button className="brand-btn brand-btn-success" style={{ padding: '8px 16px', fontSize: 12 }} onClick={() => doFinalize(i)} disabled={c.finalizing || c.finalized}>{c.finalized ? '✓ 已定稿' : c.finalizing ? '保存中…' : '定稿'}</button>
                </div>
                {c.prompts && (
                  <details className="brand-prompt-inspector">
                    <summary>查看提示词</summary>
                    <div className="brand-prompt-section"><span className="brand-prompt-label">System</span><pre className="brand-prompt-pre">{c.prompts.system || '(无)'}</pre></div>
                    <div className="brand-prompt-section"><span className="brand-prompt-label">User</span><pre className="brand-prompt-pre">{c.prompts.user}</pre></div>
                  </details>
                )}
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
