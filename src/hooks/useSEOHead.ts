import { useEffect } from "react";

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  noindex?: boolean;
  ogImage?: string;
}

/**
 * Lightweight SEO head manager for SPA pages.
 * Updates document.title and meta tags on mount.
 * Properly cleans up canonical/meta on route change.
 */
export function useSEOHead({ title, description, canonical, noindex = false, ogImage }: SEOHeadProps) {
  useEffect(() => {
    // Title
    document.title = title;

    // Description
    setMeta("description", description);

    // Canonical - manage properly to avoid leaks
    const existingCanonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) {
      if (existingCanonical) {
        existingCanonical.href = canonical;
      } else {
        const newCanonical = document.createElement("link");
        newCanonical.rel = "canonical";
        newCanonical.href = canonical;
        document.head.appendChild(newCanonical);
      }
    } else {
      // No canonical for this route - remove any existing one
      if (existingCanonical) {
        existingCanonical.remove();
      }
    }

    // Robots
    if (noindex) {
      setMeta("robots", "noindex, nofollow");
    } else {
      removeMeta("robots");
    }

    // OG tags
    setMetaProperty("og:title", title);
    setMetaProperty("og:description", description);
    if (ogImage) {
      setMetaProperty("og:image", ogImage);
    } else {
      removeMetaProperty("og:image");
    }

    // Twitter
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);

    // Cleanup on unmount/route change
    return () => {
      // Remove route-specific tags when navigating away
      // This ensures internal routes don't leak SEO tags to other routes
      if (noindex) {
        removeMeta("robots");
      }
    };
  }, [title, description, canonical, noindex, ogImage]);
}

function setMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

function removeMeta(name: string) {
  const el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (el) el.remove();
}

function setMetaProperty(property: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.content = content;
}

function removeMetaProperty(property: string) {
  const el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (el) el.remove();
}
