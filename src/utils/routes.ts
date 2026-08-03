export type Route =
  | { page: "main"; category?: string }
  | { page: "item"; category: string; itemId: string }
  | { page: "au" }
  | { page: "au-item"; auId: string }
  | { page: "au-post"; auId: string; postId: string };
