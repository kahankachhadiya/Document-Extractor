import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import {
  ArrowLeft,
  Edit,
  Download,
  Share2,
  Copy,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  GraduationCap,
  Trophy,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  Shield,
  Star,
  Key,
  BookOpen,
  Target,
  Settings,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import QuickCopyPanel from "@/components/QuickCopyPanel";
import { useProfile, useUpdateProfile } from "@/lib/queries";
import FormSelector from "@/components/FormSelector";
import DataCompatibilityIndicator from "@/components/DataCompatibilityIndicator";
import CustomFormRenderer from "@/components/CustomFormRenderer";

// Fetch profile from API by route id

const ProfileDetails = () => {
  const { id } = useParams();
  const { toast } = useToast();
  const { data: profile } = useProfile(id);
  const updateMutation = useUpdateProfile(id || "");
  const [activeTab, setActiveTab] = useState("overview");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editCategory, setEditCategory] = useState("personal");
  
  // Form selection state - Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedForm, setSelectedForm] = useState<any>(null);
  const [dataCompatibilityInfo, setDataCompatibilityInfo] = useState<any>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);

  const handleCopyField = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({
        title: "Copied!",
        description: `${field} copied to clipboard`,
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Unable to copy to clipboard",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  // Form selection handlers - Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
  const handleFormChange = (formId: string, form: any) => {
    setSelectedFormId(formId);
    setSelectedForm(form);
    setShowCustomForm(true);
    
    toast({
      title: "Form Selected",
      description: `Switched to ${form.name} form template`,
      duration: 3000,
    });
  };

  const handleDataCompatibilityCheck = (compatibilityInfo: any) => {
    setDataCompatibilityInfo(compatibilityInfo);
  };

  const handleToggleFormView = () => {
    setShowCustomForm(!showCustomForm);
    setActiveTab(showCustomForm ? "overview" : "custom-form");
  };

  const getCompletionColor = (percentage: number) => {
    if (percentage >= 90) return "text-success";
    if (percentage >= 70) return "text-warning";
    return "text-destructive";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "complete":
        return <Badge className="status-complete">Complete</Badge>;
      case "draft":
        return <Badge className="status-incomplete">Draft</Badge>;
      case "verified":
        return <Badge className="status-complete">Verified</Badge>;
      default:
        return <Badge className="status-pending">Unknown</Badge>;
    }
  };

  // Calculate category completion stats
  const getCategoryStats = () => {
    const categories = [
      { name: 'Personal', fields: Object.keys(profile.personalInfo), filled: Object.values(profile.personalInfo).filter(v => v && v !== '').length },
      { name: 'Contact', fields: Object.keys(profile.contactInfo), filled: Object.values(profile.contactInfo).filter(v => v && v !== '').length },
      { name: 'Family', fields: Object.keys(profile.familyDetails), filled: Object.values(profile.familyDetails).filter(v => v && v !== '').length },
      { name: 'Education', fields: Object.keys(profile.educationalDetails), filled: Object.values(profile.educationalDetails).filter(v => v && v !== '').length },
      { name: 'Exams', fields: Object.keys(profile.examinationDetails), filled: Object.values(profile.examinationDetails).filter(v => v && v !== '').length }
    ];

    return categories.map(cat => ({
      ...cat,
      percentage: Math.round((cat.filled / cat.fields.length) * 100)
    }));
  };

  const categoryStats = profile ? getCategoryStats() : [] as any[];

  // Form schemas for different categories
  const personalInfoSchema = z.object({
    fullName: z.string().min(2, "Name must be at least 2 characters"),
    dateOfBirth: z.string().optional().or(z.literal("")),
    gender: z.string().optional().or(z.literal("")),
    fatherName: z.string().optional().or(z.literal("")),
    motherName: z.string().optional().or(z.literal("")),
    nationality: z.string().optional().or(z.literal("")),
  });

  const contactInfoSchema = z.object({
    emailId: z.string().email("Please enter a valid email").optional().or(z.literal("")),
    mobileNumber: z.string().optional().or(z.literal("")),
    presentAddress: z.string().min(5, "Address must be at least 5 characters"),
    permanentAddress: z.string().min(5, "Address must be at least 5 characters"),
    stateOfDomicile: z.string().min(1, "State is required"),
    districtOfDomicile: z.string().min(1, "District is required"),
    pinCode: z.string().regex(/^\d{6}$/, "Please enter a valid PIN code"),
  });

  const educationSchema = z.object({
    class10Board: z.string().min(1, "Board is required"),
    class10SchoolName: z.string().min(1, "School name is required"),
    class10YearOfPassing: z.string().min(4, "Year is required"),
    class10Percentage: z.number().min(0).max(100).optional(),
    class12Board: z.string().min(1, "Board is required"),
    class12SchoolName: z.string().min(1, "School name is required"),
    class12YearOfPassing: z.string().min(4, "Year is required"),
    class12Percentage: z.number().min(0).max(100).optional(),
    class12Stream: z.string().min(1, "Stream is required"),
  });

  const casteSchema = z.object({
    category: z.string().min(1, "Category is required"),
    minorityStatus: z.boolean(),
    pwdStatus: z.boolean(),
  });

  // Form instances
  const personalForm = useForm({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      fullName: profile?.personalInfo?.fullName || "",
      dateOfBirth: profile?.personalInfo?.dateOfBirth || "",
      gender: profile?.personalInfo?.gender || "",
      fatherName: profile?.personalInfo?.fatherName || "",
      motherName: profile?.personalInfo?.motherName || "",
      nationality: profile?.personalInfo?.nationality || "Indian",
    },
  });

  const contactForm = useForm({
    resolver: zodResolver(contactInfoSchema),
    defaultValues: {
      emailId: profile?.contactInfo?.emailId || "",
      mobileNumber: profile?.contactInfo?.mobileNumber || "",
      presentAddress: profile?.contactInfo?.presentAddress || "",
      permanentAddress: profile?.contactInfo?.permanentAddress || "",
      stateOfDomicile: profile?.contactInfo?.stateOfDomicile || "",
      districtOfDomicile: profile?.contactInfo?.districtOfDomicile || "",
      pinCode: profile?.contactInfo?.pinCode || "",
    },
  });

  const educationForm = useForm({
    resolver: zodResolver(educationSchema),
    defaultValues: {
      class10Board: profile?.educationalDetails?.class10Board || "",
      class10SchoolName: profile?.educationalDetails?.class10SchoolName || "",
      class10YearOfPassing: profile?.educationalDetails?.class10YearOfPassing || "",
      class10Percentage: profile?.educationalDetails?.class10Percentage || 0,
      class12Board: profile?.educationalDetails?.class12Board || "",
      class12SchoolName: profile?.educationalDetails?.class12SchoolName || "",
      class12YearOfPassing: profile?.educationalDetails?.class12YearOfPassing || "",
      class12Percentage: profile?.educationalDetails?.class12Percentage || 0,
      class12Stream: profile?.educationalDetails?.class12Stream || "",
    },
  });

  const casteForm = useForm({
    resolver: zodResolver(casteSchema),
    defaultValues: {
      category: profile?.casteReservation?.category || "",
      minorityStatus: profile?.casteReservation?.minorityStatus || false,
      pwdStatus: profile?.casteReservation?.pwdStatus || false,
    },
  });

  // Handle form submissions
  const handlePersonalInfoSubmit = async (data: any) => {
    try {
      const updatedProfile = {
        ...profile,
        personalInfo: { ...profile.personalInfo, ...data },
        updatedAt: new Date().toISOString(),
      };

      await updateMutation.mutateAsync(updatedProfile);
      setIsEditDialogOpen(false);
      toast({
        title: "Profile Updated!",
        description: "Personal information has been saved successfully",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Please try again later",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleContactInfoSubmit = async (data: any) => {
    try {
      const updatedProfile = {
        ...profile,
        contactInfo: { ...profile.contactInfo, ...data },
        updatedAt: new Date().toISOString(),
      };

      await updateMutation.mutateAsync(updatedProfile);
      setIsEditDialogOpen(false);
      toast({
        title: "Profile Updated!",
        description: "Contact information has been saved successfully",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Please try again later",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleEducationSubmit = async (data: any) => {
    try {
      const updatedProfile = {
        ...profile,
        educationalDetails: { ...profile.educationalDetails, ...data },
        updatedAt: new Date().toISOString(),
      };

      await updateMutation.mutateAsync(updatedProfile);
      setIsEditDialogOpen(false);
      toast({
        title: "Profile Updated!",
        description: "Educational details have been saved successfully",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Please try again later",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleCasteSubmit = async (data: any) => {
    try {
      const updatedProfile = {
        ...profile,
        casteReservation: { ...profile.casteReservation, ...data },
        updatedAt: new Date().toISOString(),
      };

      await updateMutation.mutateAsync(updatedProfile);
      setIsEditDialogOpen(false);
      toast({
        title: "Profile Updated!",
        description: "Category information has been saved successfully",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Please try again later",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  // Export functions
  const handleExportPDF = async () => {
    setIsGeneratingReport(true);
    try {
      // Create a comprehensive profile report
      const reportData = {
        profile: profile,
        generatedAt: new Date().toISOString(),
        completionStats: categoryStats
      };

      // Create HTML content for the PDF
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Profile Report - ${profile.personalInfo.fullName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
            .section { margin-bottom: 25px; }
            .section-title { font-size: 18px; font-weight: bold; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 15px; }
            .field { margin-bottom: 8px; }
            .field-label { font-weight: bold; display: inline-block; width: 150px; }
            .field-value { color: #555; }
            .completion-stats { background: #f5f5f5; padding: 15px; border-radius: 5px; }
            .empty-field { color: #999; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Profile Report</h1>
            <h2>${profile.personalInfo.fullName}</h2>
            <p>Profile ID: ${profile.id}</p>
            <p>Generated on: ${new Date().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}</p>
          </div>

          <div class="section">
            <div class="section-title">Personal Information</div>
            <div class="field"><span class="field-label">Full Name:</span> <span class="field-value">${profile.personalInfo.fullName || '<span class="empty-field">Not provided</span>'}</span></div>
            <div class="field"><span class="field-label">Date of Birth:</span> <span class="field-value">${profile.personalInfo.dateOfBirth ? new Date(profile.personalInfo.dateOfBirth).toLocaleDateString('en-IN') : '<span class="empty-field">Not provided</span>'}</span></div>
            <div class="field"><span class="field-label">Gender:</span> <span class="field-value">${profile.personalInfo.gender || '<span class="empty-field">Not provided</span>'}</span></div>
            <div class="field"><span class="field-label">Father's Name:</span> <span class="field-value">${profile.personalInfo.fatherName || '<span class="empty-field">Not provided</span>'}</span></div>
            <div class="field"><span class="field-label">Mother's Name:</span> <span class="field-value">${profile.personalInfo.motherName || '<span class="empty-field">Not provided</span>'}</span></div>
            <div class="field"><span class="field-label">Nationality:</span> <span class="field-value">${profile.personalInfo.nationality || '<span class="empty-field">Not provided</span>'}</span></div>
          </div>

          <div class="section">
            <div class="section-title">Contact Information</div>
            <div class="field"><span class="field-label">Email:</span> <span class="field-value">${profile.contactInfo.emailId || '<span class="empty-field">Not provided</span>'}</span></div>
            <div class="field"><span class="field-label">Mobile:</span> <span class="field-value">${profile.contactInfo.mobileNumber || '<span class="empty-field">Not provided</span>'}</span></div>
            <div class="field"><span class="field-label">State:</span> <span class="field-value">${profile.contactInfo.stateOfDomicile || '<span class="empty-field">Not provided</span>'}</span></div>
            <div class="field"><span class="field-label">Present Address:</span> <span class="field-value">${profile.contactInfo.presentAddress || '<span class="empty-field">Not provided</span>'}</span></div>
            <div class="field"><span class="field-label">Permanent Address:</span> <span class="field-value">${profile.contactInfo.permanentAddress || '<span class="empty-field">Not provided</span>'}</span></div>
          </div>

          <div class="section">
            <div class="section-title">Educational Details</div>
            <div class="field"><span class="field-label">Class 10 Board:</span> <span class="field-value">${profile.educationalDetails.class10Board || '<span class="empty-field">Not provided</span>'}</span></div>
            <div class="field"><span class="field-label">Class 10 Percentage:</span> <span class="field-value">${profile.educationalDetails.class10Percentage ? profile.educationalDetails.class10Percentage + '%' : '<span class="empty-field">Not provided</span>'}</span></div>
            <div class="field"><span class="field-label">Class 12 Board:</span> <span class="field-value">${profile.educationalDetails.class12Board || '<span class="empty-field">Not provided</span>'}</span></div>
            <div class="field"><span class="field-label">Class 12 Percentage:</span> <span class="field-value">${profile.educationalDetails.class12Percentage ? profile.educationalDetails.class12Percentage + '%' : '<span class="empty-field">Not provided</span>'}</span></div>
            <div class="field"><span class="field-label">Stream:</span> <span class="field-value">${profile.educationalDetails.class12Stream || '<span class="empty-field">Not provided</span>'}</span></div>
          </div>

          <div class="section">
            <div class="section-title">Category Information</div>
            <div class="field"><span class="field-label">Category:</span> <span class="field-value">${profile.casteReservation.category || '<span class="empty-field">Not provided</span>'}</span></div>
            <div class="field"><span class="field-label">Minority Status:</span> <span class="field-value">${profile.casteReservation.minorityStatus ? 'Yes' : 'No'}</span></div>
            <div class="field"><span class="field-label">PWD Status:</span> <span class="field-value">${profile.casteReservation.pwdStatus ? 'Yes' : 'No'}</span></div>
          </div>

          <div class="section">
            <div class="section-title">Profile Completion Statistics</div>
            <div class="completion-stats">
              <div class="field"><span class="field-label">Overall Completion:</span> <span class="field-value">${profile.completionPercentage}%</span></div>
              <div class="field"><span class="field-label">Profile Status:</span> <span class="field-value">${profile.status}</span></div>
              <div class="field"><span class="field-label">Created:</span> <span class="field-value">${new Date(profile.createdAt).toLocaleDateString('en-IN')}</span></div>
              <div class="field"><span class="field-label">Last Updated:</span> <span class="field-value">${new Date(profile.updatedAt).toLocaleDateString('en-IN')}</span></div>
            </div>
          </div>
        </body>
        </html>
      `;

      // Create a blob and download link (HTML that can be printed to PDF)
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${profile.personalInfo.fullName.replace(/\s+/g, '_')}_Profile_Report.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "HTML Report Generated!",
        description: "Profile report downloaded - you can print it as PDF from your browser",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Failed to generate report",
        description: "Please try again later",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleExportWord = async () => {
    setIsGeneratingReport(true);
    try {
      // Create Word document content
      const wordContent = `
        Profile Report - ${profile.personalInfo.fullName}
        
        Profile ID: ${profile.id}
        Generated on: ${new Date().toLocaleDateString('en-IN')}
        
        PERSONAL INFORMATION
        Full Name: ${profile.personalInfo.fullName || 'Not provided'}
        Date of Birth: ${profile.personalInfo.dateOfBirth ? new Date(profile.personalInfo.dateOfBirth).toLocaleDateString('en-IN') : 'Not provided'}
        Gender: ${profile.personalInfo.gender || 'Not provided'}
        Father's Name: ${profile.personalInfo.fatherName || 'Not provided'}
        Mother's Name: ${profile.personalInfo.motherName || 'Not provided'}
        Nationality: ${profile.personalInfo.nationality || 'Not provided'}
        
        CONTACT INFORMATION
        Email: ${profile.contactInfo.emailId || 'Not provided'}
        Mobile: ${profile.contactInfo.mobileNumber || 'Not provided'}
        State: ${profile.contactInfo.stateOfDomicile || 'Not provided'}
        Present Address: ${profile.contactInfo.presentAddress || 'Not provided'}
        Permanent Address: ${profile.contactInfo.permanentAddress || 'Not provided'}
        
        EDUCATIONAL DETAILS
        Class 10 Board: ${profile.educationalDetails.class10Board || 'Not provided'}
        Class 10 Percentage: ${profile.educationalDetails.class10Percentage ? profile.educationalDetails.class10Percentage + '%' : 'Not provided'}
        Class 12 Board: ${profile.educationalDetails.class12Board || 'Not provided'}
        Class 12 Percentage: ${profile.educationalDetails.class12Percentage ? profile.educationalDetails.class12Percentage + '%' : 'Not provided'}
        Stream: ${profile.educationalDetails.class12Stream || 'Not provided'}
        
        CATEGORY INFORMATION
        Category: ${profile.casteReservation.category || 'Not provided'}
        Minority Status: ${profile.casteReservation.minorityStatus ? 'Yes' : 'No'}
        PWD Status: ${profile.casteReservation.pwdStatus ? 'Yes' : 'No'}
        
        PROFILE STATISTICS
        Overall Completion: ${profile.completionPercentage}%
        Profile Status: ${profile.status}
        Created: ${new Date(profile.createdAt).toLocaleDateString('en-IN')}
        Last Updated: ${new Date(profile.updatedAt).toLocaleDateString('en-IN')}
      `;

      const blob = new Blob([wordContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${profile.personalInfo.fullName.replace(/\s+/g, '_')}_Profile_Report.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Text Document Generated!",
        description: "Profile report downloaded as text file - you can open it in Word",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Failed to generate document",
        description: "Please try again later",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleExportJSON = async () => {
    try {
      const jsonData = {
        profile: profile,
        exportedAt: new Date().toISOString(),
        exportFormat: 'JSON'
      };

      const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${profile.personalInfo.fullName.replace(/\s+/g, '_')}_Profile_Data.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "JSON Export Complete!",
        description: "Profile data has been downloaded as JSON file",
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Failed to export data",
        description: "Please try again later",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleShareProfile = () => {
    if (navigator.share) {
      navigator.share({
        title: `${profile.personalInfo.fullName}'s Profile`,
        text: `Check out ${profile.personalInfo.fullName}'s profile - ${profile.completionPercentage}% complete`,
        url: window.location.href,
      });
    } else {
      // Fallback: copy URL to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Profile Link Copied!",
        description: "Profile URL has been copied to clipboard",
        duration: 3000,
      });
    }
  };



  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary-light/10 to-accent-light/10">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">{profile.personalInfo.fullName}</h1>
                <div className="flex items-center space-x-2">
                  <p className="text-sm text-muted-foreground font-mono">{profile.id}</p>
                  {getStatusBadge(profile.status)}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isGeneratingReport}>
                    {isGeneratingReport ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Share2 className="h-4 w-4 mr-2" />
                        Share Profile
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportPDF}>
                    <Download className="h-4 w-4 mr-2" />
                    Download HTML (Print to PDF)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportWord}>
                    <FileText className="h-4 w-4 mr-2" />
                    Download Text (Open in Word)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportJSON}>
                    <Settings className="h-4 w-4 mr-2" />
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleShareProfile}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Link
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="btn-hero">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Profile
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                    <DialogDescription>
                      Update your profile information organized by category
                    </DialogDescription>
                  </DialogHeader>

                  <Tabs value={editCategory} onValueChange={setEditCategory} className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="personal">Personal</TabsTrigger>
                      <TabsTrigger value="contact">Contact</TabsTrigger>
                      <TabsTrigger value="education">Education</TabsTrigger>
                      <TabsTrigger value="caste">Category</TabsTrigger>
                    </TabsList>

                    {/* Personal Information Tab */}
                    <TabsContent value="personal" className="space-y-4">
                      <Form {...personalForm}>
                        <form onSubmit={personalForm.handleSubmit(handlePersonalInfoSubmit)} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={personalForm.control}
                              name="fullName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Full Name *</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter full name" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={personalForm.control}
                              name="dateOfBirth"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Date of Birth *</FormLabel>
                                  <FormControl>
                                    <Input type="date" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={personalForm.control}
                              name="gender"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Gender</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter gender" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={personalForm.control}
                              name="nationality"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Nationality *</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter nationality" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={personalForm.control}
                              name="fatherName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Father's Name *</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter father's name" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={personalForm.control}
                              name="motherName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Mother's Name *</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter mother's name" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="flex justify-end space-x-2">
                            <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit" disabled={updateMutation.isPending}>
                              {updateMutation.isPending ? "Saving..." : "Save Changes"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </TabsContent>

                    {/* Contact Information Tab */}
                    <TabsContent value="contact" className="space-y-4">
                      <Form {...contactForm}>
                        <form onSubmit={contactForm.handleSubmit(handleContactInfoSubmit)} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={contactForm.control}
                              name="emailId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email Address *</FormLabel>
                                  <FormControl>
                                    <Input type="email" placeholder="Enter email" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={contactForm.control}
                              name="mobileNumber"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Mobile Number *</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter mobile number" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={contactForm.control}
                              name="stateOfDomicile"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>State of Domicile *</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter state" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={contactForm.control}
                              name="districtOfDomicile"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>District *</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter district" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={contactForm.control}
                              name="pinCode"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>PIN Code *</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter PIN code" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={contactForm.control}
                            name="presentAddress"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Present Address *</FormLabel>
                                <FormControl>
                                  <Textarea placeholder="Enter present address" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={contactForm.control}
                            name="permanentAddress"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Permanent Address *</FormLabel>
                                <FormControl>
                                  <Textarea placeholder="Enter permanent address" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="flex justify-end space-x-2">
                            <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit" disabled={updateMutation.isPending}>
                              {updateMutation.isPending ? "Saving..." : "Save Changes"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </TabsContent>

                    {/* Education Tab */}
                    <TabsContent value="education" className="space-y-4">
                      <Form {...educationForm}>
                        <form onSubmit={educationForm.handleSubmit(handleEducationSubmit)} className="space-y-4">
                          <div className="space-y-4">
                            <h4 className="font-semibold">Class 10 Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                control={educationForm.control}
                                name="class10Board"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Board *</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Enter board name" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={educationForm.control}
                                name="class10SchoolName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>School Name *</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Enter school name" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={educationForm.control}
                                name="class10YearOfPassing"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Year of Passing *</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Enter year" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={educationForm.control}
                                name="class10Percentage"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Percentage</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        placeholder="Enter percentage"
                                        {...field}
                                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="font-semibold">Class 12 Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                control={educationForm.control}
                                name="class12Board"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Board *</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Enter board name" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={educationForm.control}
                                name="class12SchoolName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>School Name *</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Enter school name" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={educationForm.control}
                                name="class12YearOfPassing"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Year of Passing *</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Enter year" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={educationForm.control}
                                name="class12Percentage"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Percentage</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        placeholder="Enter percentage"
                                        {...field}
                                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={educationForm.control}
                                name="class12Stream"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Stream *</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                      <FormControl>
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select stream" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="science">Science</SelectItem>
                                        <SelectItem value="commerce">Commerce</SelectItem>
                                        <SelectItem value="arts">Arts</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>

                          <div className="flex justify-end space-x-2">
                            <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit" disabled={updateMutation.isPending}>
                              {updateMutation.isPending ? "Saving..." : "Save Changes"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </TabsContent>

                    {/* Category Tab */}
                    <TabsContent value="caste" className="space-y-4">
                      <Form {...casteForm}>
                        <form onSubmit={casteForm.handleSubmit(handleCasteSubmit)} className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={casteForm.control}
                              name="category"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Category *</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select category" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="general">General</SelectItem>
                                      <SelectItem value="obc-ncl">OBC-NCL</SelectItem>
                                      <SelectItem value="sc">SC</SelectItem>
                                      <SelectItem value="st">ST</SelectItem>
                                      <SelectItem value="ews">EWS</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="space-y-4">
                            <FormField
                              control={casteForm.control}
                              name="minorityStatus"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <input
                                      type="checkbox"
                                      checked={field.value}
                                      onChange={field.onChange}
                                      className="h-4 w-4"
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal">
                                    Minority Status
                                  </FormLabel>
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={casteForm.control}
                              name="pwdStatus"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <input
                                      type="checkbox"
                                      checked={field.value}
                                      onChange={field.onChange}
                                      className="h-4 w-4"
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal">
                                    Person with Disability (PWD)
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="flex justify-end space-x-2">
                            <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit" disabled={updateMutation.isPending}>
                              {updateMutation.isPending ? "Saving..." : "Save Changes"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Profile Sidebar */}
          <div className="xl:col-span-1 space-y-6">
            {/* Profile Overview Card */}
            <Card className="card-elevated">
              <CardHeader className="text-center">
                <div className="h-20 w-20 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="h-10 w-10 text-white" />
                </div>
                <CardTitle className="text-lg">{profile.personalInfo.fullName}</CardTitle>
                <CardDescription className="font-mono text-xs">{profile.id}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Completion Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Profile Completion</span>
                    <span className={cn("font-bold", getCompletionColor(profile.completionPercentage))}>
                      {profile.completionPercentage}%
                    </span>
                  </div>
                  <Progress value={profile.completionPercentage} className="h-2" />
                  <div className="flex items-center text-xs text-muted-foreground">
                    {profile.completionPercentage >= 90 ? (
                      <CheckCircle2 className="h-3 w-3 mr-1 text-success" />
                    ) : (
                      <Clock className="h-3 w-3 mr-1" />
                    )}
                    {profile.completionPercentage >= 90 ? "Ready for applications" : "Complete remaining fields"}
                  </div>
                </div>

                {/* Quick Contact Info */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center text-sm">
                    <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span className="truncate">{profile.contactInfo.emailId}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>{profile.contactInfo.mobileNumber}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>{profile.contactInfo.stateOfDomicile}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>Created: {new Date(profile.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>

                {/* Exam Performance Summary */}
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-sm font-medium">Exam Performance</p>
                  <div className="space-y-1">
                    {profile.examinationDetails.jeeMainScore && (
                      <div className="flex justify-between text-xs">
                        <span>JEE Main:</span>
                        <span className="font-medium">{profile.examinationDetails.jeeMainScore}/300</span>
                      </div>
                    )}
                    {profile.examinationDetails.neetScore && (
                      <div className="flex justify-between text-xs">
                        <span>NEET:</span>
                        <span className="font-medium">{profile.examinationDetails.neetScore}/720</span>
                      </div>
                    )}
                    {profile.examinationDetails.stateCetScore && (
                      <div className="flex justify-between text-xs">
                        <span>GUJCET:</span>
                        <span className="font-medium">{profile.examinationDetails.stateCetScore}%</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Category Completion Stats */}
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Target className="h-5 w-5 mr-2 text-primary" />
                  Completion Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {categoryStats.map((stat, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{stat.name}</span>
                      <span className="font-medium">{stat.filled}/{stat.fields.length}</span>
                    </div>
                    <Progress value={stat.percentage} className="h-1" />
                  </div>
                ))}
              </CardContent>
            </Card>


          </div>

          {/* Main Content Area */}
          <div className="xl:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <TabsList className="grid w-full grid-cols-4 max-w-md">
                  <TabsTrigger value="overview" className="flex items-center">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="custom-form" className="flex items-center">
                    <Settings className="h-4 w-4 mr-2" />
                    Custom Form
                  </TabsTrigger>
                  <TabsTrigger value="copy-panel" className="flex items-center">
                    <Copy className="h-4 w-4 mr-2" />
                    Quick Copy
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="flex items-center">
                    <FileText className="h-4 w-4 mr-2" />
                    Documents
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                {/* Personal Information */}
                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <User className="h-5 w-5 mr-2 text-primary" />
                      Personal Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{profile.personalInfo.fullName}</p>
                          <Button variant="ghost" size="sm" className="copy-button h-6 w-6 p-0" onClick={() => handleCopyField("Full Name", profile.personalInfo.fullName)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Date of Birth</p>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{new Date(profile.personalInfo.dateOfBirth).toLocaleDateString('en-IN')}</p>
                          <Button variant="ghost" size="sm" className="copy-button h-6 w-6 p-0" onClick={() => handleCopyField("Date of Birth", profile.personalInfo.dateOfBirth)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Gender</p>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium capitalize">{profile.personalInfo.gender}</p>
                          <Button variant="ghost" size="sm" className="copy-button h-6 w-6 p-0" onClick={() => handleCopyField("Gender", profile.personalInfo.gender)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Father's Name</p>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{profile.personalInfo.fatherName}</p>
                          <Button variant="ghost" size="sm" className="copy-button h-6 w-6 p-0" onClick={() => handleCopyField("Father's Name", profile.personalInfo.fatherName)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Mother's Name</p>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{profile.personalInfo.motherName}</p>
                          <Button variant="ghost" size="sm" className="copy-button h-6 w-6 p-0" onClick={() => handleCopyField("Mother's Name", profile.personalInfo.motherName)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Category</p>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs uppercase">{profile.casteReservation.category}</Badge>
                          <Button variant="ghost" size="sm" className="copy-button h-6 w-6 p-0" onClick={() => handleCopyField("Category", profile.casteReservation.category)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Educational Performance */}
                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <GraduationCap className="h-5 w-5 mr-2 text-primary" />
                      Educational Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className="font-semibold text-sm">Class 10</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Board:</span>
                            <span className="font-medium">{profile.educationalDetails.class10Board}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Percentage:</span>
                            <span className="font-medium">{profile.educationalDetails.class10Percentage}%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Year:</span>
                            <span className="font-medium">{profile.educationalDetails.class10YearOfPassing}</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h4 className="font-semibold text-sm">Class 12</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Board:</span>
                            <span className="font-medium">{profile.educationalDetails.class12Board}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Percentage:</span>
                            <span className="font-medium">{profile.educationalDetails.class12Percentage}%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Stream:</span>
                            <span className="font-medium capitalize">{profile.educationalDetails.class12Stream}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Examination Results */}
                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Trophy className="h-5 w-5 mr-2 text-primary" />
                      Examination Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* JEE Main */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm flex items-center">
                          <Badge variant="outline" className="mr-2">JEE Main</Badge>
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Score:</span>
                            <span className="font-bold text-primary">{profile.examinationDetails.jeeMainScore}/300</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Percentile:</span>
                            <span className="font-medium">{profile.examinationDetails.jeeMainPercentile}%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Rank:</span>
                            <span className="font-medium">{profile.examinationDetails.jeeMainRank}</span>
                          </div>
                        </div>
                      </div>

                      {/* NEET */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm flex items-center">
                          <Badge variant="outline" className="mr-2">NEET</Badge>
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Score:</span>
                            <span className="font-bold text-success">{profile.examinationDetails.neetScore}/720</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>AIR:</span>
                            <span className="font-medium">{profile.examinationDetails.neetAllIndiaRank}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>State Rank:</span>
                            <span className="font-medium">{profile.examinationDetails.neetStateRank}</span>
                          </div>
                        </div>
                      </div>

                      {/* State CET */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm flex items-center">
                          <Badge variant="outline" className="mr-2">GUJCET</Badge>
                        </h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Score:</span>
                            <span className="font-bold text-accent">{profile.examinationDetails.stateCetScore}%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Percentile:</span>
                            <span className="font-medium">{profile.examinationDetails.stateCetPercentileRank}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Quick Copy Panel Tab */}
              <TabsContent value="copy-panel">
                <QuickCopyPanel profile={profile} />
              </TabsContent>

              {/* Custom Form Tab - Requirements: 8.1, 8.2, 8.3, 8.4, 8.5 */}
              <TabsContent value="custom-form" className="space-y-6">
                {/* Form Selector */}
                <FormSelector
                  clientId={parseInt(id || "0")}
                  selectedFormId={selectedFormId || undefined}
                  onFormChange={handleFormChange}
                  onDataCompatibilityCheck={handleDataCompatibilityCheck}
                />

                {/* Data Compatibility Indicator */}
                {dataCompatibilityInfo && (
                  <DataCompatibilityIndicator
                    compatibilityInfo={dataCompatibilityInfo}
                  />
                )}

                {/* Custom Form Renderer */}
                {selectedFormId && (
                  <CustomFormRenderer
                    clientId={parseInt(id || "0")}
                    formTemplateId={selectedFormId}
                    isEditable={true}
                    onFormChange={handleFormChange}
                    onFieldChange={(fieldId, value) => {
                      console.log('Field changed:', fieldId, value);
                    }}
                    onCopyField={(fieldId, value) => {
                      handleCopyField(fieldId, value);
                    }}
                    onDocumentUpload={(files) => {
                      console.log('Documents uploaded:', files);
                      toast({
                        title: "Documents Uploaded",
                        description: `${files.length} document(s) uploaded successfully`,
                        duration: 3000,
                      });
                    }}
                  />
                )}

                {/* No Form Selected State */}
                {!selectedFormId && (
                  <Card>
                    <CardContent className="text-center py-12">
                      <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Form Selected</h3>
                      <p className="text-muted-foreground">
                        Select a form template above to view and edit client data using custom forms.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>



              {/* Documents Tab */}
              <TabsContent value="documents" className="space-y-6">
                <Card className="card-elevated">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <FileText className="h-5 w-5 mr-2 text-primary" />
                      Document Management
                    </CardTitle>
                    <CardDescription>
                      Manage and access all your uploaded documents
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(profile.documents).map(([key, path]) => {
                        if (!path) return null;

                        const documentName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).replace('Path', '');

                        return (
                          <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex items-center space-x-3">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{documentName}</p>
                                <p className="text-xs text-muted-foreground">Uploaded</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <Download className="h-3 w-3" />
                              </Button>
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfileDetails;