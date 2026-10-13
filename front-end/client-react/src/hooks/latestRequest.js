// One owner per resource. Old completions cannot replace newer query results.
export function createLatestRequest() {
  let generation = 0
  return {
    invalidate() { generation++ },
    async run(operation, onSuccess, onError) {
      const current = ++generation
      try { const value = await operation(); if(current === generation) { onSuccess(value); return value } }
      catch(error) { if(current === generation) onError(error) }
    },
  }
}
