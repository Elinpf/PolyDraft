import { useState, useEffect } from 'react'
import type { Choice, Dimension, SharedState } from '../types'

// ============ 选项维度管理页 ============

export function OptionsPage({ s }: { s: SharedState }) {
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
    setNewName(''); load(); s.bumpDimsTick()
  }
  async function delDim(d: Dimension) {
    if (!confirm(`删除维度「${d.name}」及其所有选项？`)) return
    await fetch(`/dimensions/${d.id}`, { method: 'DELETE' }); load(); s.bumpDimsTick()
  }
  async function delChoice(d: Dimension, c: Choice) {
    if (!confirm(`删除选项「${c.label}」？`)) return
    await fetch(`/choices/${c.id}`, { method: 'DELETE' }); load(); s.bumpDimsTick()
  }

  // 本地编辑：更新某个维度的字段（不立即存库）
  function patchDim(id: number, p: Partial<Dimension>) {
    setDims((ds) => ds.map((d) => (d.id === id ? { ...d, ...p } : d)))
  }
  function patchChoice(dimId: number, choiceId: number, p: Partial<Choice>) {
    setDims((ds) => ds.map((d) => (d.id === dimId
      ? { ...d, choices: d.choices.map((c) => (c.id === choiceId ? { ...c, ...p } : c)) }
      : d)))
  }

  // 保存单个维度（维度本身 + 其下所有选项），返回是否全部成功
  async function saveDim(d: Dimension): Promise<boolean> {
    const errs: string[] = []
    const r = await fetch(`/dimensions/${d.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: d.name, kind: d.kind }) })
    if (!r.ok) { const dd = await r.json(); errs.push(`维度「${d.name}」：${dd.detail || '失败'}`) }
    for (const c of d.choices) {
      const rc = await fetch(`/choices/${c.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: c.label, value: c.value, prompt_fragment: c.prompt_fragment }) })
      if (!rc.ok) { const dc = await rc.json(); errs.push(`选项「${c.label}」：${dc.detail || '失败'}`) }
    }
    if (errs.length) { console.error('保存失败', errs); return false }
    load(); s.bumpDimsTick()
    return true
  }

  return (
    <div className="container">
      <div className="panel">
        <div className="panel-header"><div className="icon">🎚️</div><h2>选项配置</h2><span className="tag">{dims.length}</span></div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
          维度即生成页的下拉选项。纯值维度（如产品系列）只注入值；带提示词维度（如文案类型）的每个选项可带一段提示词，选中后用 <code>{'{维度名提示词}'}</code> 注入。维度名即变量 key（如 <code>{'{产品系列}'}</code>）。
        </p>

        <div className="form-row">
          <div className="form-group"><label>类型</label>
            <select value={newKind} onChange={(e) => setNewKind(e.target.value as 'value' | 'prompt')}>
              <option value="value">🏷️ 纯值维度（只注入值）</option>
              <option value="prompt">✍️ 带提示词（每选项带一段提示词）</option>
            </select>
          </div>
          <div className="form-group"><label>维度名</label><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="如 产品系列 / 文案类型" /></div>
        </div>
        <div className="btn-row" style={{ justifyContent: 'flex-start' }}>
          <button className="btn btn-success" onClick={addDim}>➕ 新增维度</button>
        </div>
      </div>

      {dims.map((d) => (
        <DimPanel key={d.id} d={d} patchDim={patchDim} patchChoice={patchChoice}
          delDim={delDim} delChoice={delChoice} saveDim={saveDim} onAddChoice={async (label, value, frag) => {
            if (!label.trim()) return alert('选项名不能为空')
            const r = await fetch(`/dimensions/${d.id}/choices`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, value, prompt_fragment: frag }) })
            if (!r.ok) { const dd = await r.json(); return alert(dd.detail || '失败') }
            load(); s.bumpDimsTick()
          }} />
      ))}
    </div>
  )
}

function DimPanel({ d, patchDim, patchChoice, delDim, delChoice, saveDim, onAddChoice }: {
  d: Dimension
  patchDim: (id: number, p: Partial<Dimension>) => void
  patchChoice: (dimId: number, choiceId: number, p: Partial<Choice>) => void
  delDim: (d: Dimension) => void
  delChoice: (d: Dimension, c: Choice) => void
  saveDim: (d: Dimension) => Promise<boolean>
  onAddChoice: (label: string, value: string, frag: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  async function handleSave() {
    setSaveState('saving')
    const ok = await saveDim(d)
    if (ok) {
      setSaveState('done')
      setTimeout(() => setSaveState('idle'), 1500)
    } else {
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 2000)
    }
  }
  const saveLabel = saveState === 'saving' ? '保存中…' : saveState === 'done' ? '✓ 已保存' : saveState === 'error' ? '保存失败' : '💾 保存'
  return (
    <div className="panel">
      <div className="panel-header" style={{ cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <div className="icon">{d.kind === 'prompt' ? '✍️' : '🏷️'}</div>
        <h2>{d.name}</h2><span className="tag" style={{ marginLeft: 0 }}>{d.kind === 'prompt' ? '带提示词' : '纯值'} · {d.choices.length} 选项</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>{open ? '▼ 收拢' : '▶ 展开'}</span>
      </div>
      {open && (
        <>
          <div className="form-row" style={{ alignItems: 'flex-end' }}>
            <div className="form-group"><label>维度名 <code className="var-tag">{'{'+d.name+'}'}</code>{d.kind === 'prompt' && <code className="var-tag" style={{ marginLeft: 4 }}>{'{'+d.name+'提示词}'}</code>}</label><input value={d.name} onChange={(e) => patchDim(d.id, { name: e.target.value })} /></div>
            <div className="form-group"><label>类型</label>
              <select value={d.kind} onChange={(e) => patchDim(d.id, { kind: e.target.value as 'value' | 'prompt' })}>
                <option value="value">纯值</option><option value="prompt">带提示词</option>
              </select>
            </div>
            <button className="btn btn-danger" onClick={() => delDim(d)}>🗑️ 删除维度</button>
            <button className={'btn ' + (saveState === 'done' ? 'btn-success' : saveState === 'error' ? 'btn-danger' : 'btn-primary')} onClick={handleSave} disabled={saveState === 'saving'}>{saveLabel}</button>
          </div>

          <h3 style={{ fontSize: 13, margin: '14px 0 8px', color: 'var(--text-secondary)' }}>选项列表</h3>
          {d.choices.map((c) => (
            <div className="list-item" key={c.id}>
              <div className="item-head"><span className="item-name">▪️ {c.label}</span>
                <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 11 }} onClick={() => delChoice(d, c)}>🗑️</button></div>
              <div className="form-row">
                <div className="form-group"><label>选项名（显示/选择）</label><input value={c.label} onChange={(e) => patchChoice(d.id, c.id, { label: e.target.value })} /></div>
                <div className="form-group"><label>注入值（可空，空则用选项名）</label><input value={c.value} onChange={(e) => patchChoice(d.id, c.id, { value: e.target.value })} /></div>
              </div>
              {d.kind === 'prompt' && (
                <div className="form-group"><label>提示词片段（用 <code>{'{'+d.name+'提示词}'}</code> 注入）</label>
                  <textarea style={{ minHeight: 80 }} value={c.prompt_fragment} onChange={(e) => patchChoice(d.id, c.id, { prompt_fragment: e.target.value })} />
                </div>
              )}
            </div>
          ))}

          <AddChoiceRow onAdd={onAddChoice} promptKind={d.kind} />
        </>
      )}
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
        <div className="form-group"><label>提示词片段</label><textarea style={{ minHeight: 70 }} value={frag} onChange={(e) => setFrag(e.target.value)} placeholder="如：不超过7行，每行…" /></div>
      )}
    </div>
  )
}
