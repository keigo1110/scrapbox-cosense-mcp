import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { handleListPages } from './handlers/list-pages.js';
import { handleGetPage } from './handlers/get-page.js';
import { handleSearchPages } from './handlers/search-pages.js';
import { handleCreatePage } from './handlers/create-page.js';
import { handleUpdatePage } from './handlers/update-page.js';
import { handleGetBacklinks } from './handlers/get-backlinks.js';
import { handleSearchByTags } from './handlers/search-by-tags.js';
import { handleSearchWithDateFilter } from './handlers/search-with-date-filter.js';
import { handleSearchWithRegex } from './handlers/search-with-regex.js';

export function setupRoutes(
  server: Server,
  config: {
    projectName: string;
    cosenseSid?: string;
  }
) {
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { projectName, cosenseSid } = config;

    switch (request.params.name) {
      case "list_pages":
        return handleListPages(
          projectName,
          cosenseSid,
          request.params.arguments || {}
        );

      case "get_page":
        return handleGetPage(
          projectName,
          cosenseSid,
          {
            pageTitle: String(request.params.arguments?.pageTitle)
          }
        );

      case "search_pages":
        return handleSearchPages(
          projectName,
          cosenseSid,
          {
            query: String(request.params.arguments?.query)
          }
        );

      case "create_page":
        return handleCreatePage(
          projectName,
          cosenseSid,
          {
            title: String(request.params.arguments?.title),
            body: request.params.arguments?.body as string | undefined
          }
        );

      case "update_page":
        return handleUpdatePage(
          projectName,
          cosenseSid,
          {
            title: String(request.params.arguments?.title),
            content: String(request.params.arguments?.content)
          }
        );

      case "get_backlinks":
        return handleGetBacklinks(
          projectName,
          cosenseSid,
          {
            title: String(request.params.arguments?.title)
          }
        );

      case "search_by_tags":
        return handleSearchByTags(
          projectName,
          cosenseSid,
          {
            tags: request.params.arguments?.tags as string[]
          }
        );

      case "search_with_date_filter":
        return handleSearchWithDateFilter(
          projectName,
          cosenseSid,
          {
            from: request.params.arguments?.from as string | undefined,
            to: request.params.arguments?.to as string | undefined,
            searchType: request.params.arguments?.searchType as 'created' | 'updated' | undefined
          }
        );

      case "search_with_regex":
        return handleSearchWithRegex(
          projectName,
          cosenseSid,
          {
            pattern: String(request.params.arguments?.pattern),
            flags: request.params.arguments?.flags as string | undefined
          }
        );

      default:
        return {
          content: [{
            type: "text",
            text: [
              'Error details:',
              'Message: Unknown tool requested',
              `Tool: ${request.params.name}`,
              `Timestamp: ${new Date().toISOString()}`
            ].join('\n')
          }],
          isError: true
        };
    }
  });
}
