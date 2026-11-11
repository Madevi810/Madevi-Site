/** Cache is opt-in and must never be used for authenticated or private responses. */
export interface Cache { get<T>(key:string):Promise<T|undefined>; set<T>(key:string,value:T,ttlSeconds:number):Promise<void>; invalidate(key:string):Promise<void>; }
export class NoopCache implements Cache {
  async get<T>(_key:string):Promise<T|undefined>{return undefined}
  async set<T>(_key:string,_value:T,_ttlSeconds:number):Promise<void>{}
  async invalidate(_key:string):Promise<void>{}
}
/** This implementation is for local tests only; it is not shared across instances. */
export class MemoryCache implements Cache {
  private data=new Map<string,{value:unknown;expires:number}>();
  async get<T>(key:string):Promise<T|undefined>{const entry=this.data.get(key);if(!entry)return undefined;if(entry.expires<=Date.now()){this.data.delete(key);return undefined}return entry.value as T}
  async set<T>(key:string,value:T,ttlSeconds:number):Promise<void>{if(ttlSeconds<=0){this.data.delete(key);return}if(this.data.size>=500){const first=this.data.keys().next().value;if(first)this.data.delete(first)}this.data.set(key,{value,expires:Date.now()+ttlSeconds*1000})}
  async invalidate(key:string):Promise<void>{this.data.delete(key)}
}
export const cache:Cache = new NoopCache();

