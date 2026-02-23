import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeOption = "light" | "dark" | "system";

type ThemeCtx = {
  theme: ThemeOption;
  resolved: "light" | "dark";
  setTheme: (t: ThemeOption) => void;
};

const ThemeContext = createContext<ThemeCtx>({
  theme: "system",
  resolved: "light",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolve(theme: ThemeOption): "light" | "dark" {
  return theme === "system" ? getSystemTheme() : theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeOption>(() => {
    const stored = localStorage.getItem("theme");
    return (stored === "light" || stored === "dark" || stored === "system") ? stored : "system";
  });

  const [resolved, setResolved] = useState<"light" | "dark">(() => resolve(theme));

  function setTheme(t: ThemeOption) {
    setThemeState(t);
    localStorage.setItem("theme", t);
  }

  // Apply dark class to <html>
  useEffect(() => {
    const r = resolve(theme);
    setResolved(r);
    document.documentElement.classList.toggle("dark", r === "dark");
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const r = getSystemTheme();
      setResolved(r);
      document.documentElement.classList.toggle("dark", r === "dark");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
