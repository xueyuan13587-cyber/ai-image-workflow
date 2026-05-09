# AI Image Workflow

A ComfyUI-inspired node workflow web app for AI image generation.

## Stack

- Next.js App Router, React, TypeScript
- React Flow via `@xyflow/react`
- Tailwind CSS
- Zustand workflow state
- Next.js API Routes for server-side workflow execution
- OpenAI Images API
- Gemini provider placeholder via environment variable

## First Version Features

- Add Text Prompt, Style Preset, Image Generate, and Image Preview nodes.
- Connect nodes on a React Flow canvas.
- Click Run to serialize the canvas into workflow JSON.
- API route validates and resolves the workflow JSON.
- Server calls OpenAI Images API and returns the generated image.
- API keys are read only from server environment variables and are never exposed to client code.

## Getting Started

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

```bash
OPENAI_API_KEY=sk-your-server-side-key
OPENAI_BASE_URL=https://api.openai.com/v1
GPTSAPI_BASE_URL=https://api.gptsapi.net
OPENAI_IMAGE_MODEL=gpt-image-1.5
OPENAI_RESPONSES_MODEL=gpt-5
OPENAI_IMAGE_SIZE=1024x1024 # optional fallback
OPENAI_IMAGE_QUALITY=auto # optional fallback
AUTH_SECRET=replace-with-a-long-random-secret
AUTH_USERS=admin:change-this-password
ADMIN_USERS=admin
DEFAULT_USER_CREDITS=100
ENABLE_SIGNUP=true
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## How It Works

The canvas state lives in `store/workflow-store.ts`. When Run is clicked, the app sends this payload to `POST /api/workflows/run`:

```json
{
  "version": "1.0",
  "nodes": [],
  "edges": []
}
```

The backend flow is:

1. `app/api/workflows/run/route.ts` parses the request.
2. `lib/workflow/schema.ts` validates the workflow JSON.
3. `lib/workflow/runner.ts` resolves upstream prompt and style nodes into one image prompt.
4. `lib/providers/openai-images.ts` calls OpenAI with the server-side API key. If connected Reference Image nodes are present, it sends them as image inputs through the Responses API image generation tool.
5. The response image is passed back to the Image Preview node.

## Security Notes

- Do not prefix API key variables with `NEXT_PUBLIC_`.
- The browser never receives `OPENAI_API_KEY`.
- OpenAI calls happen only in the Next.js API route running on the server.
- If you use an OpenAI-compatible third-party API platform, set `OPENAI_BASE_URL` to that platform's `/v1` endpoint.
- Public deployments require login. Configure `AUTH_USERS` for fixed admin users, or configure Upstash Redis to allow registration.
- Use a strong `AUTH_SECRET` in production; it signs the login cookie.

## Users And Login

The app includes a server-side user system for public web deployment.

```bash
AUTH_SECRET=replace-with-a-long-random-secret
AUTH_USERS=admin:change-this-password,friend:another-password
ENABLE_SIGNUP=true
UPSTASH_REDIS_REST_URL=your-upstash-rest-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-rest-token
```

Users visit `/login`, then they can either log in or register. Registered users are stored in Upstash Redis with salted password hashes. The canvas page and the image generation/upload/download API routes all require the HttpOnly session cookie.

`AUTH_USERS` remains useful for fixed admin accounts. Registered users require `ENABLE_SIGNUP=true` plus the two Upstash Redis variables.

## Platform Features

- Generation requests are recorded as tasks with `pending`, `processing`, `success`, and `failed` states.
- The server calculates credit cost from model, resolution, detail, feature type, and image count.
- Credits are deducted before generation starts.
- Failed generation tasks automatically refund the deducted credits.
- `/admin` provides model management, channel management, sensitive words, templates, task logs, and platform stats.
- `ADMIN_USERS` controls who can enter `/admin`.
- `DEFAULT_USER_CREDITS` controls the initial credit balance for new users.

For local development only, if `AUTH_USERS` is missing, the fallback login is:

```text
admin / admin123
```

## Reference Image Uploads

GPTSAPI image-edit endpoints require public image URLs. To automatically turn local uploads into public URLs, configure Cloudinary unsigned uploads:

```bash
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_UPLOAD_PRESET=your-unsigned-upload-preset
```

After this is configured, uploading a local image in the Reference Image node will automatically upload it and replace the node image with a public URL.

## Future Provider Support

`GEMINI_API_KEY` is reserved in `.env.example`. A future provider can be added under `lib/providers/` and selected by the workflow runner without changing the canvas model.

## Public Deployment

See `DEPLOYMENT.md` for a Vercel deployment guide.
