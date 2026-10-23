import type { Scenario } from "@/contracts/types";

export const BUILTIN_SCENARIOS: readonly Scenario[] = [
  {
    id: "salary-raise",
    title: "Ask for a raise",
    userGoal: "Get your manager to agree to a 10% raise at your annual review.",
    counterpartRole: "Your manager, Dana, who controls a tight team budget",
    counterpartTraits: ["polite", "evasive", "budget-conscious"],
    difficulty: 3,
    openingLine:
      "Thanks for making time. I know you wanted to talk about compensation, but I should say up front that this has been a tough year for budgets.",
    hiddenBottomLine:
      "Can approve at most 6% now, or up to 8% if the raise starts after the next funding round in three months.",
  },
  {
    id: "faulty-refund",
    title: "Return a faulty product",
    userGoal: "Get a full refund for a laptop that stopped working after three weeks.",
    counterpartRole: "A store customer service agent following a returns policy",
    counterpartTraits: ["scripted", "friendly", "rule-bound"],
    difficulty: 2,
    openingLine:
      "Hi there, welcome to customer service. How can I help you today?",
    hiddenBottomLine:
      "Policy allows a full refund within 30 days for a defect, but only if the customer asks for it by name and has the receipt; otherwise the agent offers store credit.",
  },
  {
    id: "say-no-extra-work",
    title: "Say no to extra work",
    userGoal: "Decline a new project without damaging the relationship or your standing.",
    counterpartRole: "A senior colleague, Marcus, who keeps adding to your plate",
    counterpartTraits: ["charming", "persistent", "flattering"],
    difficulty: 3,
    openingLine:
      "Hey, perfect timing. I've got a small thing I'd love your help with. You're honestly the only one who can do it properly.",
    hiddenBottomLine:
      "Will accept a no if offered a smaller piece, such as a one-hour review next week, and a pointer to who else could take the rest.",
  },
  {
    id: "seed-pitch",
    title: "Pitch for seed funding",
    userGoal: "Convince an investor to lead a $1.5M seed round in your startup.",
    counterpartRole: "A seed investor, Priya, at a small early-stage fund",
    counterpartTraits: ["sceptical", "numbers-driven", "blunt", "interrupts"],
    difficulty: 4,
    openingLine:
      "I've got about twenty minutes. I read your deck, and honestly I have questions about the market size and why you, not someone better funded.",
    hiddenBottomLine:
      "Will invest $500k, not $1.5M, and only if there are three paying customers and a co-lead investor committed.",
  },
  {
    id: "rent-renewal",
    title: "Negotiate a rent renewal",
    userGoal: "Keep your rent flat when renewing the lease, instead of the proposed 8% increase.",
    counterpartRole: "Your landlord, Mr Okafor, who wants a long-term tenant",
    counterpartTraits: ["courteous", "set in his ways", "values reliability"],
    difficulty: 2,
    openingLine:
      "Good to see you. I've sent over the renewal paperwork. With rising costs I'm afraid the rent will go up 8 percent from next month.",
    hiddenBottomLine:
      "Would settle for a 2% increase on a 24-month lease, and prefers that to the cost of finding a new tenant.",
  },
];
