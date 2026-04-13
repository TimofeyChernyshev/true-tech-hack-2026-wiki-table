import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { rebuildBacklinksIndex, WIKI_BACKLINKS_UPDATED } from './wikiBacklinks'
import { computeForceLayout } from './wikiGraphLayout'
import { buildWikiLinkGraph } from './wikiLinkGraph'
import { NewPageModal } from './NewPageModal'
import { PagesSidebarToggle, WikiPagesSidebar } from './WikiPagesSidebar'
import { addWikiPage, loadWikiPageIndex } from './wikiPageRegistry'
import '../App.css'

const NODE_R = 22

export function LinkGraphPage() {
  const navigate = useNavigate()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pages, setPages] = useState(loadWikiPageIndex)
  const [size, setSize] = useState({ w: 900, h: 560 })
  const [layoutRev, setLayoutRev] = useState(0)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [pagesSidebarOpen, setPagesSidebarOpen] = useState(true)
  const [graphRev, setGraphRev] = useState(0)

  const graph = useMemo(() => {
    void graphRev
    return buildWikiLinkGraph()
  }, [pages, graphRev])

  const iterations = graph.nodes.length < 8 ? 140 : graph.nodes.length < 20 ? 200 : 260

  const positions = useMemo(() => {
    const { nodes, edges } = graph
    if (!nodes.length || size.w < 60 || size.h < 60) return new Map<string, { x: number; y: number }>()
    return computeForceLayout(
      nodes.map((n) => n.id),
      edges,
      size.w,
      size.h,
      iterations,
      layoutRev * 0.73,
    )
  }, [graph, size.w, size.h, layoutRev, iterations])

  const refreshPages = useCallback(() => {
    setPages(loadWikiPageIndex())
    setGraphRev((x) => x + 1)
  }, [])

  useEffect(() => {
    rebuildBacklinksIndex()
    refreshPages()
  }, [refreshPages])

  useEffect(() => {
    const onBl = () => {
      setGraphRev((x) => x + 1)
      setPages(loadWikiPageIndex())
    }
    window.addEventListener(WIKI_BACKLINKS_UPDATED, onBl)
    return () => window.removeEventListener(WIKI_BACKLINKS_UPDATED, onBl)
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setSize({ w: Math.floor(r.width), h: Math.floor(r.height) })
    })
    ro.observe(el)
    const r = el.getBoundingClientRect()
    setSize({ w: Math.floor(r.width), h: Math.floor(r.height) })
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.w < 10 || size.h < 10) return
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2)
    canvas.width = Math.floor(size.w * dpr)
    canvas.height = Math.floor(size.h * dpr)
    canvas.style.width = `${size.w}px`
    canvas.style.height = `${size.h}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.w, size.h)
    ctx.fillStyle = '#f4f5fb'
    ctx.fillRect(0, 0, size.w, size.h)

    const { edges, nodes } = graph
    ctx.strokeStyle = 'rgba(91, 92, 219, 0.42)'
    ctx.lineWidth = 1.5
    for (const e of edges) {
      const pa = positions.get(e.from)
      const pb = positions.get(e.to)
      if (!pa || !pb) continue
      ctx.beginPath()
      ctx.moveTo(pa.x, pa.y)
      ctx.lineTo(pb.x, pb.y)
      ctx.stroke()

      const dx = pb.x - pa.x
      const dy = pb.y - pa.y
      const len = Math.hypot(dx, dy) || 1
      const ux = dx / len
      const uy = dy / len
      const back = NODE_R + 5
      const ax = pb.x - ux * back
      const ay = pb.y - uy * back
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(ax - 9 * ux + 4 * uy, ay - 9 * uy - 4 * ux)
      ctx.lineTo(ax - 9 * ux - 4 * uy, ay - 9 * uy + 4 * ux)
      ctx.closePath()
      ctx.fillStyle = 'rgba(91, 92, 219, 0.5)'
      ctx.fill()
    }

    for (const node of nodes) {
      const p = positions.get(node.id)
      if (!p) continue
      const active = hoverId === node.id
      ctx.beginPath()
      ctx.arc(p.x, p.y, NODE_R, 0, Math.PI * 2)
      ctx.fillStyle = active ? '#6c6ce0' : '#9191ff'
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = active ? 3 : 2
      ctx.stroke()
      const label = node.title.length > 26 ? `${node.title.slice(0, 24)}…` : node.title
      ctx.font = '600 12px system-ui, "Segoe UI", sans-serif'
      ctx.fillStyle = '#1d2023'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(label, p.x, p.y + NODE_R + 6)
    }
  }, [graph, positions, size.w, size.h, hoverId])

  const pickNode = useCallback(
    (cx: number, cy: number): string | null => {
      for (const node of graph.nodes) {
        const p = positions.get(node.id)
        if (!p) continue
        if (Math.hypot(cx - p.x, cy - p.y) <= NODE_R + 8) return node.id
      }
      return null
    },
    [graph.nodes, positions],
  )

  const onCanvasMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const r = canvas.getBoundingClientRect()
      setHoverId(pickNode(e.clientX - r.left, e.clientY - r.top))
    },
    [pickNode],
  )

  const onCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const r = canvas.getBoundingClientRect()
      const id = pickNode(e.clientX - r.left, e.clientY - r.top)
      if (id) navigate(`/p/${encodeURIComponent(id)}`)
    },
    [navigate, pickNode],
  )

  const onCreate = useCallback(
    (title: string) => {
      const p = addWikiPage(title)
      refreshPages()
      navigate(`/p/${encodeURIComponent(p.key)}`)
    },
    [navigate, refreshPages],
  )

  return (
    <div className="wiki-app">
      <NewPageModal open={newOpen} onClose={() => setNewOpen(false)} onCreate={onCreate} />
      <div className="wiki-layout-with-pages">
        {pagesSidebarOpen ? (
          <WikiPagesSidebar
            pages={pages}
            currentPageKey=""
            backlinkKeys={[]}
            onCreatePage={() => setNewOpen(true)}
            showBacklinks={false}
          />
        ) : null}
        <div className="wiki-graph-main">
          <header className="wiki-graph-header">
            <div className="wiki-graph-header-top">
              <PagesSidebarToggle expanded={pagesSidebarOpen} onClick={() => setPagesSidebarOpen((v) => !v)} />
              <h1 className="wiki-graph-title">Граф связей</h1>
            </div>
            <p className="wiki-graph-hint">
              Связи задаёте сами: в тексте вставьте ссылку на другую страницу (в диалоге ссылки укажите{' '}
              <code className="wiki-graph-code">/p/ключ-страницы</code>
              ). Узел — страница, стрелка — «эта страница ссылается на ту». Пустой граф значит, что пока нет таких ссылок между страницами из списка.
            </p>
            <button type="button" className="wiki-graph-shuffle secondary" onClick={() => setLayoutRev((x) => x + 1)}>
              Пересобрать укладку
            </button>
          </header>
          <div ref={wrapRef} className="wiki-graph-canvas-wrap">
            <canvas
              ref={canvasRef}
              className="wiki-graph-canvas"
              onMouseMove={onCanvasMove}
              onMouseLeave={() => setHoverId(null)}
              onClick={onCanvasClick}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
