import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 커스텀 도메인(vance.zip) 루트에서 서빙되므로 base 는 "/" 가 기본.
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [react()],
});
