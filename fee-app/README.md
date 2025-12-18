# Fee Collection Application

A React-based fee collection system that integrates seamlessly with the main workflow application via PostMessage authentication.

## Features

- **Automatic Authentication**: No separate login required - receives user credentials from parent workflow app
- **Role-Based Access Control**: Different views for Super Admin, Headmaster, Class Teachers, and Teachers
- **Real-time Communication**: Uses PostMessage API for secure cross-origin data transfer
- **Responsive Design**: Built with Tailwind CSS for mobile and desktop

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Development

The app runs on `http://localhost:5174` by default.

### Local Testing with Workflow App

1. **Start both apps:**
   ```bash
   # Terminal 1 - Workflow app
   cd ../frontend
   npm run dev

   # Terminal 2 - Fee app
   cd fee-app
   npm run dev
   ```

2. **Update allowed origins in `src/App.jsx`:**
   ```javascript
   const allowedOrigins = [
     'http://localhost:5173',  // Your workflow app URL
   ];
   ```

3. **Access via workflow app:**
   - Open http://localhost:5173
   - Log in
   - Navigate to Fee Collection tab

## Authentication Flow

1. Fee app loads and sends `FEE_APP_READY` message to parent
2. Workflow app receives ready message
3. Workflow app sends `AUTH_DATA` with user information
4. Fee app validates origin and stores user data
5. Fee app renders role-based UI

### User Data Structure

```javascript
{
  email: "user@ayathanschool.com",
  name: "User Name",
  roles: ["class teacher", "teacher"],
  classes: ["STD 10A", "STD 7A"],
  subjects: ["English", "Math"],
  classTeacherFor: "STD 10A",
  picture: "https://..."
}
```

## Role-Based Features

### Super Admin / Headmaster
- View all classes
- Manage fee structure
- Generate reports
- Full administrative access

### Class Teacher
- View/manage assigned class fees
- Mark payments as received
- View student fee status

### Teacher
- View fee status for teaching classes
- Read-only access

## Security

- **Origin Validation**: Only accepts messages from authorized parent domains
- **Session Storage**: User data stored in sessionStorage (cleared on tab close)
- **No Direct Access**: App requires authentication from parent window

## Deployment

### Update Configuration

Before deploying, update `allowedOrigins` in `src/App.jsx`:

```javascript
const allowedOrigins = [
  'https://your-workflow-app.vercel.app',  // Production URL
  'http://localhost:5173',  // Keep for local dev
];
```

### Deploy to Vercel

```bash
npm run build
vercel --prod
```

### Post-Deployment

1. Note the deployed URL (e.g., `https://fee-app-6jwp.vercel.app`)
2. Update workflow app's iframe src to use this URL
3. Redeploy workflow app

## Project Structure

```
fee-app/
├── src/
│   ├── components/
│   │   ├── FeeAppContent.jsx      # Main app content
│   │   ├── LoadingScreen.jsx      # Loading state
│   │   ├── NotAuthenticatedScreen.jsx  # No auth fallback
│   │   └── RoleGuard.jsx          # Role-based rendering
│   ├── App.jsx                    # Main app & auth logic
│   ├── main.jsx                   # React entry point
│   └── index.css                  # Global styles
├── public/
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Troubleshooting

### "Authentication Required" screen shown
- Check browser console for origin rejection messages
- Verify `allowedOrigins` includes workflow app URL
- Ensure workflow app is sending `AUTH_DATA` message

### PostMessage not received
- Check both apps are running
- Verify iframe loads without errors
- Check browser console for CORS or security errors
- Ensure `FEE_APP_READY` message is sent

### Roles not working
- Check `user.roles` array in console
- Verify role names match (case-insensitive)
- Check user data in workflow app's Users sheet

## Contributing

This app is part of the Ayathan School management system monorepo. See main workspace documentation for contribution guidelines.

## License

Private - Ayathan School © 2025
