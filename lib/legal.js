// lib/legal.js
// The legal pages, in one place.
//
// These URLs were copy-pasted into settings.js and paywall.js separately, and
// the CDR policy had nowhere to live at all. They are about to move off a
// personal GitHub Pages site onto a Tend domain, and a value duplicated across
// three screens is a value that moves on two of them.
//
// The CDR policy is a separate document from the privacy policy, required of
// CDR Representatives, and the Rules expect a consumer to be able to reach it
// readily — so it belongs beside the other two, not buried.

const BASE = "https://zaiakhoshaba.github.io/tend-privacy-policy";

export const PRIVACY_URL = `${BASE}/`;
export const TERMS_URL   = `${BASE}/terms.html`;
export const CDR_URL     = `${BASE}/cdr.html`;

// Where a consumer takes a complaint we haven't resolved. Both are named in the
// CDR policy, and the dashboard shows them so nobody has to go looking.
export const OAIC_URL = "https://www.oaic.gov.au/privacy/privacy-complaints";
export const AFCA_URL = "https://www.afca.org.au";

// Shown to consumers as the address for a CDR complaint.
export const SUPPORT_EMAIL = "tend.budget.app@outlook.com";
