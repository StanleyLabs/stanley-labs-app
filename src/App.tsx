import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Shell } from "./components/Shell";
import { ThemeProvider } from "./features/tasks/theme";
import Home from "./pages/Home";

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
  return (
    <ThemeProvider>
      <Shell>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tasks/*" element={<TasksApp />} />
            <Route path="/boards/*" element={<BoardsApp />} />
            <Route path="/chat/*" element={<ChatApp />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Shell>
    </ThemeProvider>
  );
}
