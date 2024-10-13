# URL Shortener Pro

URL Shortener Pro is a full-featured URL shortening service with user management, analytics, and an admin dashboard. This application allows users to create short URLs, track clicks, and manage their shortened links.

## Features

- User registration and authentication
- URL shortening with custom slugs and expiration dates
- QR code generation for shortened URLs
- Click tracking and analytics
- User dashboard with URL management
- Admin dashboard for user management
- Responsive design using Bootstrap

## Prerequisites

Before you begin, ensure you have met the following requirements:

- Node.js (v14 or later)
- MongoDB (v4 or later)
- npm (usually comes with Node.js)

## Installation

1. Clone the repository:

   ```
   git clone https://github.com/budisangster/url-shortener-pro.git
   cd url-shortener-pro
   ```
2. Install the dependencies:

   ```
   npm install
   ```
3. Create a `.env` file in the root directory and add the following environment variables:

   ```
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/urlShortener
   JWT_SECRET=your_jwt_secret_here
   ADMIN_EMAIL=admin@example.com
   ```

   Replace `your_jwt_secret_here` with a secure random string and `admin@example.com` with your desired admin email.

## Running the Application

1. Start the MongoDB service on your machine.
2. Run the application:

   ```
   npm start
   ```
3. The application will be available at `http://localhost:3000`.

## Usage

### User Registration and Login

1. Open the application in your web browser.
2. Click on the "Register" tab and fill in the registration form.
3. After registration, log in using your email and password.

### Shortening a URL

1. On the dashboard, enter the long URL you want to shorten in the "URL to shorten" field.
2. Optionally, enter a custom slug and expiration date.
3. Click "Shorten URL".
4. The shortened URL will appear in the URL list below.

### Managing URLs

- View all your shortened URLs in the dashboard table.
- Click on the QR code icon to generate and view the QR code for a URL.
- Use the edit icon to modify the original URL, custom slug, or expiration date.
- Click the trash icon to delete a URL.

### Viewing Analytics

1. Click on the "Analytics" link in the sidebar.
2. View total URLs, total clicks, and top performing URLs.
3. The chart displays click data for your URLs.

### Updating Profile and Settings

1. Click on "Profile" or "Settings" in the sidebar.
2. Update your information or preferences.
3. Click "Save" to apply changes.

### Admin Dashboard

If you're logged in as an admin:

1. Click on "Admin Dashboard" in the sidebar.
2. View and manage all users in the system.

## API Endpoints

The application provides several API endpoints:

- POST `/register`: Register a new user
- POST `/login`: Authenticate a user
- POST `/shorten`: Create a shortened URL
- GET `/:shortUrl`: Redirect to the original URL
- GET `/api/stats/:shortUrl`: Get stats for a specific URL
- GET `/api/user/urls`: Get all URLs for the authenticated user
- DELETE `/api/url/:shortCode`: Delete a specific URL
- PUT `/api/url/:shortUrl`: Update a specific URL
- GET `/api/user/profile`: Get user profile
- PUT `/api/user/profile`: Update user profile
- GET `/api/user/settings`: Get user settings
- PUT `/api/user/settings`: Update user settings
- GET `/api/analytics`: Get analytics data
- GET `/api/admin/users`: Get all users (admin only)

## Todo

Here's a list of future improvements and features for the URL Shortener Pro:

1. Implement password protection for shortened URLs

   - Add a password field in the URL creation form
   - Modify the redirection logic to check for password when applicable
2. Add social sharing buttons for shortened URLs

   - Integrate share buttons for popular social media platforms
   - Implement Open Graph tags for better link previews
3. Enhance analytics with more detailed statistics

   - Add geographical data for clicks
   - Implement time-based click tracking (hourly, daily, weekly views)
4. Create a public API for URL shortening

   - Design and document API endpoints
   - Implement API key authentication for third-party usage
5. Improve user dashboard with more customization options

   - Allow users to categorize their URLs
   - Add ability to bulk import/export URLs
6. Implement a custom domain feature

   - Allow users to use their own domains for shortened URLs
   - Add DNS management instructions for users
7. Enhance security measures

   - Implement rate limiting for URL creation and redirection
   - Add CAPTCHA for public URL creation to prevent abuse
8. Improve mobile responsiveness

   - Optimize layout for smaller screens
   - Implement a mobile app version of the service
9. Add multi-language support

   - Implement i18n for the user interface
   - Allow users to choose their preferred language
10. Implement advanced user roles and permissions

    - Add team collaboration features
    - Create different access levels for enterprise use

These todos will help guide the future development of the URL Shortener Pro and enhance its functionality and user experience.

## Contributing

Contributions to URL Shortener Pro are welcome. Please follow these steps:

1. Fork the repository.
2. Create a new branch: `git checkout -b <branch_name>`.
3. Make your changes and commit them: `git commit -m '<commit_message>'`
4. Push to the original branch: `git push origin <project_name>/<location>`
5. Create the pull request.

Alternatively, see the GitHub documentation on [creating a pull request](https://help.github.com/articles/creating-a-pull-request/).

## License

This project uses the following license: [MIT License](https://opensource.org/licenses/MIT).
