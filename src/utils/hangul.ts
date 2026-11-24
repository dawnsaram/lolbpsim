const CHOSEONG_LIST = [
  'ㄱ',
  'ㄲ',
  'ㄴ',
  'ㄷ',
  'ㄸ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅃ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅉ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
] as const;

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

/**
 * 문자열에서 공백을 제거하고 한글 음절을 초성으로 변환합니다.
 * 예: "리 신" -> "ㄹㅅ", "크산테" -> "ㅋㅅㅌ"
 */
export function extractChoseong(text: string): string {
  const compact = text.replace(/\s+/g, '');
  let result = '';

  for (const char of compact) {
    const code = char.charCodeAt(0);
    if (code >= HANGUL_START && code <= HANGUL_END) {
      const index = Math.floor((code - HANGUL_START) / 588);
      result += CHOSEONG_LIST[index] ?? char;
    } else {
      result += char.toLowerCase();
    }
  }

  return result;
}

function isChoseongOnly(query: string): boolean {
  return /^[ㄱ-ㅎ]+$/.test(query);
}

/**
 * 한글 이름, 영문 이름, 한글 초성 검색을 모두 지원합니다.
 */
export function matchesChampionQuery(
  nameKo: string,
  nameEn: string,
  rawQuery: string,
): boolean {
  const query = rawQuery.trim().toLowerCase().replace(/\s+/g, '');
  if (!query) return true;

  const compactKo = nameKo.replace(/\s+/g, '').toLowerCase();
  const compactEn = nameEn.replace(/\s+/g, '').toLowerCase();

  if (compactKo.includes(query) || compactEn.includes(query)) {
    return true;
  }

  if (isChoseongOnly(query)) {
    return extractChoseong(nameKo).includes(query);
  }

  return false;
}
