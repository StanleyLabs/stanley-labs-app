import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const pageMeta: Record<string, { title: string; favicon: string }> = {
  "/tasks": { title: "Tasks - Stanley Labs", favicon: "/favicon-tasks.svg" },
  "/boards": { title: "Boards - Stanley Labs", favicon: "/favicon-boards.svg" },
  "/chat": { title: "Chat - Stanley Labs", favicon: "/favicon-chat.svg" },
  "/login": { title: "Sign in - Stanley Labs", favicon: "/favicon.svg" },
};

const defaultMeta = { title: "Stanley Labs", favicon: "/favicon.svg" };

export function usePageMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const key = Object.keys(pageMeta).find((k) => pathname.startsWith(k));
    const meta = key ? pageMeta[key] : defaultMeta;

    document.title = meta.title;

    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/svg+xml";
      document.head.appendChild(link);
    }
    link.href = meta.favicon;
  }, [pathname]);
}
