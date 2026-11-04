import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./AppShell";
import { HomeScreen } from "../screens/HomeScreen";
import { TreeScreen } from "../screens/TreeScreen";
import { TopicsScreen } from "../screens/TopicsScreen";
import { ComponentsScreen } from "../screens/ComponentsScreen";
import { SignInScreen } from "../screens/SignInScreen";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomeScreen />} />
        <Route path="tree/:treeId" element={<TreeScreen />} />
        <Route path="topics" element={<TopicsScreen />} />
        <Route path="sign-in" element={<SignInScreen />} />
        <Route path="components" element={<ComponentsScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
