/**
 * 홈 화면의 후임 로봇에게 떨어뜨린 견적서 파일을 견적관리 화면으로 넘겨주는 임시 보관함.
 * (화면 이동은 새로고침 없이 일어나므로 메모리에 잠깐 들고 있다가 견적관리 보드가 가져간다)
 */
let pending: File[] = [];

export function setPendingEstimateFiles(files: File[]) {
  pending = files;
}

export function hasPendingEstimateFiles() {
  return pending.length > 0;
}

export function takePendingEstimateFiles(): File[] {
  const files = pending;
  pending = [];
  return files;
}
