import { useQuery } from "@tanstack/react-query";
import { fetchPlatformPublicInfo } from "../lib/platformApi";

/** Global maintenance / support banner driven by Super Admin settings. */
export function MaintenanceBanner(): JSX.Element | null {
  const info = useQuery({
    queryKey: ["platform", "public-info"],
    queryFn: fetchPlatformPublicInfo,
    staleTime: 60_000,
    retry: false,
  });

  const message = info.data?.maintenanceMessage?.trim();
  if (!message) return null;

  const support = info.data?.supportEmail?.trim();

  return (
    <div
      role="status"
      className="border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-xs font-medium text-amber-900 dark:text-amber-100"
    >
      {message}
      {support ? (
        <>
          {" "}
          · Support:{" "}
          <a className="underline" href={`mailto:${support}`}>
            {support}
          </a>
        </>
      ) : null}
    </div>
  );
}
