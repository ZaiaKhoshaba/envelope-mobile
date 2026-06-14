// lib/firestore-rest.js
// Writes user tracking data to Firestore via the REST API.
// Using plain fetch() avoids the Firebase JS SDK package-exports bundling
// issue that breaks Metro/Expo Go (firebase/auth, firebase/firestore can't
// be resolved without unstable Metro flags).

const PROJECT_ID = 'envelope-mobile';
const API_KEY    = 'AIzaSyBBDAbj2m6RLEH3spUhXQQMAf4aKGgIB2Y';
const BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Convert a plain JS object to Firestore REST field format
function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined)  fields[k] = { nullValue: null };
    else if (typeof v === 'boolean')    fields[k] = { booleanValue: v };
    else if (typeof v === 'number')     fields[k] = { integerValue: String(Math.round(v)) };
    else if (typeof v === 'string')     fields[k] = { stringValue: v };
    else if (v instanceof Date)         fields[k] = { timestampValue: v.toISOString() };
  }
  return fields;
}

// Write (overwrite) a document
export async function fsSet(collection, docId, data) {
  try {
    const resp = await fetch(
      `${BASE}/${collection}/${encodeURIComponent(docId)}?key=${API_KEY}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: toFields(data) }),
      }
    );
    return resp.ok;
  } catch (e) {
    console.log('fsSet error:', e.message);
    return false;
  }
}

// Partial update — only touch specified fields
export async function fsMerge(collection, docId, data) {
  try {
    const keys = Object.keys(data);
    const mask = keys.map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    const resp = await fetch(
      `${BASE}/${collection}/${encodeURIComponent(docId)}?key=${API_KEY}&${mask}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: toFields(data) }),
      }
    );
    return resp.ok;
  } catch (e) {
    console.log('fsMerge error:', e.message);
    return false;
  }
}

// Atomically increment a numeric field using Firestore field transforms
export async function fsIncrement(collection, docId, field, by = 1) {
  try {
    const resp = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          writes: [{
            transform: {
              document: `projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${encodeURIComponent(docId)}`,
              fieldTransforms: [{
                fieldPath: field,
                increment: { integerValue: String(by) },
              }],
            },
          }],
        }),
      }
    );
    return resp.ok;
  } catch (e) {
    console.log('fsIncrement error:', e.message);
    return false;
  }
}
