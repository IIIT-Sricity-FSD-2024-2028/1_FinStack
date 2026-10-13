import { useCallback, useEffect, useRef, useState } from 'react'
import { createLatestRequest } from './latestRequest'
export function useEmployeePage(loader, params) {
  const key = JSON.stringify(params)
  const owner = useRef(null)
  if (!owner.current) owner.current = createLatestRequest()
  const [state,setState] = useState({status:'loading',data:null,error:null,key})
  const refresh = useCallback(() => {
    setState(previous=>({...previous,status:'loading',error:null,key}))
    return owner.current.run(()=>loader(JSON.parse(key)),
      data=>setState({status:'success',data,error:null,key}),
      error=>setState({status:'error',data:null,error,key}))
  },[loader,key])
  useEffect(()=>{refresh();return ()=>owner.current.invalidate()},[refresh])
  return {...(state.key===key ? state : {status:'loading',data:null,error:null}),refresh}
}
