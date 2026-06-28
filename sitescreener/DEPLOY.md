# Deploy: jontidd.com/sitescreener  (password: igce)

Your jontidd-homepage project is a static (no-framework) Vercel project, domain
jontidd.com. Two options.

## Option A — drop-in, zero risk (recommended first)
The page already has an in-page password gate set to: igce
1. In the jontidd-homepage repo, copy the folder `sitescreener/` (containing
   index.html) to the same place your other static files live (next to your
   existing homepage index).
2. Commit and push to main. Vercel auto-deploys. (Or run `vercel --prod`.)
3. Visit https://jontidd.com/sitescreener  ->  password: igce

No build changes, no dependencies, cannot affect the rest of your homepage.
Note: the in-page gate is a light client-side lock (the password is visible in
page source). Fine for an obscure path over public-records data; use Option B
if you want a true lock.

## Option B — real server-side lock (Basic Auth, optional)
Adds a native browser password prompt before the page loads.
1. Do Option A first.
2. Copy `optional-server-lock/middleware.js` to the repo ROOT.
3. Merge `optional-server-lock/package.json` deps into your root package.json
   (adds @vercel/edge). If you have no package.json, copy this one to root.
4. (Optional) remove the in-page gate from sitescreener/index.html to avoid a
   double prompt.
5. Push. Username can be anything; password is: igce
   The middleware is scoped to /sitescreener only and will not touch the rest
   of jontidd.com.

## Fastest hands-off route
Open the jontidd-homepage repo in Claude Code (desktop or mobile) and I can place
these files and run the deploy for you directly.
