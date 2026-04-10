import { useState, useEffect, useCallback } from "react";

export type Route =
  | { page: "main"; category?: string }
  | { page: "item"; category: string; itemId: string }
  | { page: "au" }
  | { page: "au-item"; auId: string }
  | { page: "au-post"; auId: string; postId: string };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, "").replace(/\/$/, "");

  if (!path) return { page: "main" };

  const segments = path.split("/");

  if (segments[0] === "au") {
    if (segments.length === 1) return { page: "au" };
    if (segments.length === 2) return { page: "au-item", auId: decodeURIComponent(segments[1]) };
    if (segments.length === 3) return { page: "au-post", auId: decodeURIComponent(segments[1]), postId: decodeURIComponent(segments[2]) };
    return { page: "au" };
  }

  if (segments.length === 1) {
    return { page: "main", category: decodeURIComponent(segments[0]) };
  }
  if (segments.length === 2) {
    return {
      page: "item",
      category: decodeURIComponent(segments[0]),
      itemId: decodeURIComponent(segments[1]),
    };
  }

  return { page: "main" };
}

export function buildHash(route: Route): string {
  switch (route.page) {
    case "main":
      return route.category
        ? `#/${encodeURIComponent(route.category)}`
        : "#/";
    case "item":
      return `#/${encodeURIComponent(route.category)}/${encodeURIComponent(route.itemId)}`;
    case "au":
      return "#/au";
    case "au-item":
      return `#/au/${encodeURIComponent(route.auId)}`;
    case "au-post":
      return `#/au/${encodeURIComponent(route.auId)}/${encodeURIComponent(route.postId)}`;
  }
}

export function useHashRoute(): [Route, (route: Route, replace?: boolean) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const handler = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const navigate = useCallback((newRoute: Route, replace = false) => {
    const hash = buildHash(newRoute);
    if (replace) {
      window.history.replaceState(null, "", hash);
      setRoute(parseHash(hash));
    } else {
      window.location.hash = hash;
    }
  }, []);

  return [route, navigate];
}
