import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const ThemeContext = createContext(null);

function getInitialTheme() {
  if (typeof window === "undefined") return true;

  try {
    const stored = window.localStorage.getItem("theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
  } catch {}

  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? true;
}

function useThemeState() {
  const [isDark, setIsDark] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;

    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");

    try {
      window.localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch {}
  }, [isDark]);

  return { isDark, setIsDark };
}

export function ThemeProvider({ children }) {
  const value = useThemeState();
  const memoValue = useMemo(
    () => ({ isDark: value.isDark, setIsDark: value.setIsDark }),
    [value.isDark, value.setIsDark],
  );

  return (
    <ThemeContext.Provider value={memoValue}>{children}</ThemeContext.Provider>
  );
}

export default function useThemeToggle() {
  const context = useContext(ThemeContext);
  return context || useThemeState();
}
