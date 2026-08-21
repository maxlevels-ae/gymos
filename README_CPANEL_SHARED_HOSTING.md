# GymOS cPanel Shared Hosting Deployment

## Recommended cPanel settings
- Node.js version: 18 or 20
- Application root: project folder
- Application startup file: `cpanel-app.js`
- Environment: production

## After upload
1. Upload this project zip to your hosting account.
2. Extract it into your Node application root.
3. In cPanel > Setup Node.js App, set the startup file to `cpanel-app.js`.
4. Run `npm install`.
5. Copy `.env.cpanel.example` to `.env` and update:
   - `JWT_SECRET`
   - `CORS_ORIGINS`
   - `APP_NAME`
6. Ensure these folders are writable:
   - `data/`
   - `data/backups/`
   - `data/uploads/`
7. Restart the Node.js app from cPanel.

## Important notes
- This build is prepared for cPanel Passenger-style hosting.
- `trust proxy` is enabled automatically when `CPANEL_ENV=true`.
- PWA OTP login tokens are enabled with:
  - `PWA_JWT_EXPIRES_IN`
  - `PWA_JWT_REFRESH_EXPIRES_IN`
- Database path is relative to the application root:
  - `./data/gym.db`

## First test after deployment
- Open `/` and login to admin
- Open `/member/` and test member OTP login
- Create a new plan
- Check header branch name

## If your hosting blocks background timers
This app still works, but automatic cleanup/backup jobs may be delayed by the hosting environment.
