import { useState, useCallback } from "react";
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface DocumentUploadFieldProps {
  fieldId: string;
  displayName: string;
  placeholder?: string;
  helpText?: string;
  isRequired: boolean;
  isReadonly: boolean;
  allowedFileTypes: string[];
  maxFileSize: number;
  enableDragAndDrop: boolean;
  enablePreview: boolean;
  enableAIProcessing: boolean;
  value?: File | string | null;
  onChange?: (file: File | null) => void;
  onProcessingComplete?: (extractedData: any) => void;
}

interface ProcessingStatus {
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  extractedData?: any;
}

/**
 * Document Upload Field Component
 * Integrates with existing document upload pipeline
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
const DocumentUploadField = ({
  fieldId,
  displayName,
  placeholder = "Upload document",
  helpText,
  isRequired,
  isReadonly,
  allowedFileTypes,
  maxFileSize,
  enableDragAndDrop,
  enablePreview,
  enableAIProcessing,
  value,
  onChange,
  onProcessingComplete,
}: DocumentUploadFieldProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(
    value instanceof File ? value : null
  );
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    status: 'idle',
    progress: 0,
  });
  const [isDragOver, setIsDragOver] = useState(false);

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Validate file
  const validateFile = (file: File): string | null => {
    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedFileTypes.includes(fileExtension)) {
      return `File type ${fileExtension} is not allowed. Allowed types: ${allowedFileTypes.join(', ')}`;
    }

    // Check file size
    if (file.size > maxFileSize) {
      return `File size ${formatFileSize(file.size)} exceeds maximum allowed size of ${formatFileSize(maxFileSize)}`;
    }

    return null;
  };

  // Process document upload
  const processDocument = useCallback(async (file: File) => {
    try {
      setProcessingStatus({ status: 'uploading', progress: 10 });

      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', fieldId);

      // Determine endpoint based on AI processing capability
      const endpoint = enableAIProcessing 
        ? '/api/document-processor/upload-and-process'
        : '/api/document-processor/upload-simple';

      setProcessingStatus({ status: 'uploading', progress: 30 });

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.details || errorData.error || 'Upload failed');
      }

      const result = await response.json();
      setProcessingStatus({ status: 'uploading', progress: 60 });

      if (enableAIProcessing && result.documentId) {
        // Start polling for AI processing status
        await pollProcessingStatus(result.documentId);
      } else {
        // Simple upload completed
        setProcessingStatus({ 
          status: 'completed', 
          progress: 100,
          extractedData: result.extractedData || null
        });

        if (onProcessingComplete && result.extractedData) {
          onProcessingComplete(result.extractedData);
        }
      }
    } catch (error) {
      console.error('Document processing error:', error);
      setProcessingStatus({
        status: 'error',
        progress: 0,
        error: error.message || 'Processing failed'
      });
    }
  }, [fieldId, enableAIProcessing, onProcessingComplete]);

  // Poll processing status for AI processing
  const pollProcessingStatus = useCallback(async (documentId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/document-processor/status/${documentId}`);
        if (!response.ok) {
          clearInterval(pollInterval);
          return;
        }

        const result = await response.json();
        
        setProcessingStatus({
          status: result.status,
          progress: result.status === 'processing' ? 80 : 
                   result.status === 'completed' ? 100 : 60,
          extractedData: result.extractedData,
          error: result.error
        });

        if (result.status === 'completed') {
          clearInterval(pollInterval);
          if (onProcessingComplete && result.extractedData) {
            onProcessingComplete(result.extractedData);
          }
        } else if (result.status === 'error') {
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Error polling status:', error);
        clearInterval(pollInterval);
        setProcessingStatus({
          status: 'error',
          progress: 0,
          error: 'Failed to check processing status'
        });
      }
    }, 2000);

    // Clean up after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
  }, [onProcessingComplete]);

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      setProcessingStatus({ status: 'idle', progress: 0 });
      onChange?.(null);
      return;
    }

    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      setProcessingStatus({
        status: 'error',
        progress: 0,
        error: validationError
      });
      return;
    }

    setSelectedFile(file);
    onChange?.(file);

    // Start processing
    await processDocument(file);
  }, [onChange, processDocument, validateFile]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!enableDragAndDrop || isReadonly) return;
    
    e.preventDefault();
    setIsDragOver(true);
  }, [enableDragAndDrop, isReadonly]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!enableDragAndDrop || isReadonly) return;
    
    e.preventDefault();
    setIsDragOver(false);
  }, [enableDragAndDrop, isReadonly]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!enableDragAndDrop || isReadonly) return;
    
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [enableDragAndDrop, isReadonly, handleFileSelect]);

  // Handle file input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleFileSelect(file);
  }, [handleFileSelect]);

  // Remove file
  const handleRemoveFile = useCallback(() => {
    handleFileSelect(null);
  }, [handleFileSelect]);

  return (
    <div className="space-y-2">
      {/* Field Label */}
      <label className="block text-sm font-medium">
        {displayName}
        {isRequired && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Upload Area */}
      <Card className={`transition-colors ${
        isDragOver ? 'border-primary bg-primary/5' : 'border-border'
      } ${isReadonly ? 'opacity-50' : ''}`}>
        <CardContent className="p-4">
          {selectedFile ? (
            // File Selected State
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-blue-600" />
                  <div>
                    <div className="font-medium text-sm">{selectedFile.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {processingStatus.status === 'uploading' && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Uploading
                    </Badge>
                  )}
                  {processingStatus.status === 'processing' && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Processing
                    </Badge>
                  )}
                  {processingStatus.status === 'completed' && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Complete
                    </Badge>
                  )}
                  {processingStatus.status === 'error' && (
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Error
                    </Badge>
                  )}
                  {!isReadonly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveFile}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {(processingStatus.status === 'uploading' || processingStatus.status === 'processing') && (
                <Progress value={processingStatus.progress} className="w-full" />
              )}

              {/* Error Message */}
              {processingStatus.status === 'error' && processingStatus.error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {processingStatus.error}
                </div>
              )}

              {/* AI Processing Results */}
              {processingStatus.status === 'completed' && processingStatus.extractedData && enableAIProcessing && (
                <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                  <div className="font-medium">AI Processing Complete</div>
                  <div className="text-xs">
                    Extracted {Object.keys(processingStatus.extractedData).length} fields
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Upload Area
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              } ${enableDragAndDrop && !isReadonly ? 'cursor-pointer hover:border-primary/50' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isReadonly && document.getElementById(`file-input-${fieldId}`)?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <div className="text-sm font-medium mb-1">
                {placeholder}
              </div>
              <div className="text-xs text-muted-foreground mb-3">
                {enableDragAndDrop ? 'Drag and drop or click to select' : 'Click to select file'}
              </div>
              <div className="text-xs text-muted-foreground">
                Allowed: {allowedFileTypes.join(', ')} • Max: {formatFileSize(maxFileSize)}
              </div>
              {enableAIProcessing && (
                <Badge variant="outline" className="mt-2 text-xs">
                  AI Processing Enabled
                </Badge>
              )}
            </div>
          )}

          {/* Hidden File Input */}
          <input
            id={`file-input-${fieldId}`}
            type="file"
            className="hidden"
            accept={allowedFileTypes.join(',')}
            onChange={handleInputChange}
            disabled={isReadonly}
          />
        </CardContent>
      </Card>

      {/* Help Text */}
      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
};

export default DocumentUploadField;