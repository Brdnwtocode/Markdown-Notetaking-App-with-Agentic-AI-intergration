// Re-export the session-aware apiJson from httpClient.
// All requests through this function now automatically carry x-session-id,
// enabling ConversationBuffer / UserProfile / InteractionStore on FastAPI.
export { apiJson } from "./httpClient";
