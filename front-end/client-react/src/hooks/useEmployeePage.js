import { useCallback, useEffect, useRef, useState } from 'react'
import { createLatestRequest } from './latestRequest'
import { LIVE_REFRESH_EVENT } from './liveRefreshController.js'
export function useEmployeePage(loader, params) {
  const key = JSON.stringify(params)
  const owner = useRef(null)
  if (!owner.current) owner.current = createLatestRequest()
  const [state,setState] = useState({status:'loading',data:null,error:null,key})
  const run = useCallback((background = false) => {
    if (!background) setState(previous=>({...previous,status:'loading',error:null,key}))
    return owner.current.run(()=>loader(JSON.parse(key)),
      data=>setState({status:'success',data,error:null,key}),
      error=>{if(!background) setState({status:'error',data:null,error,key})})
  },[loader,key])
  const refresh = useCallback(() => run(false), [run])
  useEffect(()=>{refresh();return ()=>owner.current.invalidate()},[refresh])
  useEffect(() => {
    const onChanged = () => run(true)
    window.addEventListener(LIVE_REFRESH_EVENT, onChanged)
    return () => window.removeEventListener(LIVE_REFRESH_EVENT, onChanged)
  }, [run])
  return {...(state.key===key ? state : {status:'loading',data:null,error:null}),refresh}
}
