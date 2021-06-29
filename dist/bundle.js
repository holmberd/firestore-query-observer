(()=>{var c=class{constructor(){this._events={},this._counter=0}on(t,e){this._events[t]||(this._events[t]=[]);let s=this._counter++;return this._events[t].push({listener:e,token:s}),s}emit(t,...e){return this._events[t]?(this._events[t].forEach(s=>s.listener(...e)),!0):!1}removeListener(t,e){if(this._events[t]&&e){let s=this._events[t].findIndex(n=>n.token===e);if(s>-1)return this._events[t].splice(s,1),!0}return!1}removeAllListeners(t){return this._events[t]?(delete this._events[t],!0):!1}};var a=class{constructor(t){this.key=t}async get(){throw Error("Not implemented")}async set(t){throw Error("Not implemented")}async remove(){throw Error("Not implemented")}};var D={ADDED:"added",MODIFIED:"modified",REMOVED:"removed"},i={DOCUMENT_CREATED:"DOCUMENT_CREATED",DOCUMENT_REMOVED:"DOCUMENT_REMOVED",DOCUMENT_UPDATED:"DOCUMENT_UPDATED"},d=class extends a{constructor(t){super(t);this.storage=window.localStorage}async get(){return JSON.parse(this.storage.getItem(this.key))}async set(t){return this.storage.setItem(this.key,JSON.stringify(t))}async remove(t){return this.storage.removeItem(this.key,t)}},o=class{unsubscribeToken=null;constructor(t,e,s,n,l=new d(n)){this.store=l,this.events=new c,this.firestore=t,this.collectionRef=e,this.lastUpdatedField=s}static createFactory(t){if(!(t instanceof a))throw Error("store is not an instance of AbstractStore");return(...e)=>o.create(...e,t)}static create(t,e,s,n){return new o(t,e,s,n)}onCreated(t){this.events.on(i.DOCUMENT_UPDATED,t)}onUpdated(t){this.events.on(i.DOCUMENT_UPDATED,t)}onRemoved(t){this.events.on(i.DOCUMENT_REMOVED,t)}async connect(){let t=await this.getLastSyncTimestamp();return this.addCollectionListener(t)}disconnect(){this.removeCollectionListener()}clearLastSyncTimestamp(){return this.store.remove(this.lastSyncStorageKey)}async addCollectionListener(t){return this.unsubscribeToken?(console.warn("Listener is already subscribed."),!1):(this.unsubscribeToken=this.onCollectionSnapshot(t,e=>{try{return this.collectionListenerCallback(null,e)}catch(s){this.collectionListenerCallback(s)}},this.collectionListenerCallback),this.unsubscribeToken)}onCollectionSnapshot(t,e,s){return this.collectionRef.where(this.lastUpdatedField,">",t).onSnapshot(e,s)}async collectionListenerCallback(t,e){if(t)throw t;if(!e)throw Error("No snapshot in windows listener");if(e.metadata.hasPendingWrites)return;let s=e.docChanges(),{ADDED:n,MODIFIED:l}=D;for(let E of s){let{type:u,doc:m}=E,r=m.data();if(await this.updateLastSyncTimestamp(r[this.lastUpdatedField]),u===n){if(r.isDeleted){this.events.emit(i.DOCUMENT_REMOVED,r);continue}this.events.emit(i.DOCUMENT_CREATED,r)}if(u===l){if(r.isDeleted){this.events.emit(i.DOCUMENT_REMOVED,r);continue}this.events.emit(i.DOCUMENT_UPDATED,r)}}}removeCollectionListener(){if(!this.unsubscribeToken){console.warn("No unsubcribe token");return}this.unsubscribeToken(),this.unsubscribeToken=null}async getLastSyncTimestamp(){let t=this.store.get(this.lastSyncStorageKey);if(!t)return this.firestore.Timestamp.fromDate(new Date(1900,1,1));let{seconds:e,nanoseconds:s}=JSON.parse(t);return new this.firestore.Timestamp(e,s).toDate()}async updateLastSyncTimestamp(t){if(!t)throw Error("Missing required argument: timestamp");return this.store(this.lastSyncStorageKey,t)}};})();
