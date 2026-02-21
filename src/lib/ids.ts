export function createId(prefix: string): string {
  const token =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10)

  return `${prefix}_${token}`
}
