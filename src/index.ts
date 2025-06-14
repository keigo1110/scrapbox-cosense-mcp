#!/usr/bin/env node

const API_DOMAIN = process.env.API_DOMAIN || "scrapbox.io";
const SERVICE_LABEL = process.env.SERVICE_LABEL || "cosense (scrapbox)";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { listPages, getPage, toReadablePage } from "./cosense.js";
import { formatYmd } from './utils/format.js';
import { setupRoutes } from './routes/index.js';

// 環境変数のデフォルト値と検証用の定数
const FETCH_PAGE_LIMIT = 100;  // 固定で100件取得
const DEFAULT_PAGE_LIMIT = FETCH_PAGE_LIMIT;  // デフォルトは取得上限と同じ
const DEFAULT_SORT_METHOD = 'updated';
const MIN_PAGE_LIMIT = 1;
const MAX_PAGE_LIMIT = 1000;

// 有効なソート方法の定義
const VALID_SORT_METHODS = ['updated', 'created', 'accessed', 'linked', 'views', 'title'] as const;

// resourcesの初期取得用の設定
const cosenseSid: string | undefined = process.env.COSENSE_SID;
const projectName: string | undefined = process.env.COSENSE_PROJECT_NAME;
const initialPageLimit: number = (() => {
  const limit = process.env.COSENSE_PAGE_LIMIT ?
    parseInt(process.env.COSENSE_PAGE_LIMIT, 10) :
    DEFAULT_PAGE_LIMIT;

  if (isNaN(limit) || limit < MIN_PAGE_LIMIT || limit > MAX_PAGE_LIMIT) {
    console.error(`Invalid COSENSE_PAGE_LIMIT: ${process.env.COSENSE_PAGE_LIMIT}, using default: ${DEFAULT_PAGE_LIMIT}`);
    return DEFAULT_PAGE_LIMIT;
  }
  return limit;
})();

const initialSortMethod: string = (() => {
  const sort = process.env.COSENSE_SORT_METHOD;

  if (!sort) return DEFAULT_SORT_METHOD;
  if (!VALID_SORT_METHODS.includes(sort as any)) {
    console.error(`Invalid COSENSE_SORT_METHOD: ${sort}, using default: ${DEFAULT_SORT_METHOD}`);
    return DEFAULT_SORT_METHOD;
  }
  return sort;
})();

if (!projectName) {
  throw new Error("COSENSE_PROJECT_NAME is not set");
}

// resourcesの初期化（100件取得してソート）
const resources = await (async () => {
  try {
    // 常に100件取得
    const result = await listPages(
      projectName,
      cosenseSid,
      {
        limit: FETCH_PAGE_LIMIT,  // 固定で100件
        skip: 0,
        sort: initialSortMethod,
        excludePinned: process.env.COSENSE_EXCLUDE_PINNED === 'true'
      }
    );

    // ソート済みのページから必要な件数だけを使用
    return result.pages
      .slice(0, Math.min(initialPageLimit, FETCH_PAGE_LIMIT))  // 環境変数で指定された件数か100件の小さい方
      .map((page) => ({
        uri: `cosense:///${page.title}`,
        mimeType: "text/plain",
        name: page.title,
        description: `A text page: ${page.title}`,
      }));

  } catch (error) {
    console.error('Failed to initialize resources:', error);
    return [];  // 空の配列を返してサーバーは起動を継続
  }
})();

const server = new Server(
  {
    name: "scrapbox-cosense-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  },
);

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources,
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const url = new URL(request.params.uri);
  const title = decodeURIComponent(url.pathname.replace(/^\//, ""));

  const getPageResult = await getPage(projectName, title, cosenseSid);
  if (!getPageResult) {
    throw new Error(`Page ${title} not found`);
  }
  const readablePage = toReadablePage(getPageResult);
  const formattedText = [
    `Title: ${readablePage.title}`,
    `Created: ${formatYmd(new Date(readablePage.created * 1000))}`,
    `Updated: ${formatYmd(new Date(readablePage.updated * 1000))}`,
    `Created user: ${readablePage.lastUpdateUser?.displayName || readablePage.user.displayName}`,
    `Last editor: ${readablePage.user.displayName}`,
    `Other editors: ${readablePage.collaborators
      .filter(collab =>
        collab.id !== readablePage.user.id &&
        collab.id !== readablePage.lastUpdateUser?.id
      )
      .map(user => user.displayName)
      .join(', ')}`,
    '',
    readablePage.lines.map(line => line.text).join('\n'),
    '',
    `Links:\n${getPageResult.links.length > 0
      ? getPageResult.links.map((link: string) => `- ${link}`).join('\n')
      : '(None)'}`
  ].join('\n');

  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: "text/plain",
        text: formattedText,
      },
    ],
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_page",
        description: `
        Create a new page in ${projectName} project on ${SERVICE_LABEL}

        Creates a new page with the specified title and optional body text.
        The page will be opened in your default browser.
        `,
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Title of the new page",
            },
            body: {
              type: "string",
              description: "Content in markdown format that will be converted to Scrapbox format. Supports standard markdown syntax including links, code blocks, lists, and emphasis.",
            },
          },
          required: ["title"],
        },
      },
      {
        name: "get_page",
        description: `
        Get a page from ${projectName} project on ${SERVICE_LABEL}
        Returns page content and its linked pages.
        Page content includes title and description in plain text format.
        `,
        inputSchema: {
          type: "object",
          properties: {
            pageTitle: {
              type: "string",
              description: "Title of the page",
            },
          },
          required: ["pageTitle"],
        },
      },
      {
        name: "list_pages",
        description: `
        List pages from ${projectName} project on ${SERVICE_LABEL} with flexible sorting options.

        Available sorting methods:
        - updated: Sort by last update time
        - created: Sort by creation time
        - accessed: Sort by access time
        - linked: Sort by number of incoming links
        - views: Sort by view count
        - title: Sort by page title
        `,
        inputSchema: {
          type: "object",
          properties: {
            sort: {
              type: "string",
              enum: ["updated", "created", "accessed", "linked", "views", "title"],
              description: "Sort method for the page list",
            },
            limit: {
              type: "number",
              minimum: 1,
              maximum: 1000,
              description: "Maximum number of pages to return (1-1000)",
            },
            skip: {
              type: "number",
              minimum: 0,
              description: "Number of pages to skip",
            },
            excludePinned: {
              type: "boolean",
              description: "Whether to exclude pinned pages from the results",
            },
          },
          required: [],
        },
      },
      {
        name: "search_pages",
        description: `
        Search pages in ${projectName} project on ${SERVICE_LABEL}

        Supports various search features:
        - Basic search: "keyword"
        - Multiple keywords: "word1 word2" (AND search)
        - Exclude words: "word1 -word2"
        - Exact phrase: "\\"exact phrase\\""
        `,
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query string",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "update_page",
        description: `
        Update a page in ${projectName} project on ${SERVICE_LABEL}

        Updates an existing page with new content. The page will be opened in your default browser with the new content pre-filled for editing.
        `,
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Title of the page to update",
            },
            content: {
              type: "string",
              description: "New content in markdown format that will be converted to Scrapbox format. Supports standard markdown syntax including links, code blocks, lists, and emphasis.",
            },
          },
          required: ["title", "content"],
        },
      },
      {
        name: "get_backlinks",
        description: `
        Get backlinks (pages that link to a specific page) in ${projectName} project on ${SERVICE_LABEL}

        Returns a list of pages that contain links to the specified page.
        `,
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Title of the page to get backlinks for",
            },
          },
          required: ["title"],
        },
      },
      {
        name: "search_by_tags",
        description: `
        Search pages by tags in ${projectName} project on ${SERVICE_LABEL}

        Searches for pages containing specific tags. Tags can be in [tag] or #tag format.
        Multiple tags are searched with AND logic.
        `,
        inputSchema: {
          type: "object",
          properties: {
            tags: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Array of tag names to search for (without brackets or hash)",
            },
          },
          required: ["tags"],
        },
      },
      {
        name: "search_with_date_filter",
        description: `
        Search pages with date filtering in ${projectName} project on ${SERVICE_LABEL}

        Filter pages by creation or update date ranges.
        `,
        inputSchema: {
          type: "object",
          properties: {
            from: {
              type: "string",
              description: "Start date in ISO format (YYYY-MM-DD)",
            },
            to: {
              type: "string",
              description: "End date in ISO format (YYYY-MM-DD)",
            },
            searchType: {
              type: "string",
              enum: ["created", "updated"],
              description: "Type of date to filter by (default: updated)",
            },
          },
          required: [],
        },
      },
      {
        name: "search_with_regex",
        description: `
        Search pages using regular expressions in ${projectName} project on ${SERVICE_LABEL}

        Performs regex search on page titles and content. 
        Note: This searches client-side and may be slower for large projects.
        `,
        inputSchema: {
          type: "object",
          properties: {
            pattern: {
              type: "string",
              description: "Regular expression pattern to search for",
            },
            flags: {
              type: "string",
              description: "Regex flags (e.g., 'i' for case-insensitive, 'g' for global)",
            },
          },
          required: ["pattern"],
        },
      },
    ],
  };
});

// ルートのセットアップ
setupRoutes(server, {
  projectName,
  cosenseSid,
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error([
    'Fatal Error:',
    `Message: ${error instanceof Error ? error.message : 'Unknown error'}`,
    `Timestamp: ${new Date().toISOString()}`
  ].join('\n'));
  process.exit(1);
});
