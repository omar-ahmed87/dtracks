import serverless from 'serverless-http';
import app from './server.js';

const handler = serverless(app);

export default {
  async fetch(request, env, ctx) {
    // Cloudflare passes environment variables via the `env` parameter.
    // We merge them into process.env so the Express app can read them normally.
    Object.assign(process.env, env);
    
    // Explicitly set the Cloudflare Worker flag just in case
    process.env.CLOUDFLARE_WORKER = "true";

    return handler(request, env, ctx);
  },
};
