import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { resolveMenuImageUrl } from "../lib/menuImageUrl";

type SafeMenuImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  imageUrl: string | null | undefined;
  /** Rendered when there is no URL or the image fails to load (e.g. wiped /uploads). */
  fallback: ReactNode;
};

/**
 * Resolves menu/category photos and falls back when a stored `/uploads/...`
 * path 404s after a deploy (ephemeral disk).
 */
export function SafeMenuImage({ imageUrl, fallback, alt = "", ...imgProps }: SafeMenuImageProps): JSX.Element {
  const resolved = resolveMenuImageUrl(imageUrl);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  if (!resolved || failed) {
    return <>{fallback}</>;
  }

  return (
    <img
      {...imgProps}
      src={resolved}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}
