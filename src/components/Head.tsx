import { useEffect } from "react";

/** 문서 제목만 바꾸는 작은 훅 */
export function useTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
