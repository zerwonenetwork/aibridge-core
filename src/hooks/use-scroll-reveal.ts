import { useRef } from "react";
import { useInView } from "framer-motion";

export function useScrollReveal(margin: string = "-80px") {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: margin as `${number}px` });
  return { ref, isInView };
}
