# Document Extractor - AI-Powered Document Processing System

A comprehensive web application for intelligent document processing and data extraction with AI-powered analysis, built with React, TypeScript, and Express.js.

## 🚀 Features

### Core Functionality
- **AI-Powered Document Processing**: Extract structured data from PDFs, images, and documents using advanced AI models
- **Dynamic Profile Management**: Create and manage client profiles with flexible table structures
- **Real-time Document Upload**: Drag-and-drop interface with immediate processing and queue management
- **Intelligent Data Validation**: Advanced validation with email detection, constraints, and dropdown options
- **Admin Configuration Panel**: Configure document parsing schemas and field mappings

### Advanced Capabilities
- **Automatic Lifecycle Management**: Backend services start/stop with the web application
- **GPU Acceleration**: Automatic NVIDIA GPU detection for faster AI processing
- **Queue-based Processing**: Handle multiple documents simultaneously with status tracking
- **Comprehensive Error Handling**: Detailed error reporting and recovery mechanisms
- **Database Migration Support**: Automatic schema updates and backward compatibility

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **Framework**: Vite + React 18 + TypeScript
- **UI Components**: Radix UI + Tailwind CSS + shadcn/ui
- **State Management**: React Query for server state
- **Routing**: React Router DOM
- **Forms**: React Hook Form + Zod validation

### Backend (Node.js + Express)
- **Runtime**: Node.js with Express.js
- **Database**: SQLite with WAL mode
- **File Processing**: Multer for uploads with temporary storage
- **AI Integration**: Custom document processor with LLM inference
- **Services**: Modular architecture with service classes

### AI Processing Pipeline
- **Document Processor**: Python-based executable (86MB)
- **LLM Engine**: Llama.cpp server with CUDA support
- **AI Model**: Gemma-3n-E4B-it (4GB quantized model)
- **OCR Engine**: Tesseract with multiple language support

## 📁 Project Structure

```
├── src/                          # Frontend React application
│   ├── components/              # Reusable UI components
│   │   ├── admin/              # Admin panel components
│   │   └── ui/                 # Base UI components (shadcn/ui)
│   ├── pages/                  # Application pages
│   │   ├── DocumentUpload.tsx  # Document processing interface
│   │   ├── AdminPanel.tsx      # Configuration panel
│   │   └── Index.tsx           # Profile management
│   ├── lib/                    # Utility functions
│   └── hooks/                  # Custom React hooks
├── server/                     # Backend Express server
│   ├── index.ts               # Main server file
│   ├── documentProcessorService.ts  # AI processing service
│   ├── documentParsingConfig.ts     # Schema configuration
│   ├── tableDiscovery.ts      # Database introspection
│   ├── validationService.ts   # Data validation
│   └── Data/                  # File storage directory
├── backend/                   # AI processing backend
│   ├── document-processor.exe # Main AI processor (86MB)
│   ├── llama_server/         # LLM inference engine
│   ├── gemma-3n-E4B-it-text-GGUF/  # AI model files
│   └── tesseract/            # OCR engine
├── tests/                    # Test suites
└── docs/                     # Documentation
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Windows OS (for AI backend)
- NVIDIA GPU (optional, for acceleration)
- Git LFS (for large file support)

### Quick Start

1. **Clone the repository**
   ```bash
   git lfs install  # Enable Git LFS
   git clone <repository-url>
   cd document-extractor
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev:full
   ```
   This starts both the web application (port 5173) and API server (port 5174)

### Alternative Start Methods

**Web only:**
```bash
npm run dev
```

**API server only:**
```bash
npm run server
```

**Production build:**
```bash
npm run build
npm run preview
```

## 🔧 Configuration

### Document Processing Setup

1. **Access Admin Panel**: Navigate to `/admin` in the web application
2. **Configure Document Types**: Set up parsing schemas for different document types
3. **Field Mapping**: Map document fields to database columns
4. **Validation Rules**: Configure constraints, dropdowns, and validation

### Backend Configuration

The AI backend automatically configures itself:
- **Port**: 8001 (configurable)
- **GPU Detection**: Automatic NVIDIA GPU detection
- **Model Loading**: Automatic on first document processing
- **Lifecycle**: Starts with web app, stops when web app closes

### Database Configuration

- **Type**: SQLite with WAL mode
- **Location**: `server/student_management.db`
- **Migrations**: Automatic on startup
- **Backup**: WAL files provide transaction safety

## 📊 Usage

### Document Processing Workflow

1. **Upload Documents**: Drag and drop files in the Document Upload page
2. **Automatic Processing**: Files are immediately queued and processed
3. **AI Extraction**: AI model extracts structured data based on configured schema
4. **Profile Creation**: Extracted data populates client profiles
5. **Review & Edit**: Manual review and editing of extracted data

### Profile Management

1. **Dynamic Forms**: Forms adapt to database schema
2. **Validation**: Real-time validation with custom rules
3. **File Attachments**: Associate documents with profiles
4. **Search & Filter**: Find profiles by various criteria

### Admin Functions

1. **Schema Configuration**: Define document parsing rules
2. **Field Management**: Configure validation and constraints
3. **System Monitoring**: View processing status and logs
4. **Database Management**: Handle migrations and updates

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- --testNamePattern="document"
```

### Test Coverage
- Unit tests for services and utilities
- Integration tests for API endpoints
- Document processing pipeline tests
- Database migration tests

## 🚀 Deployment

### Development
```bash
npm run dev:full
```

### Production Build
```bash
npm run build
npm run preview
```

### Backend Deployment
The AI backend (`backend/document-processor.exe`) is a self-contained executable that includes all dependencies.

## 📝 API Documentation

### Core Endpoints

**Profile Management:**
- `GET /api/database/tables` - List all tables
- `POST /api/database/tables/:table/records` - Create record
- `GET /api/database/tables/:table/records` - List records
- `PUT /api/database/tables/:table/records/:id` - Update record

**Document Processing:**
- `POST /api/document-processor/process` - Process document
- `GET /api/document-processor/status` - Get processing status
- `GET /api/document-processor/queue` - View processing queue

**Configuration:**
- `GET /api/document-parsing/config` - Get parsing configuration
- `POST /api/document-parsing/config/schema` - Update schema
- `DELETE /api/document-parsing/config/schema/:type` - Delete schema

## 🔍 Troubleshooting

### Common Issues

**Backend not starting:**
- Check if port 8001 is available
- Verify NVIDIA drivers (for GPU acceleration)
- Check Windows Defender/antivirus settings

**Document processing fails:**
- Verify file format (PDF, JPG, PNG supported)
- Check file size (10MB limit)
- Ensure schema is configured for document type

**Database errors:**
- Check file permissions in `server/` directory
- Verify SQLite database isn't locked
- Review migration logs

### Performance Optimization

**AI Processing:**
- Use NVIDIA GPU for 10x faster processing
- Adjust batch sizes for memory optimization
- Monitor GPU memory usage

**Database:**
- WAL mode enabled for better concurrency
- Regular VACUUM operations for optimization
- Index optimization for large datasets

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Llama.cpp** - High-performance LLM inference
- **Tesseract OCR** - Optical character recognition
- **Gemma Model** - Google's efficient language model
- **shadcn/ui** - Beautiful UI components
- **Radix UI** - Accessible component primitives

## 📞 Support

For support and questions:
- Create an issue in the repository
- Check the documentation in the `docs/` folder
- Review the API documentation in `backend/API_DOCUMENTATION.md`

---

**Version**: 1.0.0  
**Last Updated**: December 2024  
**Node.js**: 18+  
**React**: 18.3+  
**TypeScript**: 5.8+