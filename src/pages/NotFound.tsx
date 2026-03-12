import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useSEOHead } from "@/hooks/useSEOHead";
import { Link } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  useSEOHead({
    title: "Page Not Found — AiBridge",
    description: "The page you're looking for doesn't exist.",
    noindex: true,
  });

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-display font-bold text-foreground">404</h1>
        <p className="text-lg text-muted-foreground">This page doesn't exist.</p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/" className="text-primary hover:underline font-display text-sm">
            Go Home
          </Link>
          <Link to="/docs" className="text-primary hover:underline font-display text-sm">
            Read Docs
          </Link>
          <Link to="/dashboard" className="text-primary hover:underline font-display text-sm">
            Open Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
