"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type FieldProps = {label:string;revealLabels?:{show:string;hide:string}} & React.InputHTMLAttributes<HTMLInputElement>;
export function Field({label,revealLabels,type,id:providedId,...props}:FieldProps){
  const generatedId=useId();const id=providedId||generatedId;
  const [visible,setVisible]=useState(false);const password=type==="password";
  const input=<input {...props} id={id} type={password&&visible?"text":type} className={`h-madevi-46 w-full rounded-madevi-12 border border-madevi-line bg-madevi-surface px-madevi-14 text-madevi-text ${password?"pr-madevi-50":""} ${props.className||""}`.trim()}/>;
  return <div className="flex flex-col gap-madevi-7 text-xs font-bold"><label htmlFor={id}>{label}</label>{password?<span className="relative block">{input}<button type="button" className="absolute inset-y-0 right-0 grid w-madevi-43 place-items-center border-0 bg-transparent text-madevi-muted" aria-label={visible?(revealLabels?.hide||"Sembunyikan kata sandi"):(revealLabels?.show||"Tampilkan kata sandi")} aria-pressed={visible} onClick={()=>setVisible(value=>!value)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></span>:input}</div>
}
export function Button({variant="primary",children,...props}:{variant?:"primary"|"outline"}&React.ButtonHTMLAttributes<HTMLButtonElement>){return <button {...props} className={`inline-flex min-h-madevi-43 items-center justify-center gap-madevi-8 rounded-madevi-pill border border-madevi-text px-madevi-20 font-bold ${variant==="primary"?"bg-madevi-text text-madevi-surface":"bg-transparent text-madevi-text"} ${props.className||""}`.trim()}>{children}</button>}
export function StateMessage({kind="empty",children}:{kind?:"empty"|"loading"|"error"|"denied";children:React.ReactNode}){return <div className={kind==="empty"?"my-madevi-32 flex min-h-madevi-230 flex-col items-center justify-center rounded-madevi-20 border border-madevi-line text-madevi-muted":"rounded-madevi-12 bg-madevi-soft p-madevi-12 text-xs leading-normal"} role={kind==="error"||kind==="denied"?"alert":"status"}>{children}</div>}
export function DataTable({headers,children}:{headers:string[];children:React.ReactNode}){return <div className="overflow-x-auto"><table><thead><tr>{headers.map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>}
const focusSelector='a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[contenteditable="true"],[tabindex]:not([tabindex="-1"])';
function controls(node:HTMLElement){return Array.from(node.querySelectorAll<HTMLElement>(focusSelector)).filter(el=>!el.closest('[hidden],[inert],[aria-hidden="true"]')&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=="hidden"&&(el.tabIndex>=0||el.matches('[contenteditable="true"]')))}
function cycle(e:KeyboardEvent,node:HTMLElement){
  const list=controls(node);if(!list.length){e.preventDefault();node.focus();return}
  const current=document.activeElement;const first=list[0],last=list[list.length-1];
  if(!node.contains(current)){e.preventDefault();(e.shiftKey?last:first).focus()}
  else if(e.shiftKey&&current===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&current===last){e.preventDefault();first.focus()}
}
export function useFocusTrap(open:boolean,ref:React.RefObject<HTMLElement|null>,onEscape:()=>void){
  const close=useRef(onEscape);close.current=onEscape;
  useEffect(()=>{if(!open)return;const previous=document.activeElement as HTMLElement|null;const current=ref.current;if(!current)return;const node:HTMLElement=current;(controls(node)[0]||node).focus();function key(e:KeyboardEvent){if(node.querySelector('[role="dialog"][aria-modal="true"]'))return;if(e.key==="Escape"){e.preventDefault();close.current();return}if(e.key==="Tab")cycle(e,node)}document.addEventListener("keydown",key);return()=>{document.removeEventListener("keydown",key);if(previous?.isConnected)previous.focus()}},[open,ref]);
}
export function Dialog({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){
  const ref=useRef<HTMLDivElement>(null);const onCloseRef=useRef(onClose);onCloseRef.current=onClose;
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const current=ref.current;if(!current)return;const node:HTMLElement=current;(controls(node)[0]||node).focus();function onKey(e:KeyboardEvent){if(e.key==="Escape"){e.preventDefault();e.stopPropagation();onCloseRef.current();return}if(e.key==="Tab")cycle(e,node)}document.addEventListener("keydown",onKey,true);return()=>{document.removeEventListener("keydown",onKey,true);if(previous?.isConnected)previous.focus()}},[]);
  return <div className="absolute inset-0 z-5 grid place-items-center bg-madevi-overlay p-madevi-18"><div ref={ref} tabIndex={-1} className="w-full rounded-madevi-20 bg-madevi-surface p-madevi-20 shadow-madevi" role="dialog" aria-modal="true" aria-label={title}>{children}</div></div>
}
