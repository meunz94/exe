import { useState, useEffect, useCallback } from "react";

export type Route =
  | { page: "main"; category?: string }
  | { page: "item"; category: string; itemId: string }
  | { page: "au" };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, "").replace(/\/$/, "");

  if (!path) return { page: "main" };
  if (path === "au") return { page: "au" };

  const segments = path.split("/");

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
