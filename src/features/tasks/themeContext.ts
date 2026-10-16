import { createContext, useContext } from "react";

export type ThemeOption = "light" | "dark" | "system";

type ThemeCtx = {
  theme: ThemeOption;
  resolved: "light" | "dark";
  setTheme: (t: ThemeOption) => void;
};

export const ThemeContext = createContext<ThemeCtx>({
  theme: "system",
  resolved: "light",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}
