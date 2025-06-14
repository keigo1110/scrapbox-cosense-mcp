import { listPages, getPage } from '../../cosense.js';

export interface SearchWithRegexParams {
  pattern: string;
  flags?: string; // Regex flags like 'i' for case-insensitive
}

export async function handleSearchWithRegex(
  projectName: string,
  cosenseSid: string | undefined,
  params: SearchWithRegexParams
) {
  try {
    if (!params.pattern) {
      return {
        content: [{
          type: "text",
          text: 'Error: No regex pattern provided'
        }],
        isError: true
      };
    }

    let regex: RegExp;
    try {
      regex = new RegExp(params.pattern, params.flags || 'i');
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error: Invalid regex pattern "${params.pattern}". ${error instanceof Error ? error.message : ''}`
        }],
        isError: true
      };
    }

    // Fetch pages
    const response = await listPages(projectName, cosenseSid, {
      limit: 1000,
      skip: 0,
      sort: 'updated'
    });

    // Search through pages
    const matchingPages: Array<{
      page: any;
      matches: Array<{ lineNumber: number; line: string; match: string }>;
    }> = [];

    for (const page of response.pages) {
      // Get full page content
      const fullPage = await getPage(projectName, page.title, cosenseSid);
      
      if (!fullPage || !fullPage.lines) continue;
      
      const pageMatches: Array<{ lineNumber: number; line: string; match: string }> = [];
      
      // Search title
      const titleMatch = page.title.match(regex);
      if (titleMatch) {
        pageMatches.push({
          lineNumber: 0,
          line: `[Title] ${page.title}`,
          match: titleMatch[0]
        });
      }
      
      // Search content
      fullPage.lines.forEach((line, index) => {
        const match = line.text.match(regex);
        if (match) {
          pageMatches.push({
            lineNumber: index + 1,
            line: line.text,
            match: match[0]
          });
        }
      });
      
      if (pageMatches.length > 0) {
        matchingPages.push({
          page: {
            ...page,
            lines: fullPage.lines
          },
          matches: pageMatches
        });
      }
    }

    if (matchingPages.length === 0) {
      return {
        content: [{
          type: "text",
          text: `No pages found matching regex pattern: /${params.pattern}/${params.flags || ''}`
        }]
      };
    }

    let result = `## Regex Search Results\n\n`;
    result += `Pattern: /${params.pattern}/${params.flags || ''}\n`;
    result += `Found matches in ${matchingPages.length} pages\n\n`;

    matchingPages.forEach((item, index) => {
      result += `### ${index + 1}. ${item.page.title}\n`;
      
      // Show matches
      result += `**Matches (${item.matches.length}):**\n`;
      item.matches.slice(0, 5).forEach(match => {
        if (match.lineNumber === 0) {
          result += `- ${match.line}\n`;
        } else {
          result += `- Line ${match.lineNumber}: ${match.line.substring(0, 100)}${match.line.length > 100 ? '...' : ''}\n`;
        }
      });
      
      if (item.matches.length > 5) {
        result += `- ... and ${item.matches.length - 5} more matches\n`;
      }
      
      if (item.page.updated) {
        const date = new Date(item.page.updated * 1000);
        result += `\nUpdated: ${date.toLocaleString()}\n`;
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
          `Operation: search_with_regex`,
          `Project: ${projectName}`,
          `Pattern: ${params.pattern}`,
          `Flags: ${params.flags || 'none'}`,
          `Timestamp: ${new Date().toISOString()}`
        ].join('\n')
      }],
      isError: true
    };
  }
}