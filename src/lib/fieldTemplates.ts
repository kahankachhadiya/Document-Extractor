// Form Master Pro - Field Templates for Dynamic Form Generation
// Comprehensive field definitions for Indian entrance exam applications

import { FieldTemplate, FieldCategory } from '@/types/profile';

// Indian States for dropdown options
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Lakshadweep', 'Puducherry', 'Andaman and Nicobar Islands'
];

// Educational Boards
export const EDUCATIONAL_BOARDS = [
  'CBSE', 'ICSE', 'ISC', 'NIOS', 'Gujarat State Board (GSEB)', 'Maharashtra State Board',
  'Rajasthan Board (RBSE)', 'UP Board (UPMSP)', 'Karnataka State Board (KSEEB)',
  'Tamil Nadu State Board', 'West Bengal Board (WBBSE)', 'Bihar Board (BSEB)',
  'Madhya Pradesh Board (MPBSE)', 'Haryana Board (HBSE)', 'Punjab Board (PSEB)',
  'Assam Board (AHSEC)', 'Kerala Board (DHSE)', 'Andhra Pradesh Board',
  'Telangana Board', 'Odisha Board (CHSE)', 'Jharkhand Board (JAC)',
  'Chhattisgarh Board', 'Uttarakhand Board', 'Himachal Pradesh Board',
  'Jammu and Kashmir Board', 'Goa Board', 'Tripura Board', 'Manipur Board',
  'Meghalaya Board', 'Mizoram Board', 'Nagaland Board', 'Sikkim Board',
  'Arunachal Pradesh Board', 'Other'
];

// Income Slabs (in INR per annum)
export const INCOME_SLABS = [
  'Below 1 Lakh', '1-2 Lakhs', '2-3 Lakhs', '3-4 Lakhs', '4-5 Lakhs',
  '5-6 Lakhs', '6-8 Lakhs', '8-10 Lakhs', '10-15 Lakhs', '15-20 Lakhs',
  '20-25 Lakhs', '25-50 Lakhs', 'Above 50 Lakhs'
];

// Occupation Categories
export const OCCUPATION_CATEGORIES = [
  'Government Service', 'Private Service', 'Business/Self Employed',
  'Farmer/Agriculture', 'Professional (Doctor/Engineer/Lawyer)',
  'Teacher/Professor', 'Retired', 'Homemaker', 'Daily Wage Worker',
  'Skilled Worker', 'Unskilled Worker', 'Other'
];

// Field Templates organized by category
export const FIELD_TEMPLATES: Record<FieldCategory, FieldTemplate[]> = {
  personal: [
    {
      id: 'personal_full_name',
      category: 'personal',
      fieldName: 'fullName',
      displayLabel: 'Full Name (as per Aadhaar/10th Certificate)',
      fieldType: 'text',
      isRequired: true,
      validationRules: { minLength: 2, maxLength: 100 },
      displayOrder: 1,
      isActive: true,
      placeholder: 'Enter full name exactly as in official documents',
      helpText: 'Name should match your Aadhaar card or Class 10 certificate'
    },
    {
      id: 'personal_gender',
      category: 'personal',
      fieldName: 'gender',
      displayLabel: 'Gender',
      fieldType: 'dropdown',
      isRequired: true,
      dropdownOptions: ['Male', 'Female', 'Other'],
      displayOrder: 2,
      isActive: true
    },
    {
      id: 'personal_date_of_birth',
      category: 'personal',
      fieldName: 'dateOfBirth',
      displayLabel: 'Date of Birth',
      fieldType: 'date',
      isRequired: true,
      displayOrder: 3,
      isActive: true,
      helpText: 'Date should match your official documents'
    },
    {
      id: 'personal_aadhaar_number',
      category: 'personal',
      fieldName: 'aadhaarNumber',
      displayLabel: 'Aadhaar Number',
      fieldType: 'text',
      isRequired: false,
      validationRules: { pattern: '^[0-9]{12}$' },
      displayOrder: 4,
      isActive: true,
      placeholder: '123456789012',
      helpText: '12-digit Aadhaar number (optional but recommended)'
    },
    {
      id: 'personal_father_name',
      category: 'personal',
      fieldName: 'fatherName',
      displayLabel: "Father's Name",
      fieldType: 'text',
      isRequired: true,
      validationRules: { minLength: 2, maxLength: 100 },
      displayOrder: 5,
      isActive: true,
      placeholder: "Enter father's full name"
    },
    {
      id: 'personal_mother_name',
      category: 'personal',
      fieldName: 'motherName',
      displayLabel: "Mother's Name",
      fieldType: 'text',
      isRequired: true,
      validationRules: { minLength: 2, maxLength: 100 },
      displayOrder: 6,
      isActive: true,
      placeholder: "Enter mother's full name"
    },
    {
      id: 'personal_guardian_name',
      category: 'personal',
      fieldName: 'guardianName',
      displayLabel: "Guardian's Name (if applicable)",
      fieldType: 'text',
      isRequired: false,
      validationRules: { maxLength: 100 },
      displayOrder: 7,
      isActive: true,
      placeholder: "Enter guardian's name if applicable"
    },
    {
      id: 'personal_nationality',
      category: 'personal',
      fieldName: 'nationality',
      displayLabel: 'Nationality',
      fieldType: 'dropdown',
      isRequired: true,
      dropdownOptions: ['Indian', 'Other'],
      displayOrder: 8,
      isActive: true
    },
    {
      id: 'personal_place_of_birth',
      category: 'personal',
      fieldName: 'placeOfBirth',
      displayLabel: 'Place of Birth',
      fieldType: 'text',
      isRequired: false,
      validationRules: { maxLength: 100 },
      displayOrder: 9,
      isActive: true,
      placeholder: 'City, State'
    },
    {
      id: 'personal_religion',
      category: 'personal',
      fieldName: 'religion',
      displayLabel: 'Religion',
      fieldType: 'dropdown',
      isRequired: false,
      dropdownOptions: ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Buddhist', 'Parsi', 'Other'],
      displayOrder: 10,
      isActive: true
    },
    {
      id: 'personal_mother_tongue',
      category: 'personal',
      fieldName: 'motherTongue',
      displayLabel: 'Mother Tongue',
      fieldType: 'dropdown',
      isRequired: false,
      dropdownOptions: [
        'Hindi', 'English', 'Bengali', 'Telugu', 'Marathi', 'Tamil', 'Urdu',
        'Gujarati', 'Kannada', 'Malayalam', 'Odia', 'Punjabi', 'Assamese',
        'Maithili', 'Sanskrit', 'Nepali', 'Konkani', 'Sindhi', 'Dogri',
        'Manipuri', 'Bodo', 'Santhali', 'Other'
      ],
      displayOrder: 11,
      isActive: true
    },
    {
      id: 'personal_blood_group',
      category: 'personal',
      fieldName: 'bloodGroup',
      displayLabel: 'Blood Group',
      fieldType: 'dropdown',
      isRequired: false,
      dropdownOptions: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      displayOrder: 12,
      isActive: true
    }
  ],

  contact: [
    {
      id: 'contact_mobile_number',
      category: 'contact',
      fieldName: 'mobileNumber',
      displayLabel: 'Mobile Number',
      fieldType: 'tel',
      isRequired: true,
      validationRules: { pattern: '^[6-9][0-9]{9}$' },
      displayOrder: 1,
      isActive: true,
      placeholder: '9876543210',
      helpText: 'Indian mobile number starting with 6, 7, 8, or 9'
    },
    {
      id: 'contact_alternate_mobile',
      category: 'contact',
      fieldName: 'alternateMobileNumber',
      displayLabel: 'Alternate Mobile Number',
      fieldType: 'tel',
      isRequired: false,
      validationRules: { pattern: '^[6-9][0-9]{9}$' },
      displayOrder: 2,
      isActive: true,
      placeholder: '9876543210'
    },
    {
      id: 'contact_email_id',
      category: 'contact',
      fieldName: 'emailId',
      displayLabel: 'Email ID',
      fieldType: 'email',
      isRequired: true,
      validationRules: { maxLength: 255 },
      displayOrder: 3,
      isActive: true,
      placeholder: 'student@email.com',
      helpText: 'Primary email for all communications'
    },
    {
      id: 'contact_alternate_email',
      category: 'contact',
      fieldName: 'alternateEmailId',
      displayLabel: 'Alternate Email ID',
      fieldType: 'email',
      isRequired: false,
      validationRules: { maxLength: 255 },
      displayOrder: 4,
      isActive: true,
      placeholder: 'alternate@email.com'
    },
    {
      id: 'contact_present_address',
      category: 'contact',
      fieldName: 'presentAddress',
      displayLabel: 'Present Address',
      fieldType: 'textarea',
      isRequired: true,
      validationRules: { minLength: 10, maxLength: 500 },
      displayOrder: 5,
      isActive: true,
      placeholder: 'House No., Street, Area, City, State, PIN Code',
      helpText: 'Complete current residential address'
    },
    {
      id: 'contact_permanent_address',
      category: 'contact',
      fieldName: 'permanentAddress',
      displayLabel: 'Permanent Address',
      fieldType: 'textarea',
      isRequired: true,
      validationRules: { minLength: 10, maxLength: 500 },
      displayOrder: 6,
      isActive: true,
      placeholder: 'House No., Street, Area, City, State, PIN Code'
    },
    {
      id: 'contact_state_of_domicile',
      category: 'contact',
      fieldName: 'stateOfDomicile',
      displayLabel: 'State of Domicile',
      fieldType: 'dropdown',
      isRequired: true,
      dropdownOptions: INDIAN_STATES,
      displayOrder: 7,
      isActive: true,
      helpText: 'State where you have domicile certificate'
    },
    {
      id: 'contact_pin_code',
      category: 'contact',
      fieldName: 'pinCode',
      displayLabel: 'PIN Code',
      fieldType: 'text',
      isRequired: true,
      validationRules: { pattern: '^[0-9]{6}$' },
      displayOrder: 8,
      isActive: true,
      placeholder: '123456',
      helpText: '6-digit postal PIN code'
    }
  ],

  family: [
    {
      id: 'family_father_full_name',
      category: 'family',
      fieldName: 'fatherFullName',
      displayLabel: "Father's Full Name",
      fieldType: 'text',
      isRequired: true,
      validationRules: { minLength: 2, maxLength: 100 },
      displayOrder: 1,
      isActive: true,
      placeholder: "Enter father's complete name"
    },
    {
      id: 'family_father_occupation',
      category: 'family',
      fieldName: 'fatherOccupation',
      displayLabel: "Father's Occupation",
      fieldType: 'dropdown',
      isRequired: false,
      dropdownOptions: OCCUPATION_CATEGORIES,
      displayOrder: 2,
      isActive: true
    },
    {
      id: 'family_father_annual_income',
      category: 'family',
      fieldName: 'fatherAnnualIncome',
      displayLabel: "Father's Annual Income",
      fieldType: 'dropdown',
      isRequired: false,
      dropdownOptions: INCOME_SLABS,
      displayOrder: 3,
      isActive: true
    },
    {
      id: 'family_father_mobile',
      category: 'family',
      fieldName: 'fatherMobileNumber',
      displayLabel: "Father's Mobile Number",
      fieldType: 'tel',
      isRequired: false,
      validationRules: { pattern: '^[6-9][0-9]{9}$' },
      displayOrder: 4,
      isActive: true,
      placeholder: '9876543210'
    },
    {
      id: 'family_mother_full_name',
      category: 'family',
      fieldName: 'motherFullName',
      displayLabel: "Mother's Full Name",
      fieldType: 'text',
      isRequired: true,
      validationRules: { minLength: 2, maxLength: 100 },
      displayOrder: 5,
      isActive: true,
      placeholder: "Enter mother's complete name"
    },
    {
      id: 'family_mother_occupation',
      category: 'family',
      fieldName: 'motherOccupation',
      displayLabel: "Mother's Occupation",
      fieldType: 'dropdown',
      isRequired: false,
      dropdownOptions: OCCUPATION_CATEGORIES,
      displayOrder: 6,
      isActive: true
    },
    {
      id: 'family_mother_annual_income',
      category: 'family',
      fieldName: 'motherAnnualIncome',
      displayLabel: "Mother's Annual Income",
      fieldType: 'dropdown',
      isRequired: false,
      dropdownOptions: INCOME_SLABS,
      displayOrder: 7,
      isActive: true
    },
    {
      id: 'family_mother_mobile',
      category: 'family',
      fieldName: 'motherMobileNumber',
      displayLabel: "Mother's Mobile Number",
      fieldType: 'tel',
      isRequired: false,
      validationRules: { pattern: '^[6-9][0-9]{9}$' },
      displayOrder: 8,
      isActive: true,
      placeholder: '9876543210'
    },
    {
      id: 'family_combined_income',
      category: 'family',
      fieldName: 'combinedFamilyAnnualIncome',
      displayLabel: 'Combined Family Annual Income',
      fieldType: 'number',
      isRequired: false,
      validationRules: { min: 0, max: 10000000 },
      displayOrder: 9,
      isActive: true,
      placeholder: 'Enter amount in INR',
      helpText: 'Total family income from all sources'
    }
  ],

  caste: [
    {
      id: 'caste_category',
      category: 'caste',
      fieldName: 'category',
      displayLabel: 'Category',
      fieldType: 'dropdown',
      isRequired: true,
      dropdownOptions: ['General', 'OBC-NCL', 'SC', 'ST', 'EWS'],
      displayOrder: 1,
      isActive: true,
      helpText: 'Select your reservation category'
    },
    {
      id: 'caste_name',
      category: 'caste',
      fieldName: 'caste',
      displayLabel: 'Caste',
      fieldType: 'text',
      isRequired: false,
      validationRules: { maxLength: 100 },
      displayOrder: 2,
      isActive: true,
      placeholder: 'Enter caste name'
    },
    {
      id: 'caste_certificate_number',
      category: 'caste',
      fieldName: 'casteCertificateNumber',
      displayLabel: 'Caste Certificate Number',
      fieldType: 'text',
      isRequired: false,
      validationRules: { maxLength: 50 },
      displayOrder: 3,
      isActive: true,
      placeholder: 'Certificate number'
    },
    {
      id: 'caste_issuing_authority',
      category: 'caste',
      fieldName: 'casteIssuingAuthority',
      displayLabel: 'Issuing Authority',
      fieldType: 'text',
      isRequired: false,
      validationRules: { maxLength: 100 },
      displayOrder: 4,
      isActive: true,
      placeholder: 'Authority that issued the certificate'
    },
    {
      id: 'caste_date_of_issue',
      category: 'caste',
      fieldName: 'casteDateOfIssue',
      displayLabel: 'Date of Issue',
      fieldType: 'date',
      isRequired: false,
      displayOrder: 5,
      isActive: true
    },
    {
      id: 'caste_pwd_status',
      category: 'caste',
      fieldName: 'pwdStatus',
      displayLabel: 'Person with Disability (PwD) Status',
      fieldType: 'checkbox',
      isRequired: false,
      displayOrder: 6,
      isActive: true,
      helpText: 'Check if you have a disability certificate'
    },
    {
      id: 'caste_disability_percentage',
      category: 'caste',
      fieldName: 'disabilityPercentage',
      displayLabel: 'Disability Percentage',
      fieldType: 'number',
      isRequired: false,
      validationRules: { min: 0, max: 100 },
      displayOrder: 7,
      isActive: true,
      placeholder: 'Percentage as per certificate'
    }
  ],

  education: [
    {
      id: 'education_class10_board',
      category: 'education',
      fieldName: 'class10Board',
      displayLabel: 'Class 10 Board',
      fieldType: 'dropdown',
      isRequired: true,
      dropdownOptions: EDUCATIONAL_BOARDS,
      displayOrder: 1,
      isActive: true
    },
    {
      id: 'education_class10_school',
      category: 'education',
      fieldName: 'class10SchoolName',
      displayLabel: 'Class 10 School Name',
      fieldType: 'text',
      isRequired: true,
      validationRules: { minLength: 2, maxLength: 200 },
      displayOrder: 2,
      isActive: true,
      placeholder: 'Enter school name'
    },
    {
      id: 'education_class10_year',
      category: 'education',
      fieldName: 'class10YearOfPassing',
      displayLabel: 'Class 10 Year of Passing',
      fieldType: 'dropdown',
      isRequired: true,
      dropdownOptions: Array.from({ length: 11 }, (_, i) => (2024 - i).toString()),
      displayOrder: 3,
      isActive: true
    },
    {
      id: 'education_class10_percentage',
      category: 'education',
      fieldName: 'class10Percentage',
      displayLabel: 'Class 10 Percentage',
      fieldType: 'number',
      isRequired: false,
      validationRules: { min: 0, max: 100 },
      displayOrder: 4,
      isActive: true,
      placeholder: 'Enter percentage'
    },
    {
      id: 'education_class12_board',
      category: 'education',
      fieldName: 'class12Board',
      displayLabel: 'Class 12 Board',
      fieldType: 'dropdown',
      isRequired: true,
      dropdownOptions: EDUCATIONAL_BOARDS,
      displayOrder: 5,
      isActive: true
    },
    {
      id: 'education_class12_school',
      category: 'education',
      fieldName: 'class12SchoolName',
      displayLabel: 'Class 12 School Name',
      fieldType: 'text',
      isRequired: true,
      validationRules: { minLength: 2, maxLength: 200 },
      displayOrder: 6,
      isActive: true,
      placeholder: 'Enter school name'
    },
    {
      id: 'education_class12_year',
      category: 'education',
      fieldName: 'class12YearOfPassing',
      displayLabel: 'Class 12 Year of Passing/Appearing',
      fieldType: 'dropdown',
      isRequired: true,
      dropdownOptions: Array.from({ length: 6 }, (_, i) => (2025 - i).toString()),
      displayOrder: 7,
      isActive: true
    },
    {
      id: 'education_class12_stream',
      category: 'education',
      fieldName: 'class12Stream',
      displayLabel: 'Class 12 Stream',
      fieldType: 'dropdown',
      isRequired: true,
      dropdownOptions: ['Science', 'Commerce', 'Arts'],
      displayOrder: 8,
      isActive: true
    },
    {
      id: 'education_class12_group',
      category: 'education',
      fieldName: 'class12Group',
      displayLabel: 'Class 12 Group/Combination',
      fieldType: 'dropdown',
      isRequired: false,
      dropdownOptions: ['PCM (Physics, Chemistry, Mathematics)', 'PCB (Physics, Chemistry, Biology)', 'PCMB (Physics, Chemistry, Mathematics, Biology)', 'Other'],
      displayOrder: 9,
      isActive: true
    },
    {
      id: 'education_class12_percentage',
      category: 'education',
      fieldName: 'class12Percentage',
      displayLabel: 'Class 12 Percentage',
      fieldType: 'number',
      isRequired: false,
      validationRules: { min: 0, max: 100 },
      displayOrder: 10,
      isActive: true,
      placeholder: 'Enter percentage'
    },
    {
      id: 'education_physics_marks',
      category: 'education',
      fieldName: 'physicsMarks',
      displayLabel: 'Physics Marks',
      fieldType: 'number',
      isRequired: false,
      validationRules: { min: 0, max: 100 },
      displayOrder: 11,
      isActive: true,
      placeholder: 'Marks obtained'
    },
    {
      id: 'education_chemistry_marks',
      category: 'education',
      fieldName: 'chemistryMarks',
      displayLabel: 'Chemistry Marks',
      fieldType: 'number',
      isRequired: false,
      validationRules: { min: 0, max: 100 },
      displayOrder: 12,
      isActive: true,
      placeholder: 'Marks obtained'
    },
    {
      id: 'education_mathematics_marks',
      category: 'education',
      fieldName: 'mathematicsMarks',
      displayLabel: 'Mathematics Marks',
      fieldType: 'number',
      isRequired: false,
      validationRules: { min: 0, max: 100 },
      displayOrder: 13,
      isActive: true,
      placeholder: 'Marks obtained'
    }
  ],

  examination: [
    {
      id: 'exam_jee_main_application',
      category: 'examination',
      fieldName: 'jeeMainApplicationNumber',
      displayLabel: 'JEE Main Application Number',
      fieldType: 'text',
      isRequired: false,
      validationRules: { maxLength: 20 },
      displayOrder: 1,
      isActive: true,
      placeholder: 'JEE Main application number'
    },
    {
      id: 'exam_jee_main_roll',
      category: 'examination',
      fieldName: 'jeeMainRollNumber',
      displayLabel: 'JEE Main Roll Number',
      fieldType: 'text',
      isRequired: false,
      validationRules: { maxLength: 20 },
      displayOrder: 2,
      isActive: true,
      placeholder: 'JEE Main roll number'
    },
    {
      id: 'exam_jee_main_score',
      category: 'examination',
      fieldName: 'jeeMainScore',
      displayLabel: 'JEE Main Score',
      fieldType: 'number',
      isRequired: false,
      validationRules: { min: 0, max: 300 },
      displayOrder: 3,
      isActive: true,
      placeholder: 'Score out of 300'
    },
    {
      id: 'exam_jee_main_percentile',
      category: 'examination',
      fieldName: 'jeeMainPercentile',
      displayLabel: 'JEE Main Percentile',
      fieldType: 'number',
      isRequired: false,
      validationRules: { min: 0, max: 100 },
      displayOrder: 4,
      isActive: true,
      placeholder: 'Percentile score'
    },
    {
      id: 'exam_neet_application',
      category: 'examination',
      fieldName: 'neetApplicationNumber',
      displayLabel: 'NEET Application Number',
      fieldType: 'text',
      isRequired: false,
      validationRules: { maxLength: 20 },
      displayOrder: 5,
      isActive: true,
      placeholder: 'NEET application number'
    },
    {
      id: 'exam_neet_roll',
      category: 'examination',
      fieldName: 'neetRollNumber',
      displayLabel: 'NEET Roll Number',
      fieldType: 'text',
      isRequired: false,
      validationRules: { maxLength: 20 },
      displayOrder: 6,
      isActive: true,
      placeholder: 'NEET roll number'
    },
    {
      id: 'exam_neet_score',
      category: 'examination',
      fieldName: 'neetScore',
      displayLabel: 'NEET Score',
      fieldType: 'number',
      isRequired: false,
      validationRules: { min: 0, max: 720 },
      displayOrder: 7,
      isActive: true,
      placeholder: 'Score out of 720'
    },
    {
      id: 'exam_neet_air',
      category: 'examination',
      fieldName: 'neetAllIndiaRank',
      displayLabel: 'NEET All India Rank',
      fieldType: 'number',
      isRequired: false,
      validationRules: { min: 1 },
      displayOrder: 8,
      isActive: true,
      placeholder: 'All India Rank'
    }
  ],

  quota: [
    {
      id: 'quota_home_state',
      category: 'quota',
      fieldName: 'homeStateStatus',
      displayLabel: 'Home State Quota Eligible',
      fieldType: 'checkbox',
      isRequired: false,
      displayOrder: 1,
      isActive: true,
      helpText: 'Check if eligible for home state quota'
    },
    {
      id: 'quota_domicile_certificate',
      category: 'quota',
      fieldName: 'domicileCertificateNumber',
      displayLabel: 'Domicile Certificate Number',
      fieldType: 'text',
      isRequired: false,
      validationRules: { maxLength: 50 },
      displayOrder: 2,
      isActive: true,
      placeholder: 'Certificate number'
    },
    {
      id: 'quota_defense_personnel',
      category: 'quota',
      fieldName: 'defensePersonnelStatus',
      displayLabel: 'Defense Personnel Quota',
      fieldType: 'checkbox',
      isRequired: false,
      displayOrder: 3,
      isActive: true,
      helpText: 'Check if eligible for defense quota'
    },
    {
      id: 'quota_sports_achievement',
      category: 'quota',
      fieldName: 'sportsAchievement',
      displayLabel: 'Sports Quota Eligible',
      fieldType: 'checkbox',
      isRequired: false,
      displayOrder: 4,
      isActive: true,
      helpText: 'Check if you have sports achievements'
    },
    {
      id: 'quota_ncc_participation',
      category: 'quota',
      fieldName: 'nccParticipation',
      displayLabel: 'NCC Participation',
      fieldType: 'checkbox',
      isRequired: false,
      displayOrder: 5,
      isActive: true,
      helpText: 'Check if you have NCC certificate'
    }
  ],

  credentials: [
    {
      id: 'cred_jee_main_username',
      category: 'credentials',
      fieldName: 'jeeMainUsername',
      displayLabel: 'JEE Main Portal Username',
      fieldType: 'text',
      isRequired: false,
      validationRules: { maxLength: 50 },
      displayOrder: 1,
      isActive: true,
      placeholder: 'Username for JEE Main portal'
    },
    {
      id: 'cred_neet_username',
      category: 'credentials',
      fieldName: 'neetUsername',
      displayLabel: 'NEET Portal Username',
      fieldType: 'text',
      isRequired: false,
      validationRules: { maxLength: 50 },
      displayOrder: 2,
      isActive: true,
      placeholder: 'Username for NEET portal'
    },
    {
      id: 'cred_jee_main_status',
      category: 'credentials',
      fieldName: 'jeeMainApplicationStatus',
      displayLabel: 'JEE Main Application Status',
      fieldType: 'dropdown',
      isRequired: false,
      dropdownOptions: ['Not Started', 'In Progress', 'Submitted', 'Payment Pending', 'Complete'],
      displayOrder: 3,
      isActive: true
    },
    {
      id: 'cred_neet_status',
      category: 'credentials',
      fieldName: 'neetApplicationStatus',
      displayLabel: 'NEET Application Status',
      fieldType: 'dropdown',
      isRequired: false,
      dropdownOptions: ['Not Started', 'In Progress', 'Submitted', 'Payment Pending', 'Complete'],
      displayOrder: 4,
      isActive: true
    }
  ],

  documents: [
    {
      id: 'doc_passport_photo',
      category: 'documents',
      fieldName: 'passportSizePhotographPath',
      displayLabel: 'Passport Size Photograph',
      fieldType: 'file',
      isRequired: false,
      displayOrder: 1,
      isActive: true,
      helpText: 'Recent passport size photograph (JPG/PNG, max 200KB)'
    },
    {
      id: 'doc_signature',
      category: 'documents',
      fieldName: 'signatureImagePath',
      displayLabel: 'Signature Image',
      fieldType: 'file',
      isRequired: false,
      displayOrder: 2,
      isActive: true,
      helpText: 'Scanned signature image (JPG/PNG, max 100KB)'
    },
    {
      id: 'doc_class10_certificate',
      category: 'documents',
      fieldName: 'class10CertificatePath',
      displayLabel: 'Class 10 Certificate',
      fieldType: 'file',
      isRequired: false,
      displayOrder: 3,
      isActive: true,
      helpText: 'Class 10 passing certificate (PDF/JPG, max 2MB)'
    },
    {
      id: 'doc_class10_marksheet',
      category: 'documents',
      fieldName: 'class10MarksheetPath',
      displayLabel: 'Class 10 Marksheet',
      fieldType: 'file',
      isRequired: false,
      displayOrder: 4,
      isActive: true,
      helpText: 'Class 10 detailed marksheet (PDF/JPG, max 2MB)'
    },
    {
      id: 'doc_class12_certificate',
      category: 'documents',
      fieldName: 'class12CertificatePath',
      displayLabel: 'Class 12 Certificate',
      fieldType: 'file',
      isRequired: false,
      displayOrder: 5,
      isActive: true,
      helpText: 'Class 12 passing certificate (PDF/JPG, max 2MB)'
    },
    {
      id: 'doc_class12_marksheet',
      category: 'documents',
      fieldName: 'class12MarksheetPath',
      displayLabel: 'Class 12 Marksheet',
      fieldType: 'file',
      isRequired: false,
      displayOrder: 6,
      isActive: true,
      helpText: 'Class 12 detailed marksheet (PDF/JPG, max 2MB)'
    },
    {
      id: 'doc_caste_certificate',
      category: 'documents',
      fieldName: 'casteCertificatePath',
      displayLabel: 'Caste Certificate',
      fieldType: 'file',
      isRequired: false,
      displayOrder: 7,
      isActive: true,
      helpText: 'Valid caste certificate (PDF/JPG, max 2MB)'
    },
    {
      id: 'doc_income_certificate',
      category: 'documents',
      fieldName: 'incomeCertificatePath',
      displayLabel: 'Income Certificate',
      fieldType: 'file',
      isRequired: false,
      displayOrder: 8,
      isActive: true,
      helpText: 'Family income certificate (PDF/JPG, max 2MB)'
    },
    {
      id: 'doc_domicile_certificate',
      category: 'documents',
      fieldName: 'domicileCertificatePath',
      displayLabel: 'Domicile Certificate',
      fieldType: 'file',
      isRequired: false,
      displayOrder: 9,
      isActive: true,
      helpText: 'State domicile certificate (PDF/JPG, max 2MB)'
    }
  ]
};

// Helper function to get fields by category
export const getFieldsByCategory = (category: FieldCategory): FieldTemplate[] => {
  return FIELD_TEMPLATES[category] || [];
};

// Helper function to get all field templates
export const getAllFieldTemplates = (): FieldTemplate[] => {
  return Object.values(FIELD_TEMPLATES).flat();
};

// Helper function to get field template by ID
export const getFieldTemplateById = (id: string): FieldTemplate | undefined => {
  return getAllFieldTemplates().find(template => template.id === id);
};

// Category metadata for UI organization
export const CATEGORY_METADATA = {
  personal: {
    title: 'Personal Information',
    description: 'Basic personal details and family information',
    icon: 'User',
    color: 'primary'
  },
  contact: {
    title: 'Contact Information',
    description: 'Address and communication details',
    icon: 'MapPin',
    color: 'accent'
  },
  family: {
    title: 'Family Details',
    description: 'Parent and guardian information',
    icon: 'Users',
    color: 'success'
  },
  caste: {
    title: 'Caste & Reservation',
    description: 'Category and certificate details',
    icon: 'Shield',
    color: 'warning'
  },
  education: {
    title: 'Educational Details',
    description: 'Academic qualifications and marks',
    icon: 'GraduationCap',
    color: 'primary'
  },
  examination: {
    title: 'Examination Details',
    description: 'Entrance exam scores and ranks',
    icon: 'Trophy',
    color: 'accent'
  },
  quota: {
    title: 'Quota & Special Categories',
    description: 'Special quota eligibility',
    icon: 'Star',
    color: 'success'
  },
  credentials: {
    title: 'Portal Credentials',
    description: 'Exam portal login details',
    icon: 'Key',
    color: 'warning'
  },
  documents: {
    title: 'Document Management',
    description: 'Upload and manage certificates',
    icon: 'FileText',
    color: 'primary'
  }
};