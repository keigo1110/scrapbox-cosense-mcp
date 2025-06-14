import { listPages } from '../../cosense.js';
import { formatPageOutput, formatYmd } from '../../utils/format.js';

export interface SearchWithDateFilterParams {
  from?: string; // ISO date string
  to?: string;   // ISO date string
  searchType?: 'created' | 'updated'; // Default to 'updated'
}

export async function handleSearchWithDateFilter(
  projectName: string,
  cosenseSid: string | undefined,
  params: SearchWithDateFilterParams
) {
  try {
    const searchType = params.searchType || 'updated';
    
    // Parse dates
    const fromDate = params.from ? new Date(params.from) : null;
    const toDate = params.to ? new Date(params.to) : null;
    
    if (fromDate && isNaN(fromDate.getTime())) {
      return {
        content: [{
          type: "text",
          text: 'Error: Invalid "from" date format. Please use ISO date format (YYYY-MM-DD)'
        }],
        isError: true
      };
    }
    
    if (toDate && isNaN(toDate.getTime())) {
      return {
        content: [{
          type: "text",
          text: 'Error: Invalid "to" date format. Please use ISO date format (YYYY-MM-DD)'
        }],
        isError: true
      };
    }

    // Fetch all pages (with a reasonable limit)
    const response = await listPages(projectName, cosenseSid, {
      limit: 1000,
      skip: 0,
      sort: searchType // Sort by the field we're filtering on
    });

    // Filter pages by date range
    const filteredPages = response.pages.filter(page => {
      const timestamp = searchType === 'created' ? page.created : page.updated;
      
      if (!timestamp) return false;
      
      const pageDate = new Date(timestamp * 1000); // Convert Unix timestamp to Date
      
      if (fromDate && toDate) {
        return pageDate >= fromDate && pageDate <= toDate;
      } else if (fromDate) {
        return pageDate >= fromDate;
      } else if (toDate) {
        return pageDate <= toDate;
      } else {
        return true; // No date filter applied
      }
    });

    if (filteredPages.length === 0) {
      let dateRangeText = '';
      if (fromDate && toDate) {
        dateRangeText = `between ${fromDate.toLocaleDateString()} and ${toDate.toLocaleDateString()}`;
      } else if (fromDate) {
        dateRangeText = `after ${fromDate.toLocaleDateString()}`;
      } else if (toDate) {
        dateRangeText = `before ${toDate.toLocaleDateString()}`;
      }
      
      return {
        content: [{
          type: "text",
          text: `No pages found ${dateRangeText} (${searchType} date)`
        }]
      };
    }

    let result = `## Date Filtered Search Results\n\n`;
    
    // Display date range
    if (fromDate || toDate) {
      result += `Filter: Pages ${searchType} `;
      if (fromDate && toDate) {
        result += `between ${fromDate.toLocaleDateString()} and ${toDate.toLocaleDateString()}`;
      } else if (fromDate) {
        result += `after ${fromDate.toLocaleDateString()}`;
      } else {
        result += `before ${toDate!.toLocaleDateString()}`;
      }
      result += '\n';
    }
    
    result += `Found ${filteredPages.length} pages\n\n`;

    // Display results
    filteredPages.forEach((page, index) => {
      result += `### ${index + 1}. ${page.title}\n`;
      if (page.created) {
        result += `Created: ${formatYmd(new Date(page.created * 1000))}\n`;
      }
      if (page.updated) {
        result += `Updated: ${formatYmd(new Date(page.updated * 1000))}\n`;
      }
      if (page.user) {
        result += `Created by: ${page.user.displayName}\n`;
      }
      result += '\n';
    });

    return {
      content: [{
        type: "text",
        text: result.trim()
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: [
          'Error details:',
          `Message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          `Operation: search_with_date_filter`,
          `Project: ${projectName}`,
          `Date range: ${params.from || 'any'} to ${params.to || 'any'}`,
          `Timestamp: ${new Date().toISOString()}`
        ].join('\n')
      }],
      isError: true
    };
  }
}