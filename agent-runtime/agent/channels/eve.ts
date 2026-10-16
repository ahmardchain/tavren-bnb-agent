import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";
import { operatorAccess } from "../lib/operator-auth.ts";

export default eveChannel({
  auth: [
    // Server-to-server operator access; password stays in host secrets.
    operatorAccess(),
    // Lets the eve TUI and your Vercel deployments reach the deployed agent.
    vercelOidc(),
    // Open on localhost for `eve dev` and the REPL; ignored in production.
    localDev(),
  ],
});
