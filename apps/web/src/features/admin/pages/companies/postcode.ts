/** Daum(Kakao) 우편번호 서비스 — loaded on demand (the PHP form used the old spi.maps.daum.net URL). */
export interface PostcodeResult { zonecode: string; address: string; buildingName: string }

const SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
let loading: Promise<void> | null = null;

declare global { interface Window { daum?: { Postcode: new (opts: { oncomplete: (data: { zonecode: string; address: string; roadAddress?: string; buildingName?: string }) => void; onclose?: () => void }) => { open: () => void } } } }

function load(): Promise<void> {
  if (window.daum?.Postcode) return Promise.resolve();
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SRC; s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { loading = null; reject(new Error('postcode script failed')); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

/** Opens the postcode layer; resolves with the pick, or null when the user closes it. Rejects when the script cannot load (offline / blocked). */
export async function openPostcode(): Promise<PostcodeResult | null> {
  await load();
  return new Promise((resolve) => {
    let done = false;
    new window.daum!.Postcode({
      oncomplete: (d) => { done = true; resolve({ zonecode: d.zonecode, address: d.roadAddress || d.address, buildingName: d.buildingName ?? '' }); },
      onclose: () => { if (!done) resolve(null); },
    }).open();
  });
}

/** "0212345678" → "02-1234-5678", "01012345678" → "010-1234-5678"; anything already hyphenated or non-numeric is returned as typed. */
export function autoHyphen(v: string): string {
  const d = v.replace(/\D/g, '');
  if (!/^\d+$/.test(v) || d.length < 9 || d.length > 11) return v;
  if (d.startsWith('02')) return d.length === 9 ? `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}` : `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}
