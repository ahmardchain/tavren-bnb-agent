import { httpBasic, withAuthChallenges, type AuthFn } from "eve/channels/auth";

/** Read the secret per request; an absent secret never grants access. */
export function operatorAccess(
  getPassword = () => process.env.TAVREN_AGENT_PASSWORD,
): AuthFn<Request> {
  return withAuthChallenges<Request>(
    (request) => {
      const password = getPassword();
      if (!password) return null;
      return httpBasic({ username: "tavren", password })(request);
    },
    [{ scheme: "Basic", parameters: { realm: "Tavren operator", charset: "UTF-8" } }],
  );
}
