export const WIKI_AUTOSAVE_INTERVAL_LS_KEY = 'wiki-autosave-interval-ms'

export const WIKI_AUTOSAVE_OPTIONS = [
  { value: 3000, label: '3 с' },
  { value: 10000, label: '10 с' },
  { value: 30000, label: '30 с' },
  { value: 60000, label: '1 мин' },
  { value: 0, label: 'Только при паузе ввода' },
] as const
