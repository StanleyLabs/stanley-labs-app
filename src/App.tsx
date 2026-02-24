import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Shell } from "./components/Shell";
import { RequireAuth } from "./components/RequireAuth";
import { ThemeProvider } from "./features/tasks/theme";
import { AuthProvider } from "./lib/AuthContext";
import { usePageMeta } from "./hooks/usePageMeta";
import Home from "./pages/Home";
import Login from "./pages/Login";

const TasksApp = lazy(() => import("./features/tasks/TasksApp"));
const BoardsApp = lazy(() => import("./features/boards/BoardsApp"));
const ChatApp = lazy(() => import("./features/chat/ChatApp"));

function Loading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-electric/30 border-t-electric" />
    </div>
  );
}

export default function App() {
  usePageMeta();

  return (
    <AuthProvider>
      <ThemeProvider>
        <Shell>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
              <Route path="/tasks/*" element={<RequireAuth><TasksApp /></RequireAuth>} />
              <Route path="/boards/*" element={<RequireAuth><BoardsApp /></RequireAuth>} />
              <Route path="/chat/*" element={<RequireAuth><ChatApp /></RequireAuth>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Shell>
      </ThemeProvider>
    </AuthProvider>
  );
}
