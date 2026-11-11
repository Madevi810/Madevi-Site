export const rolePermissions = {
  user: [],
  author: ["content.create", "content.editOwn", "content.submitOwn", "content.readOwn"],
  reviewer: ["content.readAny", "content.review", "content.publish"],
  moderator: ["content.readAny", "content.moderate", "reports.read"],
  admin: ["content.create", "content.editOwn", "content.editAny", "content.submitOwn", "content.submitAny", "content.readOwn", "content.readAny", "content.review", "content.publish", "content.moderate", "accounts.manage", "reports.read"],
} as const;
export type Role = keyof typeof rolePermissions;
export type Permission = "content.create"|"content.editOwn"|"content.editAny"|"content.submitOwn"|"content.submitAny"|"content.readOwn"|"content.readAny"|"content.review"|"content.publish"|"content.moderate"|"accounts.manage"|"reports.read";
export function can(role: string | null | undefined, permission: Permission): boolean {
  return Object.hasOwn(rolePermissions, role || "") && (rolePermissions[role as Role] as readonly string[]).includes(permission);
}
export function canEdit(role: string | null | undefined, actorId: string, ownerId: string): boolean {
  return can(role, "content.editAny") || (actorId === ownerId && can(role, "content.editOwn"));
}

