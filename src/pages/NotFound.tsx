import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Home, AlertCircle } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary-light/10 to-accent-light/10 flex items-center justify-center p-4">
      <Card className="card-elevated max-w-lg w-full text-center">
        <CardContent className="pt-16 pb-16">
          <div className="h-20 w-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="text-4xl font-bold mb-4">404</h1>
          <h2 className="text-xl font-semibold mb-2">Page Not Found</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Sorry, we couldn't find the page you're looking for. The page might have been moved or doesn't exist.
          </p>
          <Link to="/">
            <Button className="btn-hero">
              <Home className="h-4 w-4 mr-2" />
              Return to Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
