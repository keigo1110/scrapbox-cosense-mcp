import { updatePageUrl } from "../../cosense.js";
import { convertMarkdownToScrapbox } from '../../utils/markdown-converter.js';

export interface UpdatePageParams {
  title: string;
  content: string;
}

export async function handleUpdatePage(
  projectName: string,
  _cosenseSid: string | undefined,
  params: UpdatePageParams
) {
  try {
    const title = String(params.title);
    const content = params.content;

    const convertedContent = content ? await convertMarkdownToScrapbox(content) : '';
    const url = updatePageUrl(projectName, title, convertedContent);

    const { exec } = await import("child_process");
    exec(`open "${url}"`);

    return {
      content: [{
        type: "text",
        text: `Opening page for update: ${title}\nURL: ${url}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: [
          'Error details:',
          `Message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          `Operation: update_page`,
          `Project: ${projectName}`,
          `Title: ${params.title}`,
          `Timestamp: ${new Date().toISOString()}`
        ].join('\n')
      }],
      isError: true
    };
  }
}