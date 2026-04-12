/** Ссылка вида https://tables.mws.ru/workbench/{dstId}/{viewId} */

const WORKBENCH_RE =
  /^https?:\/\/tables\.mws\.ru\/workbench\/([^/?#\s]+)\/([^/?#\s]+)(?:[\/?#]|$)/i

export type MwsWorkbenchRef = {
  dstId: string
  viewId: string
}

export function parseMwsWorkbenchUrl(raw: string): MwsWorkbenchRef | null {
  const line = raw.trim().split(/\r?\n/)[0]?.trim() ?? ''
  const m = line.match(WORKBENCH_RE)
  if (!m?.[1] || !m[2]) return null
  return { dstId: m[1], viewId: m[2] }
}
