import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import PostPage from "./pages/Post";
import SignIn from "./pages/SignIn";
import AuthCallback from "./pages/AuthCallback";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/p/:slug" element={<PostPage />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
    </Layout>
  );
}
