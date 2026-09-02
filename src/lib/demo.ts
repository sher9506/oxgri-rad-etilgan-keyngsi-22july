// Demo rejim — ro'yxatdan o'tmasdan 1 ta bepul urinish
// Har bo'lim uchun alohida kalit

export type DemoSection = 'material' | 'test' | 'kazus' | 'savoljavob';

const DEMO_KEY = 'fanfaster_demo_used';

interface DemoUsed {
  material: boolean;
  test: boolean;
  kazus: boolean;
  savoljavob: boolean;
}

function getDemoUsed(): DemoUsed {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (!raw) return { material: false, test: false, kazus: false, savoljavob: false };
    return { ...{ material: false, test: false, kazus: false, savoljavob: false }, ...JSON.parse(raw) };
  } catch {
    return { material: false, test: false, kazus: false, savoljavob: false };
  }
}

/** Bu bo'lim uchun demo urinish mavjudmi (hali ishlatilmaganmi)? */
export function isDemoAvailable(section: DemoSection): boolean {
  const used = getDemoUsed();
  return !used[section];
}

/** Demo urinishni ishlatilgan deb belgilash */
export function markDemoUsed(section: DemoSection): void {
  const used = getDemoUsed();
  used[section] = true;
  localStorage.setItem(DEMO_KEY, JSON.stringify(used));
}
