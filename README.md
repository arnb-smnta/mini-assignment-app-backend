# Mini Assignment App

## Overview

The Mini Assignment App is a full-stack application designed to streamline the assignment and task management process for both admin and non-admin users. This application allows admins to create and assign projects to users, while users can view and track their assigned tasks, including progress and scores.

### Hosted Link

-[Video]-https://drive.google.com/file/d/1kCaHm6AImRKzBsmSW1GSEdwhpXIXIhx9/view?usp=drive_link

- [Live Demo](https://assingment-app-lonots.netlify.app/)

### Frontend Repository

- [Frontend GitHub Repository](https://github.com/arnb-smnta/mini-assignment-app-frontend)

### Backend Repository

- [Backend GitHub Repository](https://github.com/arnb-smnta/mini-assignment-app-backend)

## Features

### Admin Functionality

- **Create Assignments**: Admins can create new assignments and projects.
- **Assign Projects**: Admins can assign projects to non-admin users.
- **View All Assignments**: Admins can view all available assignments and the scores of different users assigned to the projects.
- **Manage Tasks**: Admins can create, update, and delete tasks associated with projects.

### User Functionality

- **View Assigned Tasks**: Users can see only the tasks they are assigned to.
- **Track Progress**: Users can track their progress and scores for the tasks they are working on.
- **Search Tasks**: Users can search for tasks to complete easily.
- **View All Tasks**: Users can view all tasks assigned to them.

## Technology Stack

- **Frontend**: React, Redux, Tailwind CSS
- **Backend**: Node.js, Express.js, MongoDB
- **Authentication**: JWT (JSON Web Tokens)
- **Deployment**: Netlify (Frontend), Railway (Backend)

## Installation

### Prerequisites

Make sure you have the following installed:

- Node.js
- MongoDB (for local development)
- Git

### Clone the Repository

```bash
git clone https://github.com/arnb-smnta/mini-assignment-app-frontend.git
git clone https://github.com/arnb-smnta/mini-assignment-app-backend.git
```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd mini-assignment-app-frontend
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd mini-assignment-app-backend
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file and configure your environment variables (e.g., MongoDB connection string, JWT secret).
4. Start the server:
   ```bash
   npm start
   ```

## Usage

1. Navigate to the frontend URL in your browser (default: `http://localhost:3000`).
2. Register as a new user or log in as an existing user.
3. If you are an admin, you can create new projects and assign them to users.
4. Users can view their assigned tasks, track progress, and manage their tasks.

## API Endpoints

### Backend Routes

#### Project Routes

| **Route**                         | **HTTP Method** | **Description**                         |
| --------------------------------- | --------------- | --------------------------------------- |
| `/api/projects`                   | POST            | Creates a new project.                  |
| `/api/projects`                   | GET             | Retrieves all projects.                 |
| `/api/projects/:projectId`        | GET             | Retrieves a specific project by its ID. |
| `/api/projects/:projectId`        | DELETE          | Deletes a specific project by its ID.   |
| `/api/projects/:projectId`        | PATCH           | Updates a specific project by its ID.   |
| `/api/projects/assign/:projectId` | POST            | Assigns a user to a specific project.   |
| `/api/projects/assign/:projectId` | DELETE          | Removes a user from a specific project. |

#### Task Routes

| **Route**                  | **HTTP Method** | **Description**                                    |
| -------------------------- | --------------- | -------------------------------------------------- |
| `/api/projects/:projectId` | POST            | Creates tasks for a specific project.              |
| `/api/projects/t/:taskId`  | DELETE          | Deletes a specific task by its ID.                 |
| `/api/projects/t/:taskId`  | PATCH           | Updates a specific task by its ID.                 |
| `/api/projects/t/:taskId`  | GET             | Retrieves a specific task by its ID.               |
| `/api/projects/t/:taskId`  | POST            | Updates the progress of a specific task by its ID. |

### Authentication

All routes are protected by JWT authentication middleware, ensuring that only authorized users can access these functionalities.

## Contributing

If you would like to contribute to this project, please fork the repository and create a pull request with your changes.

## License

This project is licensed under the MIT License.

## Acknowledgments

- Thank you to all the contributors and resources that made this project possible!

---
