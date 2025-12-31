import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Loader2, FileText, Upload, CheckCircle, AlertCircle, X, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PrefilledProfileForm from "@/components/PrefilledProfileForm";

interface DocumentTypeInfo {
  columnName: string;
  displayName: string;
  hasSchema: boolean;
  schema?: any;
}

interface DocumentTypeSchema {
  documentType: string;
  displayName: string;
  fields: SchemaField[];
}

interface SchemaField {
  columnName: string;
  tableName: string;
  displayName: string;
  description: string;
}

interface ProcessingDocument {
  documentId: string;
  file: File;
  documentType: string;
  status: 'uploading' | 'queued' | 'processing' | 'completed' | 'error';
  queuePosition?: number;
  extractedData?: any;
  error?: string;
  timestamp: number;
  tempPath?: string; // Add temp path for file organization
}

type ModelStatus = 'unloaded' | 'loading' | 'loaded' | 'unloading' | 'error';

interface ExtractedData {
  [fieldName: string]: string | null;
}

const DocumentUpload = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State management
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeInfo[]>([]);
  const [processingDocuments, setProcessingDocuments] = useState<Map<string, ProcessingDocument>>(new Map());
  const [extractedData, setExtractedData] = useState<Map<string, ExtractedData>>(new Map());
  const [modelStatus, setModelStatus] = useState<ModelStatus>('unloaded');
  const [hasConfiguredSchemas, setHasConfiguredSchemas] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [userCancelled, setUserCancelled] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Map<string, number>>(new Map());
  const [loadAbortController, setLoadAbortController] = useState<AbortController | null>(null);

  // Fetch document types and configuration on mount
  const fetchDocumentTypesAndConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch document types from documents table schema
      const schemaResponse = await fetch('/api/database/tables/documents/schema');
      if (!schemaResponse.ok) {
        throw new Error('Failed to fetch documents table schema');
      }
      const documentsSchema = await schemaResponse.json();
      console.log('Documents schema:', documentsSchema);
      
      // Check if columns exist
      if (!documentsSchema.columns || !Array.isArray(documentsSchema.columns)) {
        throw new Error('Documents table columns not found or invalid format');
      }

      // Fetch existing configuration
      const configResponse = await fetch('/api/document-parsing/config');
      let config = { schemas: [] };
      if (configResponse.ok) {
        config = await configResponse.json();
      }

      // Create document type info with schema status
      const schemaMap = new Map(config.schemas.map((schema: DocumentTypeSchema) => [schema.documentType, schema]));
      
      const docTypes: DocumentTypeInfo[] = documentsSchema.columns
        .filter((col: any) => !['document_id', 'client_id', 'created_at', 'updated_at', 'upload_date', 'verification_status', 'verified_by', 'verified_at', 'notes', 'is_required', 'document_name', 'file_path', 'file_size', 'mime_type'].includes(col.name)) // Exclude system columns
        .map((col: any) => ({
          columnName: col.name,
          displayName: col.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          hasSchema: schemaMap.has(col.name),
          schema: schemaMap.get(col.name)
        }));

      setDocumentTypes(docTypes);
      setHasConfiguredSchemas(docTypes.some(dt => dt.hasSchema));
      
      console.log('Document types loaded:', docTypes);
      console.log('Has configured schemas:', docTypes.some(dt => dt.hasSchema));
      
      if (docTypes.length === 0) {
        setError('No document types found. Please add document type columns to the documents table in the admin panel.');
        return;
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load document types';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Load AI model when page opens (if schemas are configured)
  const loadAIModel = useCallback(async () => {
    console.log('loadAIModel called:', { hasConfiguredSchemas, modelStatus });
    if (!hasConfiguredSchemas) {
      console.log('loadAIModel early return: no configured schemas');
      return;
    }
    
    if (modelStatus !== 'unloaded') {
      console.log('loadAIModel early return: model status is', modelStatus);
      return;
    }

    // Create abort controller for this load operation
    const abortController = new AbortController();
    setLoadAbortController(abortController);

    try {
      console.log('Starting model loading...');
      setModelStatus('loading');
      setModelLoadProgress(0);
      setError(null);

      // First check if the backend service is available
      console.log('Checking backend service availability...');
      const statusResponse = await fetch('/api/document-processor/status', {
        signal: abortController.signal
      });
      if (!statusResponse.ok) {
        throw new Error('Document processor backend is not available');
      }
      const statusData = await statusResponse.json();
      console.log('Backend status:', statusData);

      // Simulate progress during model loading
      const progressInterval = setInterval(() => {
        setModelLoadProgress(prev => Math.min(prev + 5, 90));
      }, 500);

      console.log('Making API request to load model...');
      const response = await fetch('/api/document-processor/load-model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: abortController.signal
      });

      clearInterval(progressInterval);
      console.log('API response received:', response.status, response.ok);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          error: 'Unknown error', 
          details: `Server returned status ${response.status}` 
        }));
        
        console.error('Model loading failed:', errorData);
        throw new Error(errorData.details || errorData.error || 'Failed to load AI model');
      }

      const responseData = await response.json();
      console.log('API response data:', responseData);

      setModelLoadProgress(100);
      setModelStatus('loaded');
      setLoadAbortController(null);
      console.log('Model loaded successfully!');
      
      toast({
        title: "AI Model Ready",
        description: "Document processing AI is now ready for use.",
      });

    } catch (err) {
      // Check if this was an abort
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Model loading was cancelled');
        setModelStatus('unloaded');
        setLoadAbortController(null);
        return;
      }
      
      console.error('Error in loadAIModel:', err);
      setModelStatus('error');
      setLoadAbortController(null);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load AI model';
      setError(errorMessage);
      
      toast({
        title: "Model Loading Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [hasConfiguredSchemas, modelStatus, toast]);

  // Unload AI model when leaving page
  const unloadAIModel = useCallback(async () => {
    // If model is currently loading, abort the load request and also tell server to unload
    if (modelStatus === 'loading') {
      console.log('Aborting model load in progress...');
      if (loadAbortController) {
        loadAbortController.abort();
        setLoadAbortController(null);
      }
      
      // Also call unload on server since it may have started loading
      try {
        await fetch('/api/document-processor/unload-model', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        console.log('Sent unload request to server during loading abort');
      } catch (err) {
        console.warn('Failed to send unload request during abort:', err);
      }
      
      setModelStatus('unloaded');
      return;
    }
    
    if (modelStatus !== 'loaded') return;

    try {
      setModelStatus('unloading');

      const response = await fetch('/api/document-processor/unload-model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn('Failed to unload AI model gracefully');
      }

      setModelStatus('unloaded');
      
    } catch (err) {
      console.error('Error unloading AI model:', err);
      setModelStatus('unloaded'); // Set to unloaded anyway
    }
  }, [modelStatus, loadAbortController]);

  // Initialize component
  useEffect(() => {
    // Reset state when component mounts (in case user navigated back)
    setShowProfileForm(false);
    setProcessingDocuments(new Map());
    setExtractedData(new Map());
    setError(null);
    setHasConfiguredSchemas(false); // Reset this too
    setUploadProgress(new Map()); // Reset upload progress
    
    fetchDocumentTypesAndConfig();
  }, [fetchDocumentTypesAndConfig]);

  // Reset model status on component mount
  useEffect(() => {
    // Reset model status to ensure fresh start when component mounts
    console.log('DocumentUpload component mounted, current modelStatus:', modelStatus);
    setModelStatus('unloaded');
    setModelLoadProgress(0);
    setUserCancelled(false); // Reset cancelled flag for fresh start
  }, []); // Empty dependency array - runs only on mount

  // Load AI model when component loads and schemas are available
  useEffect(() => {
    console.log('Model loading useEffect triggered:', { isLoading, hasConfiguredSchemas, modelStatus, userCancelled });
    if (!isLoading && hasConfiguredSchemas && modelStatus === 'unloaded' && !userCancelled) {
      console.log('Conditions met, calling loadAIModel()');
      loadAIModel();
    }
  }, [isLoading, hasConfiguredSchemas, modelStatus, userCancelled, loadAIModel]);

  // Cleanup: Unload model when component unmounts or user navigates away
  useEffect(() => {
    return () => {
      // If loading is in progress, abort it and tell server to unload
      if (loadAbortController) {
        loadAbortController.abort();
        // Use sendBeacon to reliably send unload request during unmount
        navigator.sendBeacon('/api/document-processor/unload-model', JSON.stringify({ action: 'unload' }));
      }
      if (modelStatus === 'loaded' || modelStatus === 'loading') {
        // Use sendBeacon for reliable cleanup during page unload
        const unloadData = JSON.stringify({ action: 'unload' });
        navigator.sendBeacon('/api/document-processor/unload-model', unloadData);
      }
    };
  }, [modelStatus, loadAbortController]);

  // Process document immediately when file is selected - NON-BLOCKING
  const processDocumentImmediately = useCallback((documentType: string, file: File) => {
    const docTypeInfo = documentTypes.find(dt => dt.columnName === documentType);
    const hasSchema = docTypeInfo?.hasSchema && hasConfiguredSchemas && modelStatus === 'loaded';

    // Check if model is loaded before allowing file processing
    if (docTypeInfo?.hasSchema && modelStatus !== 'loaded') {
      toast({
        title: "Model Not Ready",
        description: "Please wait for the AI model to load before uploading documents for processing.",
        variant: "destructive",
      });
      return;
    }

    // Check if already uploading this document type
    const existingDoc = processingDocuments.get(documentType);
    if (existingDoc && existingDoc.status === 'uploading') {
      toast({
        title: "Upload in Progress",
        description: `${docTypeInfo?.displayName} is already being uploaded. Please wait.`,
        variant: "destructive",
      });
      return;
    }

    // Create processing document entry immediately
    const processingDoc: ProcessingDocument = {
      documentId: `uploading_${Date.now()}`,
      file,
      documentType,
      status: 'uploading',
      timestamp: Date.now()
    };
    
    setProcessingDocuments(prev => new Map(prev).set(documentType, processingDoc));

    // Start upload in background - don't await
    uploadDocumentInBackground(documentType, file, hasSchema, docTypeInfo);
  }, [documentTypes, hasConfiguredSchemas, modelStatus, processingDocuments, toast]);

  // Background upload function - handles the actual upload without blocking UI
  const uploadDocumentInBackground = async (
    documentType: string, 
    file: File, 
    hasSchema: boolean, 
    docTypeInfo: any
  ) => {
    try {
      // Upload file with progress tracking
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);

      const endpoint = hasSchema 
        ? '/api/document-processor/upload-and-process'
        : '/api/document-processor/upload-simple';

      // Use XMLHttpRequest for progress tracking
      const result = await uploadWithProgress(endpoint, formData, documentType);
      
      if (hasSchema) {
        // Update with actual document ID and queue status for AI processing
        const updatedDoc: ProcessingDocument = {
          documentId: result.documentId,
          file,
          documentType,
          status: 'queued',
          queuePosition: result.queuePosition,
          timestamp: Date.now()
        };
        
        setProcessingDocuments(prev => new Map(prev).set(documentType, updatedDoc));
        
        // Start polling for status updates
        pollDocumentStatus(documentType, result.documentId);
        
        toast({
          title: "Document Queued",
          description: `${docTypeInfo?.displayName} is being processed...`,
        });
      } else {
        // Simple upload completed immediately
        const completedDoc: ProcessingDocument = {
          documentId: result.documentId,
          file,
          documentType,
          status: 'completed',
          timestamp: Date.now()
        };
        
        setProcessingDocuments(prev => new Map(prev).set(documentType, completedDoc));
        
        toast({
          title: "Document Uploaded",
          description: `${docTypeInfo?.displayName} uploaded successfully`,
        });
      }

    } catch (error) {
      console.error('Error processing document:', error);
      
      const errorDoc: ProcessingDocument = {
        documentId: `error_${Date.now()}`,
        file,
        documentType,
        status: 'error',
        error: error.message,
        timestamp: Date.now()
      };
      
      setProcessingDocuments(prev => new Map(prev).set(documentType, errorDoc));
      
      toast({
        title: "Upload Error",
        description: `Failed to upload ${docTypeInfo?.displayName}: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      // Clear upload progress
      setUploadProgress(prev => {
        const updated = new Map(prev);
        updated.delete(documentType);
        return updated;
      });
    }
  };

  // Upload with progress tracking using XMLHttpRequest
  const uploadWithProgress = (endpoint: string, formData: FormData, documentType: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(prev => new Map(prev).set(documentType, percentComplete));
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            resolve(result);
          } catch (error) {
            reject(new Error('Invalid response format'));
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            reject(new Error(errorData.details || errorData.error || 'Upload failed'));
          } catch (error) {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload was cancelled'));
      });

      // Start upload
      xhr.open('POST', endpoint);
      xhr.send(formData);
    });
  };

  // Poll document processing status
  const pollDocumentStatus = useCallback(async (documentType: string, documentId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/document-processor/status/${documentId}`);
        if (!response.ok) {
          clearInterval(pollInterval);
          return;
        }

        const result = await response.json();
        
        setProcessingDocuments(prev => {
          const current = prev.get(documentType);
          if (!current) return prev;
          
          const updated = new Map(prev);
          updated.set(documentType, {
            ...current,
            status: result.status,
            queuePosition: result.queuePosition,
            extractedData: result.extractedData,
            error: result.error,
            tempPath: result.tempPath // Store temp path when available
          });
          
          return updated;
        });

        // If completed or error, stop polling
        if (result.status === 'completed') {
          clearInterval(pollInterval);
          
          // Store extracted data
          if (result.extractedData) {
            setExtractedData(prev => new Map(prev).set(documentType, result.extractedData));
          }
          
          toast({
            title: "Processing Complete",
            description: `${documentTypes.find(dt => dt.columnName === documentType)?.displayName} processed successfully!`,
          });
          
        } else if (result.status === 'error') {
          clearInterval(pollInterval);
          
          toast({
            title: "Processing Failed",
            description: `Failed to process ${documentTypes.find(dt => dt.columnName === documentType)?.displayName}`,
            variant: "destructive",
          });
        }

      } catch (error) {
        console.error('Error polling document status:', error);
        clearInterval(pollInterval);
      }
    }, 2000); // Poll every 2 seconds

    // Clean up polling after 5 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 5 * 60 * 1000);
    
  }, [documentTypes, toast]);

  // File selection handler - now triggers immediate processing
  const handleFileSelect = (documentType: string, file: File | null) => {
    if (file) {
      processDocumentImmediately(documentType, file);
    } else {
      // Remove document from processing
      setProcessingDocuments(prev => {
        const updated = new Map(prev);
        updated.delete(documentType);
        return updated;
      });
      
      setExtractedData(prev => {
        const updated = new Map(prev);
        updated.delete(documentType);
        return updated;
      });
    }
  };

  // Check if all processing is complete
  const isProcessingComplete = useMemo(() => {
    if (processingDocuments.size === 0) return false;
    const statusArray = Array.from(processingDocuments.values());
    return statusArray.length > 0 && 
           statusArray.every(doc => doc.status === 'completed' || doc.status === 'error');
  }, [processingDocuments]);

  // Check if any processing is in progress
  const isProcessingInProgress = useMemo(() => {
    return Array.from(processingDocuments.values()).some(doc => 
      doc.status === 'uploading' || doc.status === 'queued' || doc.status === 'processing'
    );
  }, [processingDocuments]);

  // Navigate to profile creation
  const handleNext = async () => {
    if (!isProcessingComplete) {
      toast({
        title: "Processing Incomplete",
        description: "Please wait for all documents to finish processing.",
        variant: "destructive",
      });
      return;
    }

    // Unload AI model since processing is complete
    await unloadAIModel();

    // Show the pre-filled profile form
    setShowProfileForm(true);
  };

  // Handle profile form save
  const handleProfileSave = async (profileData: any) => {
    try {
      // Create student first
      const now = new Date().toISOString();
      const personalDetailsData = profileData['personal_details'];
      
      if (!personalDetailsData || !personalDetailsData.first_name) {
        toast({
          title: "Validation Error",
          description: "First name is required",
          variant: "destructive",
        });
        return;
      }

      const personalDetailsPayload = {
        ...personalDetailsData,
        created_at: now,
        updated_at: now
      };

      console.log('Creating profile with data:', personalDetailsPayload);

      const personalDetailsResponse = await fetch('/api/database/tables/personal_details/rows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(personalDetailsPayload)
      });

      if (!personalDetailsResponse.ok) {
        const errorData = await personalDetailsResponse.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Failed to create profile: ${errorData.details || errorData.error}`);
      }

      const personalDetailsResult = await personalDetailsResponse.json();
      const clientId = personalDetailsResult.insertedId;

      // Create records in other tables
      for (const tableName of Object.keys(profileData)) {
        if (tableName === 'personal_details') continue;

        const tableData = profileData[tableName];
        if (!tableData || Object.keys(tableData).length === 0) continue;

        const recordPayload = {
          client_id: clientId,
          ...tableData
        };

        const response = await fetch(`/api/database/tables/${tableName}/rows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(recordPayload)
        });

        if (!response.ok) {
          console.error(`Error creating ${tableName} record`);
        }
      }

      // Organize and save documents to client-specific folder
      if (documentFilesMap.size > 0) {
        try {
          const documentFilesObj = Object.fromEntries(documentFilesMap);
          console.log('Organizing documents for client:', clientId, documentFilesObj);
          
          const organizeResponse = await fetch(`/api/documents/organize/${clientId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentFiles: documentFilesObj })
          });

          if (!organizeResponse.ok) {
            console.error('Failed to organize documents');
            const errorData = await organizeResponse.json().catch(() => ({}));
            console.error('Document organization error:', errorData);
          } else {
            const organizeResult = await organizeResponse.json();
            console.log('Documents organized successfully:', organizeResult);
          }
        } catch (error) {
          console.error('Error organizing documents:', error);
        }
      }

      // Clean up any remaining temp files
      const documentIds = Array.from(processingDocuments.values()).map(doc => doc.documentId);
      if (documentIds.length > 0) {
        try {
          await fetch('/api/document-processor/cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentIds, moveToFinal: false }) // Just cleanup temp files
          });
        } catch (error) {
          console.warn('Failed to cleanup temp files:', error);
        }
      }

      toast({
        title: "Success!",
        description: "Profile created successfully",
      });

      // Unload AI model after successful save
      await unloadAIModel();

      // Close tab or redirect to dashboard
      navigate('/');

    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "Error",
        description: "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle profile form cancel
  const handleProfileCancel = async () => {
    // Set cancelled flag to prevent automatic model reloading
    setUserCancelled(true);
    
    // Unload AI model
    await unloadAIModel();

    // Navigate back to dashboard
    navigate('/');
  };

  // Handle cancel button functionality - discard data and cleanup
  const handleCancel = async () => {
    try {
      // Set cancelled flag to prevent automatic model reloading
      setUserCancelled(true);
      
      // Get document IDs to cleanup
      const documentIds = Array.from(processingDocuments.values()).map(doc => doc.documentId);
      
      // Cleanup documents (delete temp files)
      if (documentIds.length > 0) {
        try {
          await fetch('/api/document-processor/cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentIds, moveToFinal: false })
          });
        } catch (error) {
          console.warn('Failed to cleanup documents:', error);
        }
      }
      
      // Clear state
      setExtractedData(new Map());
      setProcessingDocuments(new Map());
      setUploadProgress(new Map()); // Clear upload progress
      
      // Unload AI model
      await unloadAIModel();
      
      toast({
        title: "Cancelled",
        description: "Document processing cancelled.",
      });

      // Close tab or redirect to dashboard
      navigate('/');
    } catch (error) {
      console.error('Error during cancellation:', error);
      toast({
        title: "Error",
        description: "Error occurred during cancellation.",
        variant: "destructive",
      });
      // Still navigate away even if there was an error
      navigate('/');
    }
  };

  // Navigate back to dashboard
  const handleBack = async () => {
    // Set cancelled flag to prevent automatic model reloading
    setUserCancelled(true);
    
    // Unload AI model before navigating away
    await unloadAIModel();
    navigate('/');
  };

  // Create document files map for the form
  const documentFilesMap = useMemo(() => {
    const filesMap = new Map<string, string>();
    processingDocuments.forEach((doc, docType) => {
      if (doc.status === 'completed' && doc.tempPath) {
        // Use the actual temp path from the processing queue
        filesMap.set(docType, doc.tempPath);
      }
    });
    return filesMap;
  }, [processingDocuments]);

  // Show profile form if user clicked Next
  if (showProfileForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary-light/10 to-accent-light/10">
        <div className="container mx-auto px-4 py-8">
          <PrefilledProfileForm
            extractedData={extractedData}
            documentFiles={documentFilesMap}
            onSave={handleProfileSave}
            onCancel={handleProfileCancel}
          />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary-light/10 to-accent-light/10 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Loading Document Upload</h3>
            <p className="text-sm text-muted-foreground text-center">
              Fetching document types and configuration...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary-light/10 to-accent-light/10">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <div className="h-8 w-px bg-border" />
              <div>
                <h1 className="text-xl font-bold">Document Upload</h1>
                <p className="text-sm text-muted-foreground">
                  Upload documents for intelligent data extraction
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {modelStatus === 'loaded' && (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  AI Model Ready
                </Badge>
              )}
              {modelStatus === 'loading' && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Loading AI Model
                </Badge>
              )}
              {modelStatus === 'error' && (
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Model Error
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Model Loading Status */}
        {modelStatus === 'loading' && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              <div className="space-y-2">
                <div>Loading AI model for document processing... This may take 10-15 seconds.</div>
                <Progress value={modelLoadProgress} className="w-full" />
                <div className="text-xs text-muted-foreground">
                  {modelLoadProgress < 50 ? 'Initializing AI model...' : 
                   modelLoadProgress < 90 ? 'Loading model weights...' : 'Almost ready...'}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {modelStatus === 'error' && error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <div className="font-medium">AI Model Loading Failed</div>
                <div className="text-sm">{error}</div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setError(null);
                      setModelStatus('unloaded');
                      loadAIModel();
                    }}
                  >
                    Try Again
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setError(null);
                      setModelStatus('unloaded');
                      setHasConfiguredSchemas(false);
                    }}
                  >
                    Continue Without AI Processing
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {!hasConfiguredSchemas && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No document extraction schemas are configured. Documents will be uploaded as regular files without AI processing.
              Configure schemas in the Admin Panel to enable intelligent data extraction.
            </AlertDescription>
          </Alert>
        )}

        {/* Document Types List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Document Types
            </CardTitle>
            <CardDescription>
              Select files for each document type. Configured types will be processed with AI extraction.
              {modelStatus === 'loading' && (
                <div className="mt-2 text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                  <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
                  File uploads for AI processing are disabled while the model is loading. Please wait...
                </div>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {documentTypes && documentTypes.length > 0 ? documentTypes.map((docType) => {
                const processingDoc = processingDocuments.get(docType.columnName);
                const hasFile = processingDoc !== undefined;
                
                return (
                  <div key={docType.columnName} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        {processingDoc?.status === 'uploading' && (
                          <Loader2 className="h-3 w-3 animate-spin absolute -top-1 -right-1 text-blue-500" />
                        )}
                        {processingDoc?.status === 'queued' && (
                          <div className="h-3 w-3 absolute -top-1 -right-1 bg-yellow-500 rounded-full animate-pulse" />
                        )}
                        {processingDoc?.status === 'processing' && (
                          <Loader2 className="h-3 w-3 animate-spin absolute -top-1 -right-1 text-blue-500" />
                        )}
                        {processingDoc?.status === 'completed' && (
                          <CheckCircle className="h-3 w-3 absolute -top-1 -right-1 text-green-500" />
                        )}
                        {processingDoc?.status === 'error' && (
                          <AlertCircle className="h-3 w-3 absolute -top-1 -right-1 text-red-500" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{docType.displayName}</div>
                        <div className="text-sm text-muted-foreground flex items-center space-x-2">
                          <span>{docType.columnName}</span>
                          {docType.hasSchema ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              AI Extraction
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              Regular Upload
                            </Badge>
                          )}
                          {processingDoc?.status === 'uploading' && (
                            <div className="flex items-center space-x-2">
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Uploading
                              </Badge>
                              {uploadProgress.has(docType.columnName) && (
                                <div className="flex items-center space-x-1">
                                  <div className="text-xs text-blue-600">
                                    {uploadProgress.get(docType.columnName)}%
                                  </div>
                                  <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-blue-500 transition-all duration-300"
                                      style={{ width: `${uploadProgress.get(docType.columnName) || 0}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                          {processingDoc?.status === 'queued' && (
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                              <div className="h-3 w-3 mr-1 bg-yellow-500 rounded-full animate-pulse" />
                              Queued {processingDoc.queuePosition && `(#${processingDoc.queuePosition})`}
                            </Badge>
                          )}
                          {processingDoc?.status === 'processing' && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Processing
                            </Badge>
                          )}
                          {processingDoc?.status === 'completed' && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Complete
                            </Badge>
                          )}
                          {processingDoc?.status === 'error' && (
                            <Badge variant="destructive">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Error
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {hasFile && (
                        <div className="text-sm text-muted-foreground max-w-48 truncate">
                          {processingDoc?.file.name}
                        </div>
                      )}
                      {processingDoc?.status === 'error' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Retry by re-selecting the same file
                            if (processingDoc?.file) {
                              processDocumentImmediately(docType.columnName, processingDoc.file);
                            }
                          }}
                          disabled={isProcessingInProgress || (docType.hasSchema && modelStatus !== 'loaded')}
                          title={docType.hasSchema && modelStatus !== 'loaded' ? 'Please wait for AI model to load' : ''}
                        >
                          Retry
                        </Button>
                      )}
                      <input
                        type="file"
                        id={`file-${docType.columnName}`}
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        disabled={docType.hasSchema && modelStatus !== 'loaded'}
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          handleFileSelect(docType.columnName, file);
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={docType.hasSchema && modelStatus !== 'loaded'}
                        onClick={() => document.getElementById(`file-${docType.columnName}`)?.click()}
                        title={docType.hasSchema && modelStatus !== 'loaded' ? 'Please wait for AI model to load' : ''}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {hasFile ? 'Change File' : 'Select File'}
                      </Button>
                      {hasFile && processingDoc?.status !== 'uploading' && processingDoc?.status !== 'processing' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleFileSelect(docType.columnName, null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No document types available.</p>
                  <p className="text-sm">Please add document type columns in the admin panel.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <div className="flex space-x-3">
            {isProcessingComplete && (
              <Button onClick={handleNext}>
                Next: Create Profile
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DocumentUpload;