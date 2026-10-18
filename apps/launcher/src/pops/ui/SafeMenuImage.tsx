import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { resolveMenuImageUrl } from "../lib/menuImageUrl";

type SafeMenuImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  imageUrl: string | null | undefined;
  /** Rendered when there is no URL or the image fails to load (e.g. wiped /uploads). */
  fallback: ReactNode;
  /** Stretch photo edge-to-edge inside a positioned parent (`absolute inset-0 object-cover`). */
  fill?: boolean;
};

/**
 * Resolves menu/category photos and falls back when a stored `/uploads/...`
 * path 404s after a deploy (ephemeral disk).
 */
export function SafeMenuImage({
  imageUrl,
  fallback,
  alt = "",
  fill = false,
  ...imgProps
}: SafeMenuImageProps): JSX.Element {
  const resolved = resolveMenuImageUrl(imageUrl);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  if (!resolved || failed) {
    return <>{fallback}</>;
  }

  const { className, style, ...rest } = imgProps;
  const fillClass = fill
    ? "pointer-events-none absolute inset-0 block h-full w-full max-h-none max-w-none object-cover object-center"
    : "block";
  return (
    <img
      {...rest}
      src={resolved}
      alt={alt}
      className={[fillClass, className].filter(Boolean).join(" ")}
      style={
        fill
          ? {
              ...style,
              objectFit: "cover",
              objectPosition: "center",
              width: "100%",
              height: "100%",
            }
          : style
      }
      onError={() => setFailed(true)}
    />
  );
}
