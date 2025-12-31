/**
 * Utility functions for search functionality
 * 
 * Search Logic:
 * - Names: Only matches if query starts with the beginning of any name part
 * - Example: "john" matches "John Doe" but "ohn" does not
 * - Example: "kahan" does NOT match "John Sharma" 
 * - IDs, emails, phones: Can match anywhere in the string
 */

export interface SearchMatch {
  text: string;
  isMatch: boolean;
}

/**
 * Highlights matching text in a string based on search query
 * Only highlights if the match starts at word boundaries
 * @param text - The text to search in
 * @param query - The search query
 * @returns Array of text segments with match indicators
 */
export function highlightMatches(text: string, query: string): SearchMatch[] {
  if (!query.trim() || !text) {
    return [{ text, isMatch: false }];
  }

  const normalizedQuery = query.toLowerCase().trim();
  
  // Split text into words and find matches that start at word boundaries
  const words = text.split(' ');
  const segments: SearchMatch[] = [];
  
  words.forEach((word, index) => {
    const normalizedWord = word.toLowerCase();
    const isMatch = normalizedWord.startsWith(normalizedQuery);
    
    if (index > 0) {
      segments.push({ text: ' ', isMatch: false });
    }
    
    if (isMatch && normalizedQuery.length <= normalizedWord.length) {
      // Highlight the matching part
      segments.push({
        text: word.substring(0, normalizedQuery.length),
        isMatch: true
      });
      
      // Add the non-matching part of the word
      if (normalizedQuery.length < word.length) {
        segments.push({
          text: word.substring(normalizedQuery.length),
          isMatch: false
        });
      }
    } else {
      segments.push({
        text: word,
        isMatch: false
      });
    }
  });

  return segments;
}

/**
 * Checks if a profile matches the search query
 * @param profile - The profile to check
 * @param query - The search query
 * @returns boolean indicating if profile matches
 */
export function matchesSearchQuery(profile: any, query: string): boolean {
  if (!query.trim()) return true;

  const normalizedQuery = query.toLowerCase().trim();
  const fullName = profile.personalInfo?.fullName || "";
  const email = profile.contactInfo?.emailId || "";
  const phone = profile.contactInfo?.mobileNumber || "";
  const profileId = profile.id || "";

  // Split full name into parts for partial matching
  const nameParts = fullName.toLowerCase().split(' ').filter(part => part.length > 0);
  const queryParts = normalizedQuery.split(' ').filter(part => part.length > 0);
  
  // Check if query matches:
  // 1. Single query: Any name part STARTS WITH the query (exact spelling match from beginning)
  const matchesNameStart = queryParts.length === 1 && 
    nameParts.some(part => part.startsWith(normalizedQuery));
  
  // 2. Multiple query parts: Each query part must start with a different name part
  const matchesMultipleNameParts = queryParts.length > 1 && 
    queryParts.every(queryPart => 
      nameParts.some(namePart => namePart.startsWith(queryPart))
    );
  
  // 3. Profile ID (case insensitive, can be partial)
  const matchesId = profileId.toLowerCase().includes(normalizedQuery);
  
  // 4. Phone number (only if query contains digits)
  const queryDigits = normalizedQuery.replace(/\D/g, '');
  const matchesPhone = queryDigits.length > 0 && phone.replace(/\D/g, '').includes(queryDigits);
  
  // 5. Email (only if query looks like email or domain)
  const matchesEmail = (normalizedQuery.includes('@') || normalizedQuery.includes('.')) && 
    email.toLowerCase().includes(normalizedQuery);

  return matchesNameStart || matchesMultipleNameParts || matchesId || matchesPhone || matchesEmail;
}

/**
 * Gets the primary field that matches the search query for display purposes
 * @param profile - The profile to check
 * @param query - The search query
 * @returns string indicating which field matched
 */
export function getPrimaryMatchField(profile: any, query: string): string {
  if (!query.trim()) return '';

  const normalizedQuery = query.toLowerCase().trim();
  const fullName = profile.personalInfo?.fullName || "";
  const email = profile.contactInfo?.emailId || "";
  const phone = profile.contactInfo?.mobileNumber || "";
  const profileId = profile.id || "";

  // Check name parts for starts-with match
  const nameParts = fullName.toLowerCase().split(' ').filter(part => part.length > 0);
  if (nameParts.some(part => part.startsWith(normalizedQuery))) return 'name';
  
  if (profileId.toLowerCase().includes(normalizedQuery)) return 'id';
  if (phone.replace(/\D/g, '').includes(normalizedQuery.replace(/\D/g, ''))) return 'phone';
  if (email.toLowerCase().includes(normalizedQuery)) return 'email';

  return 'name'; // Default to name
}