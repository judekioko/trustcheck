export const PLANS = {
  free: {
    key: "free",
    name: "Free",
    priceKES: 0,
    monthlyCheckLimit: 10,
    maxTeamMembers: 1,
  },
  pro: {
    key: "pro",
    name: "Pro",
    priceKES: 1500,
    monthlyCheckLimit: Infinity,
    maxTeamMembers: 10,
    billingPeriodDays: 30,
  },
};

export function getPlan(key) {
  return PLANS[key] || PLANS.free;
}
