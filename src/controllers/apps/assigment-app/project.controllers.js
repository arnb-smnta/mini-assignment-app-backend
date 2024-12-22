import {
  AvailableUserRoles,
  ProgessEnum,
  TaskEnumStatus,
  UserRolesEnum,
} from "../../../constants.js";
import { Progress } from "../../../models/apps/assigment-app/progessSchema.model.js";
import { Project } from "../../../models/apps/assigment-app/projectSchema.model.js";
import { Task } from "../../../models/apps/assigment-app/taskSchema.model.js";
import { User } from "../../../models/apps/auth/user.models.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

const getAllProjects = asyncHandler(async (req, res) => {
  const { _id: userId, role: userRole } = req.user; // Extract user ID and role

  let projects;

  if (userRole === UserRolesEnum.ADMIN) {
    // Admin: Fetch all projects
    projects = await Project.find({})
      .populate({
        path: "assignedTo.user",
        select: "name email", // Include user fields
      })
      .populate({
        path: "tasks",
        select: "name description status", // Include task fields
      });
  } else {
    // Non-admin: Fetch projects assigned to the user
    projects = await Project.find({ "assignedTo.user": userId })
      .populate({
        path: "assignedTo.user",
        select: "name email", // Include user fields
      })
      .populate({
        path: "tasks",
        select: "name description status", // Include task fields
      });
  }

  if (!projects.length) {
    return res.status(404).json(new ApiResponse(404, [], "No projects found")); // Return an empty array if no projects are found
  }

  return res
    .status(200)
    .json(new ApiResponse(200, projects, "Projects retrieved successfully"));
});

// Controller to create a new project
const createProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  // Check if the project name is provided
  if (!name) {
    throw new ApiError(402, "Name of project is required");
  }

  // Only admins can create a new project
  const user = await User.findById(req.user._id);
  if (user.role !== UserRolesEnum.ADMIN) {
    throw new ApiError(
      402,
      "You are not authorised to perform this task as you are not an Admin"
    );
  }

  // Create a new project
  const new_project = await Project.create({
    name: name,
    description: description,
  });

  // Check if the project was created successfully
  const project = await Project.findById(new_project._id);
  if (!project) {
    throw new ApiError(500, "Project not created internal server error");
  }

  // Return success response
  return res
    .status(200)
    .json(new ApiResponse(200, project, "Project created successfully"));
});

// Controller to assign a project to a user
const assignProjectToAUser = asyncHandler(async (req, res) => {
  const { projectId } = req.params; // ID of the project to be assigned
  const { startDate, endDate, userid } = req.body;

  // Check if the user to be assigned exists
  const user = await User.findById(userid);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Check if the requester is an admin
  const admin = await User.findById(req.user._id);
  if (admin.role !== UserRolesEnum.ADMIN) {
    throw new ApiError(
      401,
      "You are not authorized to perform this task as you are not an Admin"
    );
  }

  // Validate start and end dates
  if (!startDate || !endDate) {
    throw new ApiError(400, "Start and end dates are required");
  }

  const parsedStartDate = new Date(startDate);
  const parsedEndDate = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to the start of the day for accurate comparison

  // Check for valid date formats
  if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
    throw new ApiError(400, "Invalid date format for start or end date");
  }

  // Validate date order and ensure they are not in the past
  if (parsedStartDate >= parsedEndDate) {
    throw new ApiError(400, "Start date must be earlier than end date");
  }

  if (parsedStartDate < today) {
    throw new ApiError(400, "Start date cannot be earlier than today");
  }

  if (parsedEndDate < today) {
    throw new ApiError(400, "End date cannot be earlier than today");
  }

  // Check if the project exists
  if (!projectId) {
    throw new ApiError(400, "Project ID is required");
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  // Check if the user is already assigned to the project
  const isAlreadyAssigned = project.assignedTo.some(
    (assignment) => assignment.user.toString() === userid
  );
  if (isAlreadyAssigned) {
    throw new ApiError(400, "User is already assigned to this project");
  }
  // Add initial score entry for the user in scoreByUser
  const isScoreAlreadyTracked = project.scoreByUser.some(
    (entry) => entry.userID.toString() === userid
  );

  if (!isScoreAlreadyTracked) {
    project.scoreByUser.push({
      userID: user._id,
      score: 0, // Initialize score to 0
    });
  }
  // Assign the user to the project
  project.assignedTo.push({
    user: { _id: user._id, username: user.username },
    userStartDate: parsedStartDate,
    userEndDate: parsedEndDate,
  });

  // Create progress records for each task
  const tasks = await Task.find({ projectId }); // Fetch all tasks associated with the project
  for (const task of tasks) {
    const progress = await Progress.create({
      userId: userid,
      projectId,
      taskId: task._id,
      status: TaskEnumStatus.PENDING, // Initial status for the progress
    });

    // Push the progress ID into the task's progress array
    task.progress.push(progress);
    await task.save(); // Save the task with the new progress entry
  }

  await project.save(); // Save the project with the new assignment

  // Return success response
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        project,
        "User is assigned to project and progress has been created for all tasks"
      )
    );
});

const getProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  // Check if the user is assigned to the project or is an admin
  const user = await User.findById(req.user._id);
  const project = await Project.findById(projectId);

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  const isUserAssigned = project.assignedTo.some(
    (assignment) => assignment.user.toString() === req.user._id.toString()
  );

  if (!isUserAssigned && user.role !== UserRolesEnum.ADMIN) {
    throw new ApiError(
      403,
      "You are not an admin and also not assigned to this project to see its details"
    );
  }

  // Use aggregation pipeline to fetch project details with task details
  const projectWithTasks = await Project.aggregate([
    { $match: { _id: project._id } }, // Match the project by ID
    {
      $lookup: {
        from: "tasks", // Assuming the collection name for tasks is "tasks"
        localField: "tasks", // Field in "Project" referencing task IDs
        foreignField: "_id", // Field in "tasks" collection
        as: "taskDetails", // Output array for task details
      },
    },
  ]);

  if (projectWithTasks.length === 0) {
    throw new ApiError(404, "Project not found");
  }

  const projectData = projectWithTasks[0]; // Extract the aggregated project data

  if (user.role === UserRolesEnum.ADMIN) {
    // For admin, return all details
    return res
      .status(200)
      .json(new ApiResponse(200, projectData, "Project fetched successfully"));
  } else {
    // For user, exclude "assignedTo" and return filtered scoreByUser data
    const filteredData = {
      ...projectData,
      assignedTo: undefined, // Remove the `assignedTo` field
      scoreByUser: projectData.scoreByUser.filter(
        (score) => score.userID.toString() === req.user._id.toString()
      ), // Filter scoreByUser for only this user
    };

    return res
      .status(200)
      .json(new ApiResponse(200, filteredData, "Project fetched successfully"));
  }
});

// Controller to delete a project
const deleteProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  // Only admins can delete a project
  const user = await User.findById(req.user._id);
  if (user.role !== UserRolesEnum.ADMIN) {
    throw new ApiError(402, "You are not authorised to delete this Project");
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  // Cascade delete tasks associated with the project
  await Task.deleteMany({ projectId });

  // Delete the project
  await Project.deleteOne({ _id: projectId });

  // Return success response
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Project deleted successfully"));
});

const updateProject = asyncHandler(async (req, res) => {
  // Extract project ID from request parameters
  const { projectId } = req.params;
  // Extract name and description from request body
  const { name, description } = req.body;

  // Find the user making the request
  const user = await User.findById(req.user._id);

  // Check if the user is an admin
  if (user.role !== UserRolesEnum.ADMIN) {
    throw new ApiError(402, "You are not authorised to perform this action");
  }

  // Find the project by ID
  const project = await Project.findById(projectId);
  // If the project does not exist, throw an error
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  // Update the project fields if they are provided in the request
  if (name) project.name = name; // Update project name if provided
  if (description) project.description = description; // Update project description if provided

  // Save the updated project to the database
  await project.save();

  // Return a successful response with the updated project details
  return res
    .status(200)
    .json(new ApiResponse(200, project, "Project updated successfully"));
});

const removeUserFromProject = asyncHandler(async (req, res) => {
  // Extract project ID from request parameters
  const { projectId } = req.params;

  // Extract user ID from request body
  const { userId } = req.body;

  // Check if user ID is provided
  if (!userId) {
    throw new ApiError(404, "User not found"); // Throw an error if no user ID is provided
  }

  // Find the project by ID
  const project = await Project.findById(projectId);
  // If the project does not exist, throw an error
  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  // Check if the user is assigned to the project by finding their index in the assigned list
  const userIndex = project.assignedTo.findIndex(
    (assignment) => assignment.user.toString() === userId
  );
  // If the user is not assigned, return a not found response
  if (userIndex === -1) {
    return res
      .status(404)
      .json({ message: "User not assigned to this project" });
  }

  // Remove the user from the assigned list using the index
  project.assignedTo.splice(userIndex, 1);
  // Save the updated project to the database
  await project.save();

  // Return a successful response indicating the user has been removed from the project
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { project },
        "Project assignees updated successfully"
      )
    );
});
export {
  createProject,
  assignProjectToAUser,
  getProject,
  deleteProject,
  updateProject,
  removeUserFromProject,
  getAllProjects,
};
