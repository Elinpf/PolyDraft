import { useState } from 'react'
import type { GenerateLogic } from '../../logic/useGenerateLogic'
import { copyText } from '../../clipboard'

// ============ 经典版生成页视图 ============
// 纯渲染，接收 logic 对象解构使用，无逻辑。className 对应 App.css。

export function ClassicGenerateView({ logic }: { logic: GenerateLogic }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const {
    candidates, status, loading, error, stage, failureDetail,
    genProvider, setGenProvider, extraInputs, setExtraInputs,
    providers, dimensions, selections, setSelections,
    selectedDims, setSelectedDims,
    steps, scoreColor, generate, doFinalize, reReviewOne, changeInput, patchCand,
  } = logic

  const stepNums = ['①', '②', '③', '④']

  return (
    <div className="container">
      <div className="stepper">
        {steps.map((st, i) => <div key={i} className={'step' + (st.active ? ' active' : '')}><span className="num">{stepNums[i]}</span>{st.label}</div>)}
      </div>

      <div className="panel">
        <div className="panel-header"><div className="icon">📋</div><h2>步骤1：输入</h2><span className="tag">输入</span></div>
        <div className="form-row">
          <div className="form-group"><label>🤖 模型</label>
            <select value={genProvider} onChange={(e) => setGenProvider(e.target.value)}>
              {providers.length === 0 && <option value="kimi">kimi</option>}
              {providers.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label>🏷️ 品牌 <code className="var-tag">{'{品牌}'}</code></label>
            <input value={extraInputs['品牌'] ?? ''} placeholder="如 爱他美" onChange={(e) => setExtraInputs({ ...extraInputs, '品牌': e.target.value })} />
          </div>
        </div>
        {dimensions.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>尚未配置选项维度。请到「选项配置」页配置产品系列 / 文案类型等，再回到这里选择生成。</p>
        )}
        {dimensions.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>选用维度（勾选的才显示下拉，可随时增减）：</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {dimensions.map((d) => {
                const on = selectedDims.includes(d.name)
                return (
                  <button key={d.id} type="button" onClick={() => setSelectedDims((prev) => on ? prev.filter((n) => n !== d.name) : [...prev, d.name])}
                    style={{
                      padding: '4px 10px', fontSize: 12, borderRadius: 14, cursor: 'pointer', border: '1px solid var(--gold, #d4b87a)',
                      background: on ? 'var(--gold, #d4b87a)' : 'transparent',
                      color: on ? '#fff' : 'var(--gold-dark, #8a6d2f)',
                    }}>
                    {on ? '✓' : '+'} {d.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <div className="form-row dim-grid">
          {dimensions.filter((d) => selectedDims.includes(d.name)).map((d) => (
            <div className="form-group" key={d.id}>
              <label>{d.kind === 'prompt' ? '✍️' : '🏷️'} {d.name} <code className="var-tag">{'{'+d.name+'}'}</code>{d.kind === 'prompt' && <code className="var-tag" style={{ marginLeft: 4 }}>{'{'+d.name+'提示词}'}</code>}</label>
              <select value={selections[d.name] ?? ''} onChange={(e) => setSelections({ ...selections, [d.name]: e.target.value })}>
                <option value="">— 请选择 {d.name} —</option>
                {d.choices.map((c) => <option key={c.id} value={c.label}>{c.label}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>补充输入（在提示词里用对应 <code>{'{var}'}</code> 引用）：</div>
          {Object.entries(extraInputs).filter(([k]) => k !== '品牌').map(([name, value], idx) => (
            <div className="form-row" key={idx} style={{ alignItems: 'flex-end' }}>
              <div className="form-group"><label>变量名</label>
                <input value={name} onChange={(e) => {
                  const rest = { ...extraInputs }; delete rest[name]; rest[e.target.value] = value; setExtraInputs(rest)
                }} />
              </div>
              <div className="form-group" style={{ flex: 2 }}><label>值 <code className="var-tag">{'{'+name+'}'}</code></label>
                <input value={value} onChange={(e) => setExtraInputs({ ...extraInputs, [name]: e.target.value })} />
              </div>
              <button className="btn btn-danger" style={{ padding: '8px 12px', fontSize: 12 }} onClick={() => { const rest = { ...extraInputs }; delete rest[name]; setExtraInputs(rest) }}>🗑️</button>
            </div>
          ))}
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => {
            let n = 1; while (`var${n}` in extraInputs) n++; setExtraInputs({ ...extraInputs, [`var${n}`]: '' })
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
                <span className="item-name">📝 候选文案 {i + 1}{c.style ? `（${c.style}）` : ''}</span>
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
                <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => copyText(c.edited).then((ok) => {
                  if (ok) { setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 1500) }
                })}>{copiedIdx === i ? '✓ 已复制' : '📋 复制'}</button>
                <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => reReviewOne(i)} disabled={c.reReviewing}>{c.reReviewing ? '审核中…' : '🔄 重新审核'}</button>
                <button className="btn btn-success" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => doFinalize(i)} disabled={c.finalizing || c.finalized}>{c.finalized ? '✓ 已定稿' : c.finalizing ? '保存中…' : '✅ 定稿'}</button>
              </div>
              {c.prompts && (
                <details className="prompt-inspector">
                  <summary>查看提示词</summary>
                  <div className="prompt-section"><span className="prompt-label">System</span><pre className="prompt-pre">{c.prompts.system || '(无)'}</pre></div>
                  <div className="prompt-section"><span className="prompt-label">User</span><pre className="prompt-pre">{c.prompts.user}</pre></div>
                </details>
              )}
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
