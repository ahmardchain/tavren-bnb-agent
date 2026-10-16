import { defineAgent } from "eve";
import { TAVREN_MODEL } from "./lib/model.ts";

export default defineAgent({
  model: TAVREN_MODEL,
  reasoning: "high",
});
