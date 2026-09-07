export const CategoryType = {
  INCOME: "INCOME",
  EXPENSE: "EXPENSE",
} as const;

export type CategoryType = (typeof CategoryType)[keyof typeof CategoryType];
