export const Role = {
  SUPER_ADMIN: "SUPER_ADMIN",
  UNIT_ADMIN: "UNIT_ADMIN",
  WALI_KELAS: "WALI_KELAS",
  PARENT: "PARENT",
} as const;

export type Role = (typeof Role)[keyof typeof Role];
