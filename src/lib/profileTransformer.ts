import { Profile } from "@/types/profile";

export interface ProfileFormData {
  name: string;
  email?: string;
  phone?: string;
  dateOfBirth?: Date;
  gender?: string;
  fatherName?: string;
  motherName?: string;
  category?: string;
  state?: string;
}

export class ProfileTransformer {
  static transformFormDataToProfile(formData: ProfileFormData, existingProfiles: Profile[] = []): Profile {
    const now = new Date().toISOString();
    const id = this.generateProfileId(existingProfiles);
    
    const profile: Profile = {
      id,
      userId: undefined,
      createdAt: now,
      updatedAt: now,
      completionPercentage: this.calculateInitialCompletion(formData),
      status: "draft",
      
      personalInfo: {
        fullName: formData.name,
        gender: formData.gender ? formData.gender.toLowerCase() as 'male' | 'female' | 'other' : '',
        dateOfBirth: formData.dateOfBirth ? formData.dateOfBirth.toISOString().split('T')[0] : '', // YYYY-MM-DD format
        fatherName: formData.fatherName || '',
        motherName: formData.motherName || '',
        nationality: "Indian",
        aadhaarNumber: "",
        otherIdProof: "",
        otherIdProofType: "",
        guardianName: "",
        fatherOccupation: "",
        motherOccupation: "",
        guardianOccupation: "",
        placeOfBirth: "",
        religion: "",
        motherTongue: "",
        maritalStatus: "single",
        bloodGroup: "",
      },
      
      contactInfo: {
        presentAddress: "",
        permanentAddress: "",
        sameAsPresentAddress: true,
        stateOfDomicile: formData.state || '',
        districtOfDomicile: "",
        pinCode: "",
        mobileNumber: formData.phone || '',
        alternateMobileNumber: "",
        emailId: formData.email || '',
        alternateEmailId: "",
        emergencyContactNumber: "",
      },
      
      familyDetails: {
        fatherFullName: formData.fatherName || '',
        fatherDateOfBirth: "",
        fatherEducation: "",
        fatherOccupation: "",
        fatherDesignation: "",
        fatherOrganization: "",
        fatherAnnualIncome: "",
        fatherMobileNumber: "",
        fatherEmailId: "",
        fatherPanNumber: "",
        motherFullName: formData.motherName || '',
        motherDateOfBirth: "",
        motherEducation: "",
        motherOccupation: "",
        motherDesignation: "",
        motherOrganization: "",
        motherAnnualIncome: "",
        motherMobileNumber: "",
        motherEmailId: "",
        motherPanNumber: "",
        guardianFullName: "",
        guardianRelationship: "",
        guardianOccupation: "",
        guardianAnnualIncome: "",
        guardianMobileNumber: "",
        guardianEmailId: "",
        combinedFamilyAnnualIncome: 0,
        incomeCertificateNumber: "",
        incomeCertificateIssuingAuthority: "",
        incomeCertificateDateOfIssue: "",
      },
      
      casteReservation: {
        caste: "",
        category: formData.category ? this.mapCategoryToEnum(formData.category) : 'general',
        minorityStatus: false,
        subCategory: "",
        casteCertificateNumber: "",
        casteIssuingAuthority: "",
        casteDateOfIssue: "",
        casteStateOfIssue: "",
        ewsCertificateNumber: "",
        ewsIssuingAuthority: "",
        ewsDateOfIssue: "",
        pwdStatus: false,
        pwdType: "",
        disabilityPercentage: 0,
        pwdCertificateNumber: "",
      },
      
      educationalDetails: {
        class10Board: "",
        class10SchoolName: "",
        class10SchoolAddress: "",
        class10YearOfPassing: "",
        class10RollNumber: "",
        class10EnrollmentNumber: "",
        class10Percentage: 0,
        class10PassingStatus: "pass",
        class12Board: "",
        class12SchoolName: "",
        class12SchoolAddress: "",
        class12YearOfPassing: "",
        class12RollNumber: "",
        class12EnrollmentNumber: "",
        class12Stream: "science",
        class12Group: "pcm",
        physicsMarks: 0,
        chemistryMarks: 0,
        mathematicsMarks: 0,
        biologyMarks: 0,
        englishMarks: 0,
        optionalSubjectMarks: 0,
        totalMarks: 0,
        class12Percentage: 0,
        mediumOfInstruction: "",
        gapYearDetails: "",
        diplomaDetails: "",
      },
      
      examinationDetails: {},
      
      quotaDetails: {
        homeStateStatus: true,
        domicileCertificateNumber: "",
        domicileIssuingAuthority: "",
        domicileDateOfIssue: "",
        yearsOfResidenceInState: 0,
        defensePersonnelStatus: false,
        defenseCategory: "",
        serviceNumber: "",
        rank: "",
        unitFormation: "",
        defenseIdentityCardNumber: "",
        sportsAchievement: false,
        sportName: "",
        levelOfAchievement: "",
        competitionName: "",
        achievementYear: "",
        certificateAuthority: "",
        nccParticipation: false,
        nccCertificateLevel: "",
        nccUnit: "",
        nccCertificateNumber: "",
        nccCertificateDate: "",
        migrantStatus: false,
        tsunamiAffected: false,
        childrenOfFreedomFighters: false,
        bplStatus: false,
        ruralUrbanArea: "urban",
        managementQuotaInterest: false,
        nriStatus: false,
        nriSponsorDetails: "",
        passportNumber: "",
        visaStatus: "",
      },
      
      credentials: {},
      documents: {},
    };
    
    return profile;
  }
  
  static generateProfileId(existingProfiles: Profile[]): string {
    const currentYear = new Date().getFullYear();
    const nextNumber = (existingProfiles?.length ?? 0) + 1;
    return `PROF-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
  }
  
  static calculateInitialCompletion(formData: ProfileFormData): number {
    // Calculate completion based on filled fields (only name is required)
    const allFields = [
      formData.name,
      formData.email,
      formData.phone,
      formData.dateOfBirth,
      formData.gender,
      formData.fatherName,
      formData.motherName,
      formData.category,
      formData.state
    ];
    
    const filledFields = allFields.filter(field => field && field.toString().trim() !== '').length;
    const totalFields = allFields.length;
    
    // Base completion starts at 10% for having name, can go up to 25% with all form fields
    const baseCompletion = 10; // For having the required name field
    const additionalCompletion = Math.round(((filledFields - 1) / (totalFields - 1)) * 15); // Additional 15% for optional fields
    
    return Math.min(baseCompletion + additionalCompletion, 25);
  }
  
  private static mapCategoryToEnum(category: string): 'general' | 'obc-ncl' | 'sc' | 'st' | 'ews' {
    if (!category) return 'general';
    
    const categoryMap: Record<string, 'general' | 'obc-ncl' | 'sc' | 'st' | 'ews'> = {
      'general': 'general',
      'obc': 'obc-ncl',
      'sc': 'sc',
      'st': 'st',
      'ews': 'ews'
    };
    
    return categoryMap[category.toLowerCase()] || 'general';
  }
}