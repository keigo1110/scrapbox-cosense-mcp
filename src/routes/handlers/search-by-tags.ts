import { searchPages } from '../../cosense.js';

export interface SearchByTagsParams {
  tags: string[];
}

export async function handleSearchByTags(
  projectName: string,
  cosenseSid: string | undefined,
  params: SearchByTagsParams
) {
  try {
    if (!params.tags || params.tags.length === 0) {
      return {
        content: [{
          type: "text",
          text: 'Error: No tags provided for search'
        }],
        isError: true
      };
    }

    // Convert tags to Scrapbox search format
    // Search for both [tag] and #tag formats
    const searchQueries = params.tags.map(tag => {
      const cleanTag = tag.replace(/[\[\]#]/g, ''); // Remove brackets and hash if present
      return `([${cleanTag}] OR #${cleanTag})`;
    });

    // Combine all tag queries with AND logic
    const query = searchQueries.join(' ');

    const searchResult = await searchPages(projectName, query, cosenseSid);

    if (!searchResult || searchResult.count === 0) {
      return {
        content: [{
          type: "text",
          text: `No pages found with tags: ${params.tags.join(', ')}`
        }]
      };
    }

    let result = `## Tag Search Results\n\n`;
    result += `Tags: ${params.tags.join(', ')}\n`;
    result += `Found ${searchResult.count} pages\n\n`;

    searchResult.pages.forEach((page, index) => {
      result += `### ${index + 1}. ${page.title}\n`;
      
      // Show matching lines containing the tags
      if (page.lines && page.lines.length > 0) {
        const relevantLines = page.lines.filter(line => 
          params.tags.some(tag => {
            const cleanTag = tag.replace(/[\[\]#]/g, '');
            return line.includes(`[${cleanTag}]`) || line.includes(`#${cleanTag}`);
          })
        );
        
        if (relevantLines.length > 0) {
          result += relevantLines.slice(0, 3).join('\n') + '\n';
        } else {
          // Fallback to showing first few lines
          result += page.lines.slice(0, 3).join('\n') + '\n';
        }
      }
      
      if (page.updated) {
        const date = new Date(page.updated * 1000);
        result += `Updated: ${date.toLocaleString()}\n`;
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
          `Operation: search_by_tags`,
          `Project: ${projectName}`,
          `Tags: ${params.tags?.join(', ') || 'none'}`,
          `Timestamp: ${new Date().toISOString()}`
        ].join('\n')
      }],
      isError: true
    };
  }
}