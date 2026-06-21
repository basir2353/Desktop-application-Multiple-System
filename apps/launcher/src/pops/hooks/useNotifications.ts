import { useSessionStore } from "../../stores/sessionStore";
import { fieldInputClass } from "../lib/themeClasses";

export function useNotificationsAccess() {
  const claims = useSessionStore((s) => s.claims);
  const canManage =
    claims?.permissions.includes("*") ||
    claims?.permissions.includes("pops.notifications.manage");

  return { canManage };
}

export const notifyInputClass = fieldInputClass;
