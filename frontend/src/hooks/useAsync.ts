import {useCallback,useEffect,useState} from 'react';
export function useAsync<T>(load:()=>Promise<T>){
 const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let current=true;setData(null);setLoading(true);setError('');load().then(result=>{if(current)setData(result);}).catch((e:unknown)=>{if(current)setError(e instanceof Error?e.message:'Unable to load data');}).finally(()=>{if(current)setLoading(false);});return()=>{current=false;};},[load,attempt]);
 return {data,error,loading,retry:useCallback(()=>setAttempt(n=>n+1),[])};
}

