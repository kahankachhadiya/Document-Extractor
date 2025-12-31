// Form Master Pro - Quick Copy Panel Component
// Provides one-click copy functionality for all profile fields

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Copy,
  Search,
  Check,
  User,
  MapPin,
  Users,
  Shield,
  GraduationCap,
  Trophy,
  Star,
  Key,
  FileText,
  History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Profile, FieldCategory } from '@/types/profile';
import { CATEGORY_METADATA, getFieldsByCategory } from '@/lib/fieldTemplates';

interface QuickCopyPanelProps {
  profile: Profile;
  className?: string;
}

interface CopyHistoryItem {
  fieldName: string;
  fieldValue: string;
  timestamp: string;
  category: FieldCategory;
}

const QuickCopyPanel = ({ profile, className }: QuickCopyPanelProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FieldCategory>('personal');
  const [copyHistory, setCopyHistory] = useState<CopyHistoryItem[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { toast } = useToast();

  // Category icons mapping
  const categoryIcons = {
    personal: User,
    contact: MapPin,
    family: Users,
    caste: Shield,
    education: GraduationCap,
    documents: FileText
  };

  // Get field value from profile based on category and field name
  const getFieldValue = (category: FieldCategory, fieldName: string): string => {
    const categoryData = profile[`${category}Info` as keyof Profile] || profile[`${category}Details` as keyof Profile] || profile[category as keyof Profile];

    if (!categoryData || typeof categoryData !== 'object') return '';

    const value = (categoryData as any)[fieldName];

    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') return value;

    return '';
  };

  // Handle copy to clipboard
  const handleCopy = async (fieldName: string, fieldValue: string, category: FieldCategory, displayLabel: string) => {
    if (!fieldValue.trim()) {
      toast({
        title: "Nothing to copy",
        description: "This field is empty",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(fieldValue);

      // Add to copy history
      const historyItem: CopyHistoryItem = {
        fieldName: displayLabel,
        fieldValue,
        timestamp: new Date().toISOString(),
        category
      };

      setCopyHistory(prev => [historyItem, ...prev.slice(0, 19)]); // Keep last 20 items
      setCopiedField(`${category}_${fieldName}`);

      // Clear copied indicator after 2 seconds
      setTimeout(() => setCopiedField(null), 2000);

      toast({
        title: "Copied!",
        description: `${displayLabel} copied to clipboard`,
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

  // Handle batch copy for related fields
  const handleBatchCopy = async (category: FieldCategory) => {
    const fields = getFieldsByCategory(category);
    const filledFields = fields.filter(field => {
      const value = getFieldValue(category, field.fieldName);
      return value.trim() !== '';
    });

    if (filledFields.length === 0) {
      toast({
        title: "Nothing to copy",
        description: "No filled fields in this category",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    const batchData = filledFields.map(field => {
      const value = getFieldValue(category, field.fieldName);
      return `${field.displayLabel}: ${value}`;
    }).join('\n');

    try {
      await navigator.clipboard.writeText(batchData);
      toast({
        title: "Batch copied!",
        description: `${filledFields.length} fields copied from ${CATEGORY_METADATA[category].title}`,
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Unable to copy batch data",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  // Filter fields based on search query
  const getFilteredFields = (category: FieldCategory) => {
    const fields = getFieldsByCategory(category);
    if (!searchQuery.trim()) return fields;

    return fields.filter(field =>
      field.displayLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      field.fieldName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getFieldValue(category, field.fieldName).toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  // Get completion stats for category
  const getCategoryStats = (category: FieldCategory) => {
    const fields = getFieldsByCategory(category);
    const filledFields = fields.filter(field => {
      const value = getFieldValue(category, field.fieldName);
      return value.trim() !== '';
    });

    return {
      total: fields.length,
      filled: filledFields.length,
      percentage: fields.length > 0 ? Math.round((filledFields.length / fields.length) * 100) : 0
    };
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Header Section */}
      <div className="mb-6">
        <Card className="card-elevated">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center text-xl">
                  <Copy className="h-5 w-5 mr-2 text-primary" />
                  Quick Copy Panel
                </CardTitle>
                <CardDescription className="mt-1">
                  One-click copy for all profile fields
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-sm w-fit">
                Profile: {profile.id}
              </Badge>
            </div>

            {/* Search Bar */}
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search fields..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Category Selection */}
      <div className="mb-6">
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-lg">Select Category</CardTitle>
            <CardDescription>Choose a category to view and copy fields</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as FieldCategory)}>
              <TabsList className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 h-auto p-3 bg-muted/50">
                {Object.entries(CATEGORY_METADATA)
                  .filter(([key]) => !['quota', 'credentials', 'examination'].includes(key))
                  .map(([key, meta]) => {
                    const Icon = categoryIcons[key as FieldCategory];
                    const stats = getCategoryStats(key as FieldCategory);

                    return (
                      <TabsTrigger
                        key={key}
                        value={key}
                        className="flex flex-col items-center justify-center p-4 h-20 text-xs rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground hover:bg-background/80 transition-all"
                      >
                        <Icon className="h-6 w-6 mb-2" />
                        <span className="font-medium text-center leading-tight">{meta.title.split(' ')[0]}</span>
                        <Badge variant="secondary" className="text-xs mt-1 px-2 py-0.5">
                          {stats.filled}/{stats.total}
                        </Badge>
                      </TabsTrigger>
                    );
                  })}
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Quick Copy Content */}
      <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as FieldCategory)}>

        {Object.keys(CATEGORY_METADATA)
          .filter(category => !['quota', 'credentials', 'examination'].includes(category))
          .map((category) => (
            <TabsContent key={category} value={category} className="mt-0">
              <Card className="card-elevated">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl flex items-center">
                        {(() => {
                          const Icon = categoryIcons[category as FieldCategory];
                          return <Icon className="h-6 w-6 mr-3 text-primary" />;
                        })()}
                        {CATEGORY_METADATA[category as FieldCategory].title}
                      </CardTitle>
                      <CardDescription className="mt-2">
                        {CATEGORY_METADATA[category as FieldCategory].description}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => handleBatchCopy(category as FieldCategory)}
                      className="flex items-center gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      Copy All Fields
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {getFilteredFields(category as FieldCategory).length === 0 ? (
                      <div className="text-center py-12">
                        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground text-lg">No fields found</p>
                        <p className="text-muted-foreground text-sm">Try adjusting your search query</p>
                      </div>
                    ) : (
                      getFilteredFields(category as FieldCategory).map((field) => {
                        const fieldValue = getFieldValue(category as FieldCategory, field.fieldName);
                        const isEmpty = !fieldValue.trim();
                        const isCopied = copiedField === `${category}_${field.fieldName}`;

                        return (
                          <div
                            key={field.id}
                            className={cn(
                              "flex items-center justify-between p-4 rounded-lg border transition-all",
                              isEmpty
                                ? "bg-muted/20 border-muted/50"
                                : "bg-card border-border hover:border-primary/50 hover:shadow-md"
                            )}
                          >
                            <div className="flex-1 min-w-0 mr-4">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-sm font-semibold text-foreground">
                                  {field.displayLabel}
                                </h4>
                                {field.isRequired && (
                                  <Badge variant="destructive" className="text-xs">
                                    Required
                                  </Badge>
                                )}
                              </div>
                              <p className={cn(
                                "text-sm",
                                isEmpty ? "text-muted-foreground italic" : "text-foreground font-medium"
                              )}>
                                {isEmpty ? "Not filled" : fieldValue}
                              </p>
                              {field.helpText && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {field.helpText}
                                </p>
                              )}
                            </div>

                            <Button
                              variant={isEmpty ? "ghost" : "default"}
                              size="sm"
                              disabled={isEmpty}
                              onClick={() => handleCopy(field.fieldName, fieldValue, category as FieldCategory, field.displayLabel)}
                              className={cn(
                                "h-10 w-10 p-0 transition-all",
                                !isEmpty && "hover:scale-110",
                                isCopied && "bg-green-500 hover:bg-green-600 text-white"
                              )}
                            >
                              {isCopied ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
      </Tabs>

      {/* Copy History */}
      {copyHistory.length > 0 && (
        <div className="mt-8">
          <Card className="card-elevated">
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <History className="h-6 w-6 mr-3 text-primary" />
                Recent Copies
              </CardTitle>
              <CardDescription>
                Your last {Math.min(copyHistory.length, 10)} copied fields
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {copyHistory.slice(0, 10).map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border hover:bg-muted/30 transition-colors">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-sm font-semibold truncate">{item.fieldName}</p>
                      <p className="text-sm text-muted-foreground truncate">{item.fieldValue}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {CATEGORY_METADATA[item.category].title}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(item.fieldName, item.fieldValue, item.category, item.fieldName)}
                        className="h-9 w-9 p-0 hover:scale-105 transition-transform"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default QuickCopyPanel;