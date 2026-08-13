import { useState, useEffect } from 'react'
import type { Dimension, KnowledgeItem } from '../types'

// ============ 产品知识页 ============

export function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [newSeries, setNewSeries] = useState('')
  // 产品系列维度的选项 value→label 映射，用来在系列卡片上显示人类可读的名字
  const [seriesLabels, setSeriesLabels] = useState<Record<string, string>>({})

  async function load() {
    const [pk, dims]: [KnowledgeItem[], Dimension[]] = await Promise.all([
      (await fetch('/product-knowledge')).json(),
      (await fetch('/dimensions')).json(),
    ])
    setItems(pk)
    const seriesDim = dims.find((d) => d.name === '产品系列')
    const map: Record<string, string> = {}
    if (seriesDim) seriesDim.choices.forEach((c) => { map[c.value || c.label] = c.label })
    setSeriesLabels(map)
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

  // 系列 label：若该 series 命中产品系列维度选项，显示「label（series）」，否则仅 series
  const seriesTitle = (series: string) => {
    const lbl = seriesLabels[series]
    return lbl && lbl !== series ? `${lbl}（${series}）` : series
  }
  // 未配知识的系列选项（value），供新增下拉选择
  const orphanSeries = Object.keys(seriesLabels).filter((v) => !items.some((it) => it.series === v))

  return (
    <div className="container">
      <div className="panel">
        <div className="panel-header"><div className="icon">📚</div><h2>产品知识</h2><span className="tag">{items.length} 系列</span></div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
          为每个产品系列维护知识文本（卖点、受众、范文等）。生成页选某个产品系列时，对应内容通过 <code>{'{产品知识}'}</code> 注入。这里的「系列」即「选项配置」里产品系列维度的<b>选项值</b>——下方标题会标注该值对应的人类可读名字。
        </p>
        {items.length === 0 && <div className="empty-state"><p>暂无产品知识。先在「选项配置」配置产品系列选项，再回到这里维护对应知识。</p></div>}
        {items.map((it) => (
          <div className="list-item" key={it.series}>
            <div className="item-head">
              <span className="item-name">🏷️ {seriesTitle(it.series)} <code className="var-tag">{it.series}</code>{!seriesLabels[it.series] && <span style={{ fontSize: 11, color: '#c62828', marginLeft: 6 }}>⚠️ 无对应选项</span>}</span>
              <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 11 }} onClick={() => del(it.series)}>🗑️</button>
            </div>
            <div className="form-group"><textarea style={{ minHeight: 160, resize: 'vertical' }} defaultValue={it.body} onBlur={(e) => save(it.series, e.target.value)} /></div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-header"><div className="icon">➕</div><h2>新增系列知识</h2></div>
        {orphanSeries.length > 0 && (
          <p style={{ fontSize: 12, color: '#8a8276', marginBottom: 8 }}>
            💡 以下产品系列选项尚未配知识：{orphanSeries.map((v) => seriesTitle(v)).join('、')}。直接点下方添加，或手填系列值。
          </p>
        )}
        <div className="form-row">
          <div className="form-group"><label>产品系列值</label>
            <input value={newSeries} onChange={(e) => setNewSeries(e.target.value)} placeholder="如 A / B（即产品系列维度的选项值）" list="series-opts" />
            <datalist id="series-opts">
              {Object.entries(seriesLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </datalist>
          </div>
        </div>
        <div className="btn-row" style={{ justifyContent: 'flex-start' }}><button className="btn btn-success" onClick={add}>➕ 添加</button></div>
      </div>
    </div>
  )
}

