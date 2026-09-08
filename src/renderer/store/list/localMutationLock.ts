const pending = new Map<string, Promise<unknown>>()

// Only the short local commit is locked. Network requests do not block editing.
export const withLocalListLocks = async<T>(ids: string[], task: () => Promise<T>): Promise<T> => {
  const keys = [...new Set(ids)].sort()
  const previous = keys.map(async id => pending.get(id) ?? Promise.resolve())
  const result = Promise.all(previous.map(async item => item.catch(() => {}))).then(task)
  for (const id of keys) pending.set(id, result)
  try { return await result } finally {
    for (const id of keys) if (pending.get(id) === result) pending.delete(id)
  }
}
