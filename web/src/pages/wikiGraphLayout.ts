export type Vec2 = { x: number; y: number }

/**
 * Простая силаовая укладка: отталкивание всех пар, пружины по рёбрам, слабое притяжение к центру.
 */
export function computeForceLayout(
  nodeIds: string[],
  edges: { from: string; to: string }[],
  width: number,
  height: number,
  iterations = 200,
  /** Сдвиг начального кольца (для кнопки «пересобрать укладку»). */
  rotationSeed = 0,
): Map<string, Vec2> {
  const n = nodeIds.length
  if (n === 0 || width < 80 || height < 80) return new Map()
  const byId = new Map<string, { x: number; y: number; vx: number; vy: number }>()
  nodeIds.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / n + rotationSeed
    const r = Math.min(width, height) * 0.26
    byId.set(id, {
      x: width / 2 + r * Math.cos(angle),
      y: height / 2 + r * Math.sin(angle),
      vx: 0,
      vy: 0,
    })
  })

  const kRep = 6400
  const kSpring = 0.04
  const ideal = Math.min(width, height) * 0.14
  const damping = 0.84
  const gravity = 0.0025
  const padding = 52

  for (let it = 0; it < iterations; it++) {
    const forces = new Map<string, { fx: number; fy: number }>()
    for (const id of nodeIds) forces.set(id, { fx: 0, fy: 0 })

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ida = nodeIds[i]
        const idb = nodeIds[j]
        const a = byId.get(ida)!
        const b = byId.get(idb)!
        let dx = a.x - b.x
        let dy = a.y - b.y
        let dist = Math.hypot(dx, dy)
        if (dist < 1) dist = 1
        const f = kRep / (dist * dist)
        dx /= dist
        dy /= dist
        const fa = forces.get(ida)!
        const fb = forces.get(idb)!
        fa.fx += dx * f
        fa.fy += dy * f
        fb.fx -= dx * f
        fb.fy -= dy * f
      }
    }

    for (const e of edges) {
      const a = byId.get(e.from)
      const b = byId.get(e.to)
      if (!a || !b) continue
      let dx = b.x - a.x
      let dy = b.y - a.y
      let dist = Math.hypot(dx, dy)
      if (dist < 1) dist = 1
      const delta = dist - ideal
      const f = kSpring * delta
      dx /= dist
      dy /= dist
      const fa = forces.get(e.from)
      const fb = forces.get(e.to)
      if (fa && fb) {
        fa.fx += dx * f
        fa.fy += dy * f
        fb.fx -= dx * f
        fb.fy -= dy * f
      }
    }

    const cx = width / 2
    const cy = height / 2
    for (const id of nodeIds) {
      const p = byId.get(id)!
      const f = forces.get(id)!
      f.fx += (cx - p.x) * gravity
      f.fy += (cy - p.y) * gravity
      p.vx = (p.vx + f.fx) * damping
      p.vy = (p.vy + f.fy) * damping
    }

    for (const id of nodeIds) {
      const p = byId.get(id)!
      p.x += p.vx
      p.y += p.vy
      p.x = Math.max(padding, Math.min(width - padding, p.x))
      p.y = Math.max(padding, Math.min(height - padding, p.y))
    }
  }

  return new Map([...byId.entries()].map(([id, p]) => [id, { x: p.x, y: p.y }]))
}
