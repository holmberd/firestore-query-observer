import { query, where, onSnapshot, Timestamp } from 'firebase/firestore';

import EventEmitter from './EventEmitter';
import AbstractTimestampStore from './AbstractTimestampStore';
import DefaultTimestampStore from './DefaultTimestampStore';

const ChangeType = {
  ADDED: 'added',
  MODIFIED: 'modified',
  REMOVED: 'removed',
};

const Event = {
  DOCUMENT_CREATED: 'DOCUMENT_CREATED',
  DOCUMENT_REMOVED: 'DOCUMENT_REMOVED',
  DOCUMENT_UPDATED: 'DOCUMENT_UPDATED',
};

export default class Observer {
  unsubscribeToken = null;

  /**
   * @param {CollectionReference} collectionRef
   * @param {string} lastUpdatedField - Document last updated field key.
   * @param {string} storeKey - Store key for last sync timestamp.
   * @param {TimestampStore} [store] - Last sync timestamp store instance, defaults to localstorage.
   * @returns {Observer}
   */
  constructor(collectionRef, lastUpdatedField, storeKey, store = new DefaultTimestampStore(storeKey)) {
    this.store = store;
    this.events = new EventEmitter();
    this.collectionRef = collectionRef;
    this.lastUpdatedField = lastUpdatedField;
  }

  /**
   * Creates an Observer factory that uses the custom store for storing last sync timestamps.
   * @static
   * *
   * @param {TimestampStore} store
   * @param {CollectionReference} [collectionRef]
   * @param {string} [lastUpdatedField]
   */
  static createFactory(store, collectionRef, lastUpdatedField) {
    if (!(store instanceof AbstractTimestampStore)) {
      throw Error('store is not an instance of TimestampStore');
    }
    return {
      create(_collectionRef = collectionRef, _lastUpdatedField = lastUpdatedField) {
        return Observer.create(store, _collectionRef, _lastUpdatedField);
      },
    };
  }

  static create(store, collectionRef, lastUpdatedField) {
    return new Observer(collectionRef, lastUpdatedField, null, store);
  }

  /**
   * @public
   * @param {function} callback
   */
  onCreated(callback) {
    this.events.on(Event.DOCUMENT_CREATED, callback);
  }

  /**
   * @public
   * @param {function} callback
   */
  onUpdated(callback) {
    this.events.on(Event.DOCUMENT_UPDATED, callback);
  }

  /**
   * @public
   * @param {function} callback
   */
  onRemoved(callback) {
    this.events.on(Event.DOCUMENT_REMOVED, callback);
  }

  /**
   * Start observing a query.
   * @public
   * @async
   */
  async connect() {
    const timestamp = await this.getLastSyncTimestamp();

    //  If an error occrus the listener will not receive any more events.
    return this.addQueryListener(timestamp, (err) => {
      throw err;
    });
  }

  /**
   * Stop observing a query.
   * @public
   */
  disconnect() {
    this.removeQueryListener();
  }

  /**
   * Clears the last sync timestamp from storage.
   * @public
   */
  clearLastSyncTimestamp() {
    return this.store.remove();
  }

  addQueryListener(timestamp, errorCallback) {
    if (this.unsubscribeToken) {
      console.warn('Listener is already subscribed.');
      return false;
    }
    this.unsubscribeToken = this.onQuerySnapshot(
      timestamp,
      async (snapshot) => {
        try {
          await this.collectionListenerCallback(snapshot);
        } catch (err) {
          return errorCallback(err);
        }
      },
      errorCallback
    );
    return this.unsubscribeToken;
  }

  onQuerySnapshot(timestamp, callback, errorCallback) {
    return onSnapshot(
      query(
        this.collectionRef,
        where(this.lastUpdatedField, '>', timestamp.toDate()),
      ),
      callback,
      errorCallback
    );
  }

  async collectionListenerCallback(snapshot) {
    if (!snapshot) {
      throw Error('No snapshot in windows listener');
    }

    if (snapshot.metadata.hasPendingWrites) {
      return;
    }

    const changes = snapshot.docChanges();
    const { ADDED, MODIFIED } = ChangeType;

    for (let change of changes) {
      const { type, doc } = change;
      const docData = doc.data();

      await this.updateLastSyncTimestamp(docData[this.lastUpdatedField]);

      if (type === ADDED) {
        if (docData.isDeleted) {
          this.events.emit(Event.DOCUMENT_REMOVED, doc);
          continue;
        }
        this.events.emit(Event.DOCUMENT_CREATED, doc);
      }

      if (type === MODIFIED) {
        if (docData.isDeleted) {
          this.events.emit(Event.DOCUMENT_REMOVED, doc);
          continue;
        }
        this.events.emit(Event.DOCUMENT_UPDATED, doc);
      }
    }
  }

  removeQueryListener() {
    if (!this.unsubscribeToken) {
      console.warn('No unsubcribe token');
      return;
    }
    this.unsubscribeToken();
    this.unsubscribeToken = null;
  }

  async getLastSyncTimestamp() {
    const data = await this.store.get();
    if (!data) {
      return Timestamp.fromDate(new Date(1990, 1, 1));
    }
    const { seconds, nanoseconds } = data;
    return new Timestamp(seconds, nanoseconds);
  }

  async updateLastSyncTimestamp(timestampData) {
    if (!timestampData || typeof timestampData !== 'object') {
      throw Error('Missing or invalid timestamp data', timestampData);
    }
    const lastSyncTimestamp = await this.getLastSyncTimestamp();
    const { seconds, nanoseconds } = timestampData;
    const newTimestamp = new Timestamp(seconds, nanoseconds);
    if (newTimestamp <= lastSyncTimestamp) {
      return false;
    }

    return this.store.set(timestampData);
  }
}
