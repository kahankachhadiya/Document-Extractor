import { useMemo, useState, useRef, useEffect } from "react";
import { Plus, BookOpen, User, FileText, Target, Clock, Search, X, Shield, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import DynamicProfileForm from "@/components/DynamicProfileForm";
import ProfileCard from "@/components/ProfileCard";

import { useCreateProfile, useProfiles } from "@/lib/queries";
import { ProfileTransformer, ProfileFormData } from "@/lib/profileTransformer";
import { matchesSearchQuery } from "@/lib/searchUtils";

const Index = () => {
  const { data: profilesData = [] } = useProfiles();
  const createProfileMutation = useCreateProfile();
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const profiles = profilesData as any[];

  // Keyboard shortcut to focus search (Ctrl/Cmd + K)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter profiles based on search query
  const filteredProfiles = useMemo(() => {
    if (!searchQuery.trim()) return profiles;
    return profiles.filter((profile: any) => matchesSearchQuery(profile, searchQuery));
  }, [profiles, searchQuery]);



  const clearSearch = () => {
    setSearchQuery("");
  };

  const handleCreateProfile = (profileData: any) => {
    try {
      // The DynamicProfileForm already handles the API calls
      // Just close the dialog and refresh the page
      setIsCreateDialogOpen(false);
      
      // Refresh the profiles list
      window.location.reload();
    } catch (error) {
      console.error('Failed to create profile:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary-light/10 to-accent-light/10">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-gradient-primary rounded-xl flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  Form Master Pro
                </h1>
                <p className="text-sm text-muted-foreground">
                  Streamline your entrance exam applications
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={() => navigate('/admin')}
                className="hidden sm:flex"
              >
                <Shield className="h-4 w-4 mr-2" />
                Admin Panel
              </Button>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="btn-hero">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Profile
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Profile</DialogTitle>
                    <DialogDescription>
                      Start building your comprehensive student profile for entrance exam applications.
                    </DialogDescription>
                  </DialogHeader>
                  <DynamicProfileForm 
                    onSubmit={handleCreateProfile} 
                    onCancel={() => setIsCreateDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Quick Actions */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="h-5 w-5 mr-2 text-primary" />
              Quick Actions
            </CardTitle>
            <CardDescription>
              Common tasks to help you manage your applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                className="h-auto p-4 flex-col space-y-2"
                onClick={() => navigate('/upload-documents')}
              >
                <FileText className="h-8 w-8 text-primary" />
                <div className="text-center">
                  <div className="font-semibold">Upload Documents</div>
                  <div className="text-xs text-muted-foreground">Add certificates & marksheets</div>
                </div>
              </Button>

              <Button variant="outline" className="h-auto p-4 flex-col space-y-2">
                <BookOpen className="h-8 w-8 text-accent" />
                <div className="text-center">
                  <div className="font-semibold">View Guide</div>
                  <div className="text-xs text-muted-foreground">Learn how to use Form Master</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="h-auto p-4 flex-col space-y-2"
                onClick={() => navigate('/admin')}
              >
                <Shield className="h-8 w-8 text-orange-500" />
                <div className="text-center">
                  <div className="font-semibold">Admin Panel</div>
                  <div className="text-xs text-muted-foreground">System administration</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Profiles Section */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Your Profiles</h2>
              <p className="text-muted-foreground">
                Manage and organize your student profiles for different applications
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm">
                {searchQuery ? (
                  <>
                    <Search className="h-3 w-3 mr-1" />
                    {filteredProfiles.length} of {profiles.length}
                  </>
                ) : (
                  `${profiles.length}`
                )} Profile{profiles.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>

          {/* Search Bar */}
          {profiles.length > 0 && (
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search profiles by name, ID, or phone number... (Ctrl+K)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
                autoComplete="off"
                spellCheck="false"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {profiles.length === 0 ? (
            <Card className="card-elevated text-center py-16">
              <CardContent>
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No profiles yet</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Create your first profile to start managing your entrance exam applications efficiently.
                </p>
                <Button
                  className="btn-hero"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Profile
                </Button>
              </CardContent>
            </Card>
          ) : filteredProfiles.length === 0 ? (
            <Card className="card-elevated text-center py-16">
              <CardContent>
                <div className="h-16 w-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No profiles found</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  No profiles match your search for "{searchQuery}". Try searching with a different name, ID, or phone number.
                </p>
                <Button
                  variant="outline"
                  onClick={clearSearch}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Search
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {searchQuery && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Search className="h-4 w-4" />
                  <span>
                    Showing {filteredProfiles.length} result{filteredProfiles.length !== 1 ? 's' : ''} for "{searchQuery}"
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProfiles.map((p: any, index: number) => {
                  const cardProfile = {
                    id: p.id,
                    name: p.personalInfo?.fullName || "Unnamed Profile",
                    email: p.contactInfo?.emailId || "",
                    phone: p.contactInfo?.mobileNumber || "",
                    completion: p.completionPercentage ?? 0,
                    status: p.status || "draft",
                    exams: Object.entries(p.examinationDetails || {})
                      .filter(([key, value]) => Boolean(value))
                      .map(([key]) => key)
                      .slice(0, 3),
                    createdAt: p.createdAt,
                    lastUpdated: p.updatedAt,
                  };
                  return (
                    <ProfileCard
                      key={p.id}
                      profile={cardProfile}
                      className="animate-slide-up"
                      style={{ animationDelay: `${index * 100}ms` }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>


      </main>
    </div>
  );
};

export default Index;