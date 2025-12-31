import { useMemo, useState, useRef, useEffect } from "react";
import { Plus, BookOpen, User, FileText, Target, Clock, Search, X, Shield, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [isGuideOpen, setIsGuideOpen] = useState(false);
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

              <Button 
                variant="outline" 
                className="h-auto p-4 flex-col space-y-2"
                onClick={() => setIsGuideOpen(true)}
              >
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

      {/* User Guide Dialog */}
      <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center text-2xl">
              <BookOpen className="h-6 w-6 mr-2 text-primary" />
              Form Master Pro - User Guide / યુઝર ગાઈડ
            </DialogTitle>
            <DialogDescription>
              Learn how to use Form Master Pro effectively / Form Master Pro નો અસરકારક રીતે ઉપયોગ કેવી રીતે કરવો તે શીખો
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="english" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="english">English</TabsTrigger>
              <TabsTrigger value="gujarati">ગુજરાતી</TabsTrigger>
            </TabsList>
            
            <TabsContent value="english">
              <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-6 text-sm">
                  
                  <section>
                    <h3 className="text-lg font-semibold text-primary mb-2">📋 What is Form Master Pro?</h3>
                    <p className="text-muted-foreground">
                      Form Master Pro is a comprehensive profile management system designed to help you create, manage, and organize student profiles for entrance exam applications. It simplifies the process of collecting and storing personal information, documents, and other important details.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-primary mb-2">🏠 Dashboard (Home Page)</h3>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li><strong>Create Profile:</strong> Click the "Create Profile" button to add a new student profile</li>
                      <li><strong>Upload Documents:</strong> Upload certificates, marksheets, and other documents</li>
                      <li><strong>View Guide:</strong> Access this help guide anytime</li>
                      <li><strong>Admin Panel:</strong> Access system administration (for administrators only)</li>
                      <li><strong>Search Profiles:</strong> Use the search bar (Ctrl+K) to quickly find profiles by name, ID, or phone number</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-primary mb-2">👤 Creating a New Profile</h3>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                      <li>Click the "Create Profile" button on the dashboard</li>
                      <li>Fill in the Personal Details tab (First Name is required)</li>
                      <li>Navigate to the Documents tab to upload required documents</li>
                      <li>Click "Create Profile" to save</li>
                    </ol>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-primary mb-2">📄 Managing Documents</h3>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li>Click on any profile card to view profile details</li>
                      <li>Go to the "Documents" tab to view, upload, or manage documents</li>
                      <li>Supported formats: PDF, JPG, PNG</li>
                      <li>Documents are automatically linked to the profile</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-primary mb-2">✏️ Editing Profile Information</h3>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li>Click on a profile card to open profile details</li>
                      <li>Click "Edit Information" button</li>
                      <li>Make your changes in the form</li>
                      <li>Click "Save" to update the profile</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-primary mb-2">🔍 Searching Profiles</h3>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li>Use the search bar at the top of the profiles section</li>
                      <li>Press Ctrl+K to quickly focus on search</li>
                      <li>Search by name, profile ID, or phone number</li>
                      <li>Results update instantly as you type</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-primary mb-2">⚙️ Admin Panel (For Administrators)</h3>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li><strong>Database Management:</strong> Add, edit, or delete database tables and columns</li>
                      <li><strong>Form Builder:</strong> Create and customize forms with drag-and-drop fields</li>
                      <li><strong>Document Parsing:</strong> Configure automatic document data extraction</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-primary mb-2">💡 Tips & Shortcuts</h3>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li><strong>Ctrl+K:</strong> Quick search</li>
                      <li>Required fields are marked with a red asterisk (*)</li>
                      <li>Save your work frequently to avoid data loss</li>
                      <li>Use clear, descriptive names for easy identification</li>
                    </ul>
                  </section>

                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="gujarati">
              <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-6 text-sm">
                  
                  <section>
                    <h3 className="text-lg font-semibold text-primary mb-2">📋 Form Master Pro શું છે?</h3>
                    <p className="text-muted-foreground">
                      Form Master Pro એ એક વ્યાપક પ્રોફાઇલ મેનેજમેન્ટ સિસ્ટમ છે જે તમને પ્રવેશ પરીક્ષા અરજીઓ માટે વિદ્યાર્થી પ્રોફાઇલ બનાવવા, મેનેજ કરવા અને ગોઠવવામાં મદદ કરે છે. તે વ્યક્તિગત માહિતી, દસ્તાવેજો અને અન્ય મહત્વપૂર્ણ વિગતો એકત્રિત કરવાની અને સંગ્રહિત કરવાની પ્રક્રિયાને સરળ બનાવે છે.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-primary mb-2">🏠 ડેશબોર્ડ (હોમ પેજ)</h3>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li><strong>પ્રોફાઇલ બનાવો:</strong> નવી વિદ્યાર્થી પ્રોફાઇલ ઉમેરવા માટે "Create Profile" બટન પર ક્લિક કરો</li>
                      <li><strong>દસ્તાવેજો અપલોડ કરો:</strong> પ્રમાણપત્રો, માર્કશીટ અને અન્ય દસ્તાવેજો અપલોડ કરો</li>
                      <li><strong>ગાઈડ જુઓ:</strong> આ મદદ માર્ગદર્શિકા ગમે ત્યારે જુઓ</li>
                      <li><strong>એડમિન પેનલ:</strong> સિસ્ટમ એડમિનિસ્ટ્રેશન એક્સેસ કરો (ફક્ત એડમિનિસ્ટ્રેટર માટે)</li>
                      <li><strong>પ્રોફાઇલ શોધો:</strong> નામ, ID અથવા ફોન નંબર દ્વારા પ્રોફાઇલ ઝડપથી શોધવા માટે સર્ચ બાર (Ctrl+K) નો ઉપયોગ કરો</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-primary mb-2">👤 નવી પ્રોફાઇલ બનાવવી</h3>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                      <li>ડેશબોર્ડ પર "Create Profile" બટન પર ક્લિક કરો</li>
                      <li>Personal Details ટેબમાં માહિતી ભરો (First Name ફરજિયાત છે)</li>
                      <li>જરૂરી દસ્તાવેજો અપલોડ કરવા Documents ટેબ પર જાઓ</li>
                      <li>સેવ કરવા માટે "Create Profile" પર ક્લિક કરો</li>
                    </ol>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-primary mb-2">📄 દસ્તાવેજો મેનેજ કરવા</h3>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li>પ્રોફાઇલ વિગતો જોવા માટે કોઈપણ પ્રોફાઇલ કાર્ડ પર ક્લિક કરો</li>
                      <li>દસ્તાવેજો જોવા, અપલોડ કરવા અથવા મેનેજ કરવા માટે "Documents" ટેબ પર જાઓ</li>
                      <li>સપોર્ટેડ ફોર્મેટ: PDF, JPG, PNG</li>
                      <li>દસ્તાવેજો આપોઆપ પ્રોફાઇલ સાથે લિંક થાય છે</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-primary mb-2">✏️ પ્રોફાઇલ માહિતી એડિટ કરવી</h3>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li>પ્રોફાઇલ વિગતો ખોલવા માટે પ્રોફાઇલ કાર્ડ પર ક્લિક કરો</li>
                      <li>"Edit Information" બટન પર ક્લિક કરો</li>
                      <li>ફોર્મમાં તમારા ફેરફારો કરો</li>
                      <li>પ્રોફાઇલ અપડેટ કરવા માટે "Save" પર ક્લિક કરો</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-primary mb-2">🔍 પ્રોફાઇલ શોધવી</h3>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li>પ્રોફાઇલ સેક્શનની ટોચ પર સર્ચ બારનો ઉપયોગ કરો</li>
                      <li>સર્ચ પર ઝડપથી ફોકસ કરવા માટે Ctrl+K દબાવો</li>
                      <li>નામ, પ્રોફાઇલ ID અથવા ફોન નંબર દ્વારા શોધો</li>
                      <li>તમે ટાઇપ કરો તેમ પરિણામો તરત જ અપડેટ થાય છે</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-primary mb-2">⚙️ એડમિન પેનલ (એડમિનિસ્ટ્રેટર માટે)</h3>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li><strong>ડેટાબેઝ મેનેજમેન્ટ:</strong> ડેટાબેઝ ટેબલ અને કોલમ ઉમેરો, એડિટ કરો અથવા ડિલીટ કરો</li>
                      <li><strong>ફોર્મ બિલ્ડર:</strong> ડ્રેગ-એન્ડ-ડ્રોપ ફીલ્ડ્સ સાથે ફોર્મ બનાવો અને કસ્ટમાઇઝ કરો</li>
                      <li><strong>ડોક્યુમેન્ટ પાર્સિંગ:</strong> ઓટોમેટિક ડોક્યુમેન્ટ ડેટા એક્સટ્રેક્શન કોન્ફિગર કરો</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold text-primary mb-2">💡 ટિપ્સ અને શોર્ટકટ્સ</h3>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li><strong>Ctrl+K:</strong> ઝડપી શોધ</li>
                      <li>ફરજિયાત ફીલ્ડ્સ લાલ તારા (*) સાથે ચિહ્નિત છે</li>
                      <li>ડેટા ગુમાવવાનું ટાળવા માટે તમારું કામ વારંવાર સેવ કરો</li>
                      <li>સરળ ઓળખ માટે સ્પષ્ટ, વર્ણનાત્મક નામોનો ઉપયોગ કરો</li>
                    </ul>
                  </section>

                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;