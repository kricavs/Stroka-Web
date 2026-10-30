import Image from "next/image";
import { focalStyle } from "@/lib/home-shared";

// Fills its (relative, overflow-hidden) parent applying the non-destructive crop.
export default function FocalImage({ image, alt = "", sizes, priority = false, className = "" }) {
  return (
    <Image
      src={image.src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      quality={85}
      className={`object-cover ${className}`}
      style={focalStyle(image)}
    />
  );
}
