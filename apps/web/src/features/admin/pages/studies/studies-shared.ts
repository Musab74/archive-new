/** Pure helpers shared by the 학습관리 pages (mirrors hrd_manager/include/function.js). */

/** function.js StudyProgressLogExcelEstimate(): time hint in the 진도로그 엑셀 confirm. */
export function progressLogEstimate(members: number): string {
  if (members <= 10) return '30초~1분 정도 걸릴 수 있습니다.';
  if (members <= 25) return '1~2분 정도 걸릴 수 있습니다.';
  return '2~3분 정도 걸릴 수 있습니다.';
}

/** function.js StudyTimeExcel(): confirm text before the 일자별 학습시간 엑셀. */
export const DAILY_EXCEL_CONFIRM = '현재 검색조건으로 검색된 결과를 엑셀로 출력하시겠습니까?\n\n데이터가 많으면 시간이 걸릴 수 있습니다. 완료될 때까지 버튼을 다시 누르지 마세요.';
