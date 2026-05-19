import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { ThemeProvider } from "@plannotator/ui/components/ThemeProvider";
import { createAppRouter } from "./app/router";
import "./styles.css";

document.cookie = "plannotator-color-theme=neutral; path=/; max-age=31536000; SameSite=Lax";
document.cookie = "plannotator-theme=dark; path=/; max-age=31536000; SameSite=Lax";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Plannotator frontend root element was not found.");
}

const router = createAppRouter();

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider defaultColorTheme="neutral">
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
);
