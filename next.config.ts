import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // These routes read /formats/*.md at runtime with a computed path, which file
  // tracing can't follow — ship the prompt files with their serverless functions.
  outputFileTracingIncludes: {
    '/api/generate-content': ['./formats/**/*.md'],
    '/api/content-mcp': ['./formats/**/*.md'],
    '/api/generate-comment-reply': ['./formats/**/*.md'],
  },
}

export default nextConfig
