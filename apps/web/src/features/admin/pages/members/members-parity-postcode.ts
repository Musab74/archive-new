/**
 * member_write.php ZipcodeFind(): Daum(Kakao) 우편번호 → Zipcode = data.zonecode, Address01 = data.address,
 * Address02 = data.buildingName, then focus Address02.
 * data.address is the address of the type the user clicked (도로명 or 지번), unlike companies/postcode.ts which always
 * prefers the 도로명 (roadAddress). Same script URL, so a page that already loaded it reuses window.daum.
 */
export interface MemberPostcodePick { zonecode: string; address: string; buildingName: string }
type DaumData = { zonecode: string; address: string; roadAddress?: string; jibunAddress?: string; userSelectedType?: 'R' | 'J'; buildingName?: string };
type DaumCtor = new (opts: { oncomplete: (data: DaumData) => void; onclose?: () => void }) => { open: () => void };

const SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
let loading: Promise<void> | null = null;
const daum = () => (window as unknown as { daum?: { Postcode?: DaumCtor } }).daum;

function load(): Promise<void> {
  if (daum()?.Postcode) return Promise.resolve();
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

/** The PHP stored data.address as is (the clicked 도로명/지번 address). */
export function memberPostcodePick(d: DaumData): MemberPostcodePick {
  return { zonecode: d.zonecode, address: d.address, buildingName: d.buildingName ?? '' };
}

/** Opens the postcode layer; resolves with the pick, or null when closed. Rejects when the script cannot load. */
export async function openMemberPostcode(): Promise<MemberPostcodePick | null> {
  await load();
  const Postcode = daum()?.Postcode;
  if (!Postcode) throw new Error('postcode unavailable');
  return new Promise((resolve) => {
    let done = false;
    new Postcode({
      oncomplete: (d) => { done = true; resolve(memberPostcodePick(d)); },
      onclose: () => { if (!done) resolve(null); },
    }).open();
  });
}
