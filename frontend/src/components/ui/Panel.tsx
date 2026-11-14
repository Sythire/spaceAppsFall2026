import type { ReactNode } from 'react';
export function Panel({title,children}:{title:string;children:ReactNode}){return <section className="panel"><h2>{title}</h2>{children}</section>;}
export function Metric({label,value,note}:{label:string;value:string;note?:string}){return <article className="metric"><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</article>;}

