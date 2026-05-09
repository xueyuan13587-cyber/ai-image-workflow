# Deploy to the Internet

This project is a Next.js app, so the easiest public deployment path is Vercel.

## What You Need

1. A GitHub account.
2. A Vercel account.
3. An OpenAI-compatible image API key.
4. This project pushed to a GitHub repository.

## Step 1: Put the Project on GitHub

Create a new GitHub repository, then upload this project folder.

Do not upload `.env.local`. It contains secrets and is already ignored by `.gitignore`.

## Step 2: Import the Project on Vercel

1. Open Vercel.
2. Click `Add New...`.
3. Choose `Project`.
4. Import your GitHub repository.
5. Keep the default Next.js settings.

Vercel will usually detect:

- Framework Preset: `Next.js`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `.next`

## Step 3: Add Environment Variables

In Vercel Project Settings, add these variables:

```bash
OPENAI_API_KEY=sk-your-server-side-key
OPENAI_BASE_URL=https://api.openai.com/v1
GPTSAPI_BASE_URL=https://api.gptsapi.net
OPENAI_IMAGE_MODEL=gpt-image-1.5
OPENAI_RESPONSES_MODEL=gpt-5
OPENAI_IMAGE_SIZE=1024x1024
OPENAI_IMAGE_QUALITY=auto
AUTH_SECRET=replace-with-a-long-random-secret
AUTH_USERS=admin:change-this-password
ENABLE_SIGNUP=true
UPSTASH_REDIS_REST_URL=your-upstash-rest-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-rest-token
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_UPLOAD_PRESET=your-unsigned-upload-preset
```

Important: do not use `NEXT_PUBLIC_` for `OPENAI_API_KEY`.

If you use API 随心用 / GPTSAPI, use:

```bash
OPENAI_BASE_URL=https://api.gptsapi.net/v1
GPTSAPI_BASE_URL=https://api.gptsapi.net
```

`AUTH_USERS` controls who can log in. Multiple users can be separated with commas:

```bash
AUTH_USERS=alice:strong-password,bob:another-strong-password
```

`AUTH_SECRET` should be a long random string. Do not reuse the example value.

`AUTH_USERS` is for fixed admin accounts. To allow normal users to register on
the website, create a free Upstash Redis database and add its REST URL and REST
token as `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Keep
`ENABLE_SIGNUP=true`.

## Step 4: Deploy

Click `Deploy`.

After deployment, Vercel gives you a public URL like:

```text
https://your-project-name.vercel.app
```

Anyone with this URL can open the login page. Users listed in `AUTH_USERS` can
log in directly, and new users can register when Upstash Redis is configured.

## Step 5: Add a Custom Domain

In Vercel:

1. Open your project.
2. Go to `Settings`.
3. Go to `Domains`.
4. Add your domain, for example `yourdomain.com`.
5. Follow Vercel's DNS instructions.

## Important Production Notes

This version uses your server-side image API key for logged-in visitors.

Before sharing widely, consider adding:

- Rate limiting.
- Usage quotas.
- Request logging.
- A payment or credit system.
- Moderation and abuse protection.

Without these protections, logged-in users can still consume your billing account.
