import { getPage } from '../../cosense.js';

export interface GetBacklinksParams {
  title: string;
}

export async function handleGetBacklinks(
  projectName: string,
  cosenseSid: string | undefined,
  params: GetBacklinksParams
) {
  try {
    const pageDetails = await getPage(projectName, params.title, cosenseSid);
    
    if (!pageDetails) {
      return {
        content: [{
          type: "text",
          text: `Error: Unable to find page "${params.title}"`
        }],
        isError: true
      };
    }

    const backlinks = pageDetails.relatedPages?.links1hop || [];
    
    if (backlinks.length === 0) {
      return {
        content: [{
          type: "text",
          text: `No pages link to "${params.title}"`
        }]
      };
    }

    let result = `## Backlinks for "${params.title}"\n\n`;
    result += `Found ${backlinks.length} pages that link to this page:\n\n`;
    
    backlinks.forEach((link, index) => {
      result += `### ${index + 1}. ${link.title}\n`;
      if (link.descriptions && link.descriptions.length > 0) {
        result += `${link.descriptions.slice(0, 3).join('\n')}\n`;
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
          `Operation: get_backlinks`,
          `Project: ${projectName}`,
          `Page: ${params.title}`,
          `Timestamp: ${new Date().toISOString()}`
        ].join('\n')
      }],
      isError: true
    };
  }
}