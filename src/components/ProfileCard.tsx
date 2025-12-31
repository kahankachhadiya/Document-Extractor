import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  User,
  Trophy,
  FileText,
  MoreVertical,
  Trash2,
  Loader2
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useDeleteProfile } from "@/lib/queries";

interface ProfileCardProps {
  profile: {
    id: string;
    name: string;
    email: string;
    phone: string;
    completion: number;
    status: string;
    exams: string[];
    createdAt: string;
    lastUpdated: string;
  };
  className?: string;
  style?: React.CSSProperties;
}

const ProfileCard = ({ profile, className, style }: ProfileCardProps) => {

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();
  const deleteProfileMutation = useDeleteProfile();



  const handleDeleteProfile = async () => {
    try {
      await deleteProfileMutation.mutateAsync(profile.id);
      toast({
        title: "Profile deleted",
        description: `${profile.name}'s profile has been permanently deleted`,
        duration: 3000,
      });
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast({
        title: "Failed to delete profile",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
        duration: 3000,
      });
    }
  };



  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <Card className={cn(
      "card-profile hover:shadow-xl transition-all duration-300",
      deleteProfileMutation.isPending && "opacity-50 pointer-events-none",
      className
    )} style={style}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center">
              <User className="h-4 w-4 mr-2 text-primary" />
              {profile.name}
            </CardTitle>
            <div className="flex items-center text-sm text-muted-foreground">
              <span className="font-mono">{profile.id}</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">

                <DropdownMenuItem asChild>
                  <Link to={`/profile/${profile.id}`}>
                    <FileText className="h-4 w-4 mr-2" />
                    View Details
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={(e) => {
                        e.preventDefault();
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Profile
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Profile</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete <strong>{profile.name}'s</strong> profile?
                        This action cannot be undone and will permanently remove all associated data including:
                        <br />
                        <br />
                        • Personal information
                        <br />
                        • Educational details
                        <br />
                        • Family information
                        <br />
                        • Uploaded documents
                        <br />
                        • Application history
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteProfile}
                        disabled={deleteProfileMutation.isPending}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteProfileMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Profile
                          </>
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">




        {/* Exams Section */}
        {profile.exams.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center text-sm font-medium">
              <Trophy className="h-4 w-4 mr-2 text-primary" />
              Target Exams
            </div>
            <div className="flex flex-wrap gap-1">
              {profile.exams.map((exam, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {exam}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
          <div className="flex items-center justify-between">
            <span>Created: {formatDate(profile.createdAt)}</span>
            <span>Updated: {formatDate(profile.lastUpdated)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-2">
          <Link to={`/profile/${profile.id}`} className="flex-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
            >
              <FileText className="h-4 w-4 mr-2" />
              View Profile
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileCard;