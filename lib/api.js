// envelope-mobile/lib/api.js
const BASE_URL = "http://192.168.0.170:4000"; // <-- your PC’s LAN IP + :4000

async function j(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function bankListNew() {
  return j("GET", "/bank/transactions?onlyNew=true");
}
export async function bankMarkImported(id) {
  return j("POST", "/bank/mark-imported", { id });
}
export async function bankGenerate() {
  return j("POST", "/bank/generate");
}
