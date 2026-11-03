import { createContext } from "react-router";
import type { Principal } from "./access";
import type { Services } from "./services";

export type AppContext = {
  services: Services;
  principal: Principal | null;
  publicUrl: string;
  vapidPublicKey: string | null;
};

/** Passed from the Hono server into every React Router loader/action. */
export const appContext = createContext<AppContext>();
