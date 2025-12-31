// Form Master Pro - Comprehensive Profile Type Definitions
// Based on PRD specifications for Indian entrance exam applications

export interface Profile {
  id: string; // Format: PROF-YYYY-NNNN (kept for backward compatibility)
  client_id: number; // INTEGER primary key identifier
  userId?: string;
  createdAt: string;
  updatedAt: string;
  completionPercentage: number;
  status: 'draft' | 'complete' | 'verified' | 'archived';
  
  // Core profile data organized by categories
  personalInfo: PersonalInformation;
  contactInfo: ContactInformation;
  familyDetails: FamilyDetails;
  casteReservation: CasteReservationDetails;
  educationalDetails: EducationalDetails;
  examinationDetails: ExaminationDetails;
  quotaDetails: QuotaDetails;
  credentials: SiteCredentials;
  documents: DocumentDetails;
}

// Personal Information (25 fields)
export interface PersonalInformation {
  // Basic Details
  fullName: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth: string;
  aadhaarNumber?: string;
  otherIdProof?: string;
  otherIdProofType?: string;
  
  // Family Details
  fatherName: string;
  motherName: string;
  guardianName?: string;
  fatherOccupation?: string;
  motherOccupation?: string;
  guardianOccupation?: string;
  
  // Personal Attributes
  nationality: string;
  placeOfBirth?: string;
  religion?: string;
  motherTongue?: string;
  maritalStatus?: 'single' | 'married' | 'other';
  bloodGroup?: string;
}

// Contact Information (10 fields)
export interface ContactInformation {
  // Address Details
  presentAddress: string;
  permanentAddress: string;
  sameAsPresentAddress: boolean;
  stateOfDomicile: string;
  districtOfDomicile: string;
  pinCode: string;
  
  // Communication Details
  mobileNumber: string;
  alternateMobileNumber?: string;
  emailId: string;
  alternateEmailId?: string;
  emergencyContactNumber?: string;
}

// Family Details (20 fields)
export interface FamilyDetails {
  // Father's Information
  fatherFullName: string;
  fatherDateOfBirth?: string;
  fatherEducation?: string;
  fatherOccupation?: string;
  fatherDesignation?: string;
  fatherOrganization?: string;
  fatherAnnualIncome?: string;
  fatherMobileNumber?: string;
  fatherEmailId?: string;
  fatherPanNumber?: string;
  
  // Mother's Information
  motherFullName: string;
  motherDateOfBirth?: string;
  motherEducation?: string;
  motherOccupation?: string;
  motherDesignation?: string;
  motherOrganization?: string;
  motherAnnualIncome?: string;
  motherMobileNumber?: string;
  motherEmailId?: string;
  motherPanNumber?: string;
  
  // Guardian Information (if applicable)
  guardianFullName?: string;
  guardianRelationship?: string;
  guardianOccupation?: string;
  guardianAnnualIncome?: string;
  guardianMobileNumber?: string;
  guardianEmailId?: string;
  
  // Family Financial Information
  combinedFamilyAnnualIncome?: number;
  incomeCertificateNumber?: string;
  incomeCertificateIssuingAuthority?: string;
  incomeCertificateDateOfIssue?: string;
}

// Caste & Reservation Details (15 fields)
export interface CasteReservationDetails {
  // Category Information
  caste?: string;
  category: 'general' | 'obc-ncl' | 'sc' | 'st' | 'ews';
  minorityStatus: boolean;
  subCategory?: string;
  
  // Certificate Details
  casteCertificateNumber?: string;
  casteIssuingAuthority?: string;
  casteDateOfIssue?: string;
  casteStateOfIssue?: string;
  
  // EWS Certificate (if applicable)
  ewsCertificateNumber?: string;
  ewsIssuingAuthority?: string;
  ewsDateOfIssue?: string;
  
  // Special Categories
  pwdStatus: boolean;
  pwdType?: string;
  disabilityPercentage?: number;
  pwdCertificateNumber?: string;
}

// Educational Details (30 fields)
export interface EducationalDetails {
  // Class 10 Information
  class10Board: string;
  class10SchoolName: string;
  class10SchoolAddress?: string;
  class10YearOfPassing: string;
  class10RollNumber?: string;
  class10EnrollmentNumber?: string;
  class10Percentage?: number;
  class10PassingStatus: 'pass' | 'compartment' | 'fail';
  
  // Class 12 Information
  class12Board: string;
  class12SchoolName: string;
  class12SchoolAddress?: string;
  class12YearOfPassing: string;
  class12RollNumber?: string;
  class12EnrollmentNumber?: string;
  class12Stream: 'science' | 'commerce' | 'arts';
  class12Group?: 'pcm' | 'pcb' | 'pcmb' | 'other';
  
  // Subject-wise Marks
  physicsMarks?: number;
  chemistryMarks?: number;
  mathematicsMarks?: number;
  biologyMarks?: number;
  englishMarks?: number;
  optionalSubjectMarks?: number;
  totalMarks?: number;
  class12Percentage?: number;
  
  // Additional Educational Details
  mediumOfInstruction?: string;
  gapYearDetails?: string;
  diplomaDetails?: string;
}

// Examination Details (45 fields)
export interface ExaminationDetails {
  // JEE Main Information
  jeeMainApplicationNumber?: string;
  jeeMainSession?: string;
  jeeMainPaperChoice?: string;
  jeeMainRollNumber?: string;
  jeeMainExamDate?: string;
  jeeMainShift?: string;
  jeeMainExamCity1?: string;
  jeeMainExamCity2?: string;
  jeeMainExamCity3?: string;
  jeeMainExamCity4?: string;
  jeeMainLanguagePreference?: string;
  jeeMainScore?: number;
  jeeMainPercentile?: number;
  jeeMainRank?: number;
  jeeMainNormalizationScore?: number;
  
  // JEE Advanced Information
  jeeAdvancedRegistrationNumber?: string;
  jeeAdvancedExamDate?: string;
  jeeAdvancedPaper1ExamCity?: string;
  jeeAdvancedPaper2ExamCity?: string;
  jeeAdvancedLanguagePreference?: string;
  jeeAdvancedPaper1Score?: number;
  jeeAdvancedPaper2Score?: number;
  jeeAdvancedTotalScore?: number;
  jeeAdvancedCRLRank?: number;
  jeeAdvancedCategoryRank?: number;
  
  // NEET Information
  neetApplicationNumber?: string;
  neetRollNumber?: string;
  neetExamDate?: string;
  neetExamCity1?: string;
  neetExamCity2?: string;
  neetExamCity3?: string;
  neetLanguagePreference?: string;
  neetScore?: number;
  neetPercentile?: number;
  neetAllIndiaRank?: number;
  neetCategoryRank?: number;
  neetStateRank?: number;
  
  // State CET Information
  stateCetName?: string;
  stateCetApplicationNumber?: string;
  stateCetRollNumber?: string;
  stateCetExamDate?: string;
  stateCetExamCenter?: string;
  stateCetScore?: number;
  stateCetPercentileRank?: number;
  
  // Other Entrance Exams
  otherExamName?: string;
  otherExamRegistrationNumber?: string;
  otherExamDate?: string;
  otherExamScore?: number;
  otherExamRank?: number;
}

// Quota & Special Category Details (25 fields)
export interface QuotaDetails {
  // State/Domicile Quota
  homeStateStatus: boolean;
  domicileCertificateNumber?: string;
  domicileIssuingAuthority?: string;
  domicileDateOfIssue?: string;
  yearsOfResidenceInState?: number;
  
  // Defense Quota
  defensePersonnelStatus: boolean;
  defenseCategory?: string;
  serviceNumber?: string;
  rank?: string;
  unitFormation?: string;
  defenseIdentityCardNumber?: string;
  
  // Sports Quota
  sportsAchievement: boolean;
  sportName?: string;
  levelOfAchievement?: string;
  competitionName?: string;
  achievementYear?: string;
  certificateAuthority?: string;
  
  // NCC Quota
  nccParticipation: boolean;
  nccCertificateLevel?: string;
  nccUnit?: string;
  nccCertificateNumber?: string;
  nccCertificateDate?: string;
  
  // Other Special Categories
  migrantStatus: boolean;
  tsunamiAffected: boolean;
  childrenOfFreedomFighters: boolean;
  bplStatus: boolean;
  ruralUrbanArea?: 'rural' | 'urban';
  
  // Management/NRI Quota
  managementQuotaInterest: boolean;
  nriStatus: boolean;
  nriSponsorDetails?: string;
  passportNumber?: string;
  visaStatus?: string;
}

// Site Credentials & Application Tracking (30 fields)
export interface SiteCredentials {
  // JEE Main Portal
  jeeMainUsername?: string;
  jeeMainPassword?: string; // Encrypted
  jeeMainSecurityQuestion1?: string;
  jeeMainSecurityAnswer1?: string;
  jeeMainSecurityQuestion2?: string;
  jeeMainSecurityAnswer2?: string;
  jeeMainLastLogin?: string;
  jeeMainPasswordLastChanged?: string;
  
  // NEET Portal
  neetUsername?: string;
  neetPassword?: string; // Encrypted
  neetSecurityQuestion?: string;
  neetSecurityAnswer?: string;
  neetRegisteredMobile?: string;
  neetRegisteredEmail?: string;
  neetLastLogin?: string;
  
  // State CET Portals
  stateCetUsername?: string;
  stateCetPassword?: string; // Encrypted
  acpcUsername?: string;
  acpcPassword?: string; // Encrypted
  
  // Application Status Tracking
  jeeMainApplicationStatus?: 'not_started' | 'in_progress' | 'submitted' | 'payment_pending' | 'complete';
  jeeMainApplicationDate?: string;
  jeeMainPaymentStatus?: 'pending' | 'success' | 'failed';
  jeeMainPaymentTransactionId?: string;
  
  neetApplicationStatus?: 'not_started' | 'in_progress' | 'submitted' | 'payment_pending' | 'complete';
  neetApplicationDate?: string;
  neetPaymentStatus?: 'pending' | 'success' | 'failed';
  neetPaymentTransactionId?: string;
  
  stateCetApplicationStatus?: 'not_started' | 'in_progress' | 'submitted' | 'payment_pending' | 'complete';
  stateCetApplicationDate?: string;
  stateCetPaymentStatus?: 'pending' | 'success' | 'failed';
  stateCetPaymentTransactionId?: string;
}

// Document Management (20 fields)
export interface DocumentDetails {
  // Mandatory Documents
  passportSizePhotographPath?: string;
  signatureImagePath?: string;
  leftThumbImpressionPath?: string;
  class10CertificatePath?: string;
  class10MarksheetPath?: string;
  class12CertificatePath?: string;
  class12MarksheetPath?: string;
  characterCertificatePath?: string;
  transferCertificatePath?: string;
  migrationCertificatePath?: string;
  
  // Category Certificates
  casteCertificatePath?: string;
  incomeCertificatePath?: string;
  domicileCertificatePath?: string;
  ewsCertificatePath?: string;
  pwdCertificatePath?: string;
  
  // Additional Documents
  aadhaarCardPath?: string;
  panCardPath?: string;
  passportPath?: string;
  gapYearAffidavitPath?: string;
  otherDocument1Path?: string;
  otherDocument2Path?: string;
}

// Field Categories for UI Organization
export type FieldCategory = 
  | 'personal'
  | 'contact' 
  | 'family'
  | 'caste'
  | 'education'
  | 'examination'
  | 'quota'
  | 'credentials'
  | 'documents';

// Field Template for Dynamic Form Generation
export interface FieldTemplate {
  id: string;
  category: FieldCategory;
  fieldName: string;
  displayLabel: string;
  fieldType: 'text' | 'number' | 'date' | 'dropdown' | 'file' | 'email' | 'tel' | 'textarea' | 'checkbox';
  isRequired: boolean;
  validationRules?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
  dropdownOptions?: string[];
  displayOrder: number;
  isActive: boolean;
  helpText?: string;
  placeholder?: string;
}

// Copy Action Tracking
export interface CopyAction {
  id: string;
  profileId: string;
  fieldName: string;
  fieldValue: string;
  destinationContext?: string;
  copyTimestamp: string;
  sessionId: string;
  successStatus: boolean;
}

// Profile Statistics
export interface ProfileStats {
  totalFields: number;
  completedFields: number;
  completionPercentage: number;
  lastUpdated: string;
  documentsUploaded: number;
  totalDocuments: number;
  verificationStatus: 'pending' | 'partial' | 'complete';
}

// Export utility type for form field paths
export type ProfileFieldPath = 
  | keyof PersonalInformation
  | keyof ContactInformation
  | keyof FamilyDetails
  | keyof CasteReservationDetails
  | keyof EducationalDetails
  | keyof ExaminationDetails
  | keyof QuotaDetails
  | keyof SiteCredentials
  | keyof DocumentDetails;