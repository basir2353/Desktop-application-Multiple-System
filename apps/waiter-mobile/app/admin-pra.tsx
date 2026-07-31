import { Redirect } from "expo-router";

/** Legacy route — Tax controls live on admin-tax now. */
export default function AdminPraRedirect() {
  return <Redirect href="/admin-tax" />;
}
