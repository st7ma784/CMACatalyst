/**
 * Format bytes to human readable string
 */
export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Format date to human readable string
 */
export const formatDate = (date) => {
  if (!date) return '';
  
  const d = new Date(date);
  const now = new Date();
  const diffTime = Math.abs(now - d);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  } else {
    return d.toLocaleDateString();
  }
};

/**
 * Format file name for display
 */
export const formatFileName = (fileName) => {
  if (!fileName) return '';
  
  // Remove UUID prefix if present
  const parts = fileName.split('-');
  if (parts.length > 1 && parts[0].length === 36) {
    return parts.slice(1).join('-');
  }
  
  return fileName;
};

/**
 * Get document type display name
 */
export const getDocumentTypeDisplayName = (type) => {
  const typeMap = {
    'debt': 'Debt Document',
    'bank_statement': 'Bank Statement',
    'internal': 'Internal Document',
    'correspondence': 'Correspondence',
    'legal': 'Legal Document',
    'income': 'Income Document',
    'expenses': 'Expense Document',
    'assets': 'Asset Document',
    'unknown': 'Unclassified',
    'general': 'General Document'
  };
  
  return typeMap[type] || type;
};

/**
 * Get file extension from filename
 */
export const getFileExtension = (fileName) => {
  return fileName.split('.').pop().toLowerCase();
};

/**
 * Check if file is an image
 */
export const isImageFile = (fileName) => {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
  return imageExtensions.includes(getFileExtension(fileName));
};

/**
 * Check if file is a PDF
 */
export const isPdfFile = (fileName) => {
  return getFileExtension(fileName) === 'pdf';
};

/**
 * Check if file is a document
 */
export const isDocumentFile = (fileName) => {
  const docExtensions = ['doc', 'docx', 'txt', 'rtf', 'odt'];
  return docExtensions.includes(getFileExtension(fileName));
};

/**
 * Check if file is a spreadsheet
 */
export const isSpreadsheetFile = (fileName) => {
  const spreadsheetExtensions = ['xls', 'xlsx', 'csv', 'ods'];
  return spreadsheetExtensions.includes(getFileExtension(fileName));
};
