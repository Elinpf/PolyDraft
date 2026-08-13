import { useState, useEffect } from 'react'
import type { Provider } from '../types'

// ============ 配置页 ============

function ConfigPage() {
  const [testing, setTesting] = useState<Record<string, boolean | null>>({})
  const [provEditing, setProvEditing] = useState<Record<string, Provider>>({})

  async function reloadProviders() {
    const data = await (await fetch('/providers')).json()
    const e: Record<string, Provider> = {}
    data.forEach((p: Provider) => (e[p.name] = { ...p }))
    setProvEditing(e)
  }
  useEffect(() => { reloadProviders() }, [])

  async function save(name: string) {
    const cfg = provEditing[name]
    if (!cfg.api_key) { if (!confirm('api_key 为空，确认保存？空 key 将无法调用。')) return }
    await fetch('/providers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
    alert('已保存到数据库')
    reloadProviders()
  }
  async function test(name: string) {
    setTesting({ ...testing, [name]: null })
    const data = await (await fetch(`/providers/${name}/test`, { method: 'POST' })).json()
    setTesting({ ...testing, [name]: data.ok })
  }

  const providers = Object.keys(provEditing)

  return (
    <div className="container">
      <div className="panel">
        <div className="panel-header"><div className="icon">🔑</div><h2>模型配置</h2><span className="tag">配置</span></div>
        {providers.map((name) => {
          const p = provEditing[name]
          const t = testing[name]
          return (
            <div className="list-item" key={name}>
              <div className="item-head"><span className="item-name">📦 {name}</span>
                {t === null && <span className="item-meta generating">测试中…</span>}
                {t === true && <span className="item-meta" style={{ color: '#2e7d32' }}>🟢 连通</span>}
                {t === false && <span className="item-meta" style={{ color: '#c62828' }}>🔴 失败</span>}
              </div>
              <div className="form-row">
                <div className="form-group"><label>base_url</label><input value={p?.base_url ?? ''} onChange={(e) => setProvEditing({ ...provEditing, [name]: { ...p, base_url: e.target.value } })} /></div>
                <div className="form-group"><label>api_key</label>
                  <input type="password" value={p?.api_key ?? ''} placeholder="已保存的 key 不显示明文，如需更换请输入新 key" onChange={(e) => setProvEditing({ ...provEditing, [name]: { ...p, api_key: e.target.value } })} />
                </div>
              </div>
              <div className="form-row"><div className="form-group"><label>model</label><input value={p?.model ?? ''} onChange={(e) => setProvEditing({ ...provEditing, [name]: { ...p, model: e.target.value } })} /></div></div>
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

export { ConfigPage }
