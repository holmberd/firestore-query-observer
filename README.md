# Firestore Query Observer
Firestore Query Observer provides an API wrapper library for Firestore realtime listeners designed for easy creation of realtime collection query listeners optimized for document reads.

## Overview

1. [Installation](#Installation)
4. [Usage](#Usage)
5. [API](#API)
2. [How it Works](#How-it-Works)
7. [License](#License)

## Installation
`npm install firestore-query-observer`

## Usage

```js
import firebase from 'firebase/app';
import {
  getFirestore,
  serverTimestamp,
  collection,
  writeBatch,
  doc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import Observer from 'firestore-query-observer';

firebase.initializeApp(firebaseConfig);

const CITIES_LAST_SYNC_KEY = 'citites-last-sync'; // Last sync timestamp storage key.
const LAST_UPDATED_FIELD = 'updatedAt'; // Our collection documents last updated field key.

const db = getFirestore();
const citiesRef = collection(db, 'cities');

// Add citites to the collection.

const newCities = [
  {
    name: 'Tokyo',
    country: 'Japan',
  },
  {
    name: 'Stockholm',
    country: 'Sweden',
  },
  {
    name: 'Vancouver',
    country: 'Canada',
  },
];


const batch = writeBatch(db);

for (let city in newCities) {
  let newCityRef = db.collection('cities').doc();
  batch.set(newCityRef, {
    ...city,
    [LAST_UPDATED_FIELD]: serverTimestamp()
  });
}

await batch.commit();

// Add a collection query listener.

const citiesObserver = new Observer(citiesRef, LAST_UPDATED_FIELD,  CITIES_LAST_SYNC_KEY);

await citiesObserver.connect(); // Start listening for changes.

citiesObserver.onCreated(doc => console.log(`city ${doc.data().name} created`));
citiesObserver.onUpdated(doc => console.log(`city ${doc.data().name} updated`));
citiesObserver.onRemoved(doc => console.log(`city ${doc.data().name} removed`));

const osloCityRef = doc(citiesRef);

// Create
await setDoc(osloCityRef, {
  name: 'Oslo',
  country: 'Norway',
  [LAST_UPDATED_FIELD]: serverTimestamp(),
});
// >> city Oslo created

// Update
await updateDoc(osloCityRef, {
  capital: true,
  [LAST_UPDATED_FIELD]: serverTimestamp(),
});
// >> city Oslo updated

// Delete
await updateDoc(osloCityRef, {
  isDeleted: true, // Required for the observer to detect deleted documents.
  [LAST_UPDATED_FIELD]: serverTimestamp(),
});
// >> city Oslo removed

citiesObserver.disconnect(); // Stop listening for changes.

citiesObserver.clearLastSyncTimestamp() // Clear last sync timestamp from storage.
```

## API

### `new Observer(collectionRef, lastUpdatedField, storeKey, store)`

- `collectionRef` \<CollectionReference\>
- `lastUpdatedField` \<string\>
- `storeKey` \<string\>
- `store` \<TimestampStore\> Optional TimestampStore, defaults to localstorage.
- Returns: \<Observer\>

### `Observer.createFactory(store, collectionRef, lastUpdatedField)`
Creates an Observer factory with a custom store for storing last sync timestamps.

- `store` \<TimestampStore\>
- `collectionRef` \<CollectionReference\> Optional.
- `lastUpdatedField` \<string\> Optional.
- Returns: \<object\>

Example Usage:
```js
const lastSyncTimestampStore = new TimestampStore(LAST_SYNC_TIMESTAMP_STORAGE_KEY, storage);
const observerFactory = Observer.createFactory(lastSyncTimestampStore);
const observer = observerFactory.create(collectionRef, LAST_MODIFIED_FIELD);
```

### `observer.connect()`
- Returns: \<Promise\>

### `observer.disconnect()`
Stop observing the collection query.

### `observer.clearLastSyncTimestamp()`
Clears the last sync timestamp.

### `observer.onCreate(callback)`
Called when a new document has been created.

- `callback` \<Function\>

### `observer.onUpdate(callback)`
Called when a document has been updated.

- `callback` \<Function\>

### `observer.onRemove(callback)`
Called when a document has been removed.

- `callback` \<Function\>

### TimestampStore
Extend the `AbstractTimestampStore` to create `TimestampStore` instances which can be used in the observer-factory to provide custom storage for the last sync timestamp.

## How it Works
When you add a Firestore realtime collection query listener, or if a listener is disconnected for more than 30 minutes, you are charged for a read for each document in that query when the listener is created. The reason for this behaviour is because it needs to read all the documents in the query so that it later can determine if a remote database update will trigger a local listener change event.

This library helps reduce the number of reads by creating a query that only listens for documents in a collection that has changed since the last time the local client synced with the cloud database. And since the steps involved in setting this up is a reusable pattern, this library and its API was added to make it easier to implement and re-use.

![image](https://user-images.githubusercontent.com/13058304/124199312-772fe600-da87-11eb-9760-b53101b11059.png)

## Considerations
Rmoving an observed document does not trigger a `DocumentChange` event in the local query listener. This requires us to update the `lastUpdated` field on the document and flag the document as deleted, i.e. `isDeleted`, to be able to detect the change.

Normally Firestore doesn't charge for removals in query listeners since it doesn't need to read and fetch the document data. But because we need to update the document we are charged for an extra write and read. This is worth considering if your collection only holds a small amount of documents and you are creating and removing documents at a high pace.

## License
See the LICENSE file.
