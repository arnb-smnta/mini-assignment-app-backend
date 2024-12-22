import { Project } from "../../../models/apps/assigment-app/projectSchema.model.js";
import { Task } from "../../../models/apps/assigment-app/taskSchema.model.js";
import { ApiError } from "../../../utils/ApiError.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

import {
  AvailableProgressStatus,
  TaskEnumStatus,
  UserRolesEnum,
} from "../../../constants.js"; // Import necessary constants
import { Progress } from "../../../models/apps/assigment-app/progessSchema.model.js"; // Import Progress model
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { User } from "../../../models/apps/auth/user.models.js";

// Create tasks for a specific project
const createTasksForAProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { name, description, score } = req.body;

  // Validate input - both name and description are required
  if (!name || !description) {
    throw new ApiError(400, "Both name and description are required"); // Bad request error
  }

  // Find the project by ID
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found"); // Not found error if project doesn't exist
  }

  // Create the task with provided details
  const task = await Task.create({
    name,
    description,
    projectId,
    score: score || 10,
  });

  // Optionally, verify task creation (not strictly necessary)
  const findTask = await Task.findById(task._id);
  if (!findTask) {
    throw new ApiError(500, "Internal server error: Task not created"); // Internal error if task not found
  }

  // Add the newly created task ID to the project's tasks array
  project.tasks.push(task);
  let temp = project.totalScore;
  project.totalScore = temp + findTask.score;
  await project.save(); // Save the updated project

  // Check if there are users assigned to the project
  if (project.assignedUsers && project.assignedUsers.length > 0) {
    // Create progress for each assigned user
    const progressPromises = project.assignedUsers.map(async (userId) => {
      return Progress.create({
        taskId: task._id,
        userId,
        projectId: project._id,
        status: TaskEnumStatus.PENDING, // Set initial status or use a default
      });
    });

    await Promise.all(progressPromises); // Wait for all progress records to be created
  }

  // Return success response
  return res
    .status(201)
    .json(new ApiResponse(201, { task }, "Task created successfully")); // Use 201 for resource creation
});

// Delete a specific task
const deleteTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  // Check if the user is an admin
  const admin = await User.findById(req.user._id);
  if (admin.role !== UserRolesEnum.ADMIN) {
    throw new ApiError(401, "You are not authorized to delete tasks"); // Unauthorized error for non-admins
  }

  // Find the task by ID
  const task = await Task.findById(taskId);
  if (!task) {
    throw new ApiError(404, "Task not found"); // Not found error if task doesn't exist
  }

  // Extract the projectId and score from the task
  const { projectId, score } = task;

  // Delete any associated progress records
  await Progress.deleteMany({ taskId });

  // Update the project: remove taskId and subtract score
  const project = await Project.findById(projectId);
  if (project) {
    project.tasks = project.tasks.filter((id) => id.toString() !== taskId);
    project.totalScore -= score;
    await project.save();
  }
  // Delete the task
  await Task.deleteOne({ _id: taskId });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Task deleted successfully")); // Success response for deletion
});

// Update a specific task
const updateTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { name, description } = req.body;

  // Check if the user is an admin
  const admin = await User.findById(req.user._id);
  if (admin.role !== UserRolesEnum.ADMIN) {
    throw new ApiError(401, "You are not authorized to update tasks"); // Unauthorized error for non-admins
  }

  // Find the task by ID
  const task = await Task.findById(taskId);
  if (!task) {
    throw new ApiError(404, "Task not found"); // Not found error if task doesn't exist
  }

  // Update task details if provided
  if (name) task.name = name;
  if (description) task.description = description;
  await task.save(); // Save the updated task

  return res
    .status(200)
    .json(new ApiResponse(200, task, "Task updated successfully")); // Success response for update
});

// Retrieve a specific task and its progress
const getTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  // Find the task by ID
  const task = await Task.findById(taskId).select("name description score");
  if (!task) {
    throw new ApiError(404, "Task not found"); // Not found error if task doesn't exist
  }

  // Check if the user is an admin
  const user = await User.findById(req.user._id);
  if (user.role === UserRolesEnum.ADMIN) {
    // If the user is an admin, only return the task name and description
    return res.status(200).json(
      new ApiResponse(
        200,
        { task }, // Include only task name and description
        "Task details retrieved successfully"
      )
    );
  }

  // For assigned users, fetch their specific progress using aggregation
  const userProgress = await Progress.aggregate([
    {
      $match: { taskId: task._id, userId: req.user._id }, // Match progress for the current user and task
    },
    {
      $lookup: {
        from: "users", // Ensure this matches your User model's collection name
        localField: "userId",
        foreignField: "_id",
        as: "userInfo", // Join user info to progress records
      },
    },
    {
      $unwind: "$userInfo", // Unwind the userInfo array to deconstruct documents
    },
    {
      $project: {
        _id: 1,
        userId: 1,
        projectId: 1,
        taskId: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1,
        userName: {
          $concat: ["$userInfo.firstName", " ", "$userInfo.lastName"], // Concatenate first and last names
        },
      },
    },
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      { task, userProgress: userProgress[0] || null }, // Include task and user's progress
      "Task details retrieved successfully"
    )
  );
});

// Update progress of a specific task for a user
const updateTaskProgress = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { status } = req.body;

  // Find the task by ID
  const task = await Task.findById(taskId);
  if (!task) {
    throw new ApiError(404, "Task not found"); // Not found error if task doesn't exist
  }

  // Validate the status input against available statuses
  if (!AvailableProgressStatus.includes(status)) {
    throw new ApiError(400, "Invalid progress status"); // Bad request error for invalid status
  }

  // Find the progress record for the user and task
  const progress = await Progress.findOne({ taskId, userId: req.user._id });
  if (!progress) {
    throw new ApiError(
      404,
      "Progress record for the user not found for this task"
    ); // Not found error if no progress record exists
  }

  // Verify that the user updating the progress is the owner of the progress
  if (progress.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this progress"); // Forbidden error for unauthorized access
  }

  // If progress is already completed, throw an error
  if (progress.status === TaskEnumStatus.COMPLETED) {
    throw new ApiError(400, "This task has already been completed"); // Error for already completed progress
  }

  // Update the progress status
  progress.status = status;
  await progress.save(); // Save the updated progress record

  // If status is set to COMPLETED, update the project score for the user
  if (status === TaskEnumStatus.COMPLETED) {
    const project = await Project.findById(task.projectId);
    if (!project) {
      throw new ApiError(404, "Project not found"); // Not found error if project doesn't exist
    }

    // Find the user's score record in the project
    const userScoreEntry = project.scoreByUser.find(
      (entry) => entry.userID.toString() === req.user._id.toString()
    );

    if (userScoreEntry) {
      // Update the user's score by adding the task's score
      userScoreEntry.score += task.score;
    } else {
      // If no existing score record, initialize it (this case should not occur in practice)
      project.scoreByUser.push({
        userID: req.user._id,
        score: task.score,
      });
    }

    // Save the updated project
    await project.save();
  }

  return res
    .status(200)
    .json(new ApiResponse(200, progress, "Task progress updated successfully")); // Success response for update
});

export {
  createTasksForAProject,
  deleteTask,
  updateTask,
  getTask,
  updateTaskProgress,
};
