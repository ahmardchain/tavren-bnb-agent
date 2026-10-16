// Supplied by the project owner on 15 October 2026.
// This is an intended owner, not proof of ERC-8004 ownership or form submission.
export const CAMPAIGN_OWNER = "0x4Fc7C503265df9Ed4885042D8F711199E0eF5fB9" as const;
export const CAMPAIGN_CHAIN_ID = 97 as const;
// The owner reported submitting the official form on 16 October 2026.
// This records submission, not organizer verification or ERC-8004 registration.
export const REGISTRATION_STATUS = "submitted" as const;
export const REGISTRATION_EVIDENCE = { source: "owner-confirmation", date: "2026-10-16" } as const;
export const CAMPAIGN_GITHUB = "https://github.com/ahmardchain/tavren-bnb-agent";
export const CAMPAIGN_NAME = "Ahmard";
// Entry IDs verified from the official campaign-linked Google Form.
export const REGISTRATION_FORM = "https://docs.google.com/forms/d/e/1FAIpQLSccwIh4caBrOh46i2puSxFG5HX0DR68BHQjhl1Kn8cQ-XMGdw/viewform";
export function registrationUrl() {
  const url = new URL(REGISTRATION_FORM);
  url.searchParams.set("usp", "pp_url");
  url.searchParams.set("entry.1410487196", CAMPAIGN_NAME);
  url.searchParams.set("entry.1524204081", CAMPAIGN_OWNER);
  url.searchParams.set("entry.823465027", CAMPAIGN_GITHUB);
  return url.toString();
}
