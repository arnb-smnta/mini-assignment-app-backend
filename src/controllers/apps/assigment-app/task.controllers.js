import { Project } from "../../../models/apps/assigment-app/projectSchema.model.js";
import { Task } from "../../../models/apps/assigment-app/taskSchema.model.js";
import { ApiError } from "../../../utils/ApiError.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";

import {
  AvailableProgressStatus,
  TaskEnumStatus,
  UserRolesEnum,
} from "../../../constants.js";
import { Progress } from "../../../models/apps/assigment-app/progessSchema.model.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { User } from "../../../models/apps/auth/user.models.js";

const createTasksForAProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { name, description, score } = req.body;

  if (!name || !description) {
    throw new ApiError(400, "Both name and description are required");
  }

  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(404, "Project not found"); // Not found error if project doesn't exist
  }

  const task = await Task.create({
    name,
    description,
    projectId,
    score: score || 10,
  });

  const findTask = await Task.findById(task._id);
  if (!findTask) {
    throw new ApiError(500, "Internal server error: Task not created");
  }

  project.tasks.push(task);
  let temp = project.totalScore;
  project.totalScore = temp + findTask.score;
  await project.save();

  if (project.assignedUsers && project.assignedUsers.length > 0) {
    const progressPromises = project.assignedUsers.map(async (userId) => {
      return Progress.create({
        taskId: task._id,
        userId,
        projectId: project._id,
        status: TaskEnumStatus.PENDING,
      });
    });

    await Promise.all(progressPromises);
  }

  return res
    .status(201)
    .json(new ApiResponse(200, { task }, "Task created successfully"));
});

const deleteTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  const admin = await User.findById(req.user._id);
  if (admin.role !== UserRolesEnum.ADMIN) {
    throw new ApiError(401, "You are not authorized to delete tasks");
  }

  const task = await Task.findById(taskId);
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

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

  await Task.deleteOne({ _id: taskId });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Task deleted successfully"));
});

const updateTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { name, description } = req.body;

  const admin = await User.findById(req.user._id);
  if (admin.role !== UserRolesEnum.ADMIN) {
    throw new ApiError(402, "You are not authorized to update tasks");
  }

  const task = await Task.findById(taskId);
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  if (name) task.name = name;
  if (description) task.description = description;
  await task.save();

  return res
    .status(200)
    .json(new ApiResponse(200, task, "Task updated successfully"));
});

const getTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  const task = await Task.findById(taskId).select("name description score");
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  const user = await User.findById(req.user._id);
  if (user.role === UserRolesEnum.ADMIN) {
    return res
      .status(200)
      .json(
        new ApiResponse(200, { task }, "Task details retrieved successfully")
      );
  }

  const userProgress = await Progress.aggregate([
    {
      $match: { taskId: task._id, userId: req.user._id },
    },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "userInfo",
      },
    },
    {
      $unwind: "$userInfo",
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
          $concat: ["$userInfo.firstName", " ", "$userInfo.lastName"],
        },
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { task, userProgress: userProgress[0] || null },
        "Task details retrieved successfully"
      )
    );
});

const updateTaskProgress = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { status } = req.body;

  const task = await Task.findById(taskId);
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  if (!AvailableProgressStatus.includes(status)) {
    throw new ApiError(400, "Invalid progress status");
  }

  const progress = await Progress.findOne({ taskId, userId: req.user._id });
  if (!progress) {
    throw new ApiError(
      404,
      "Progress record for the user not found for this task"
    );
  }

  if (progress.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this progress");
  }

  if (progress.status === TaskEnumStatus.COMPLETED) {
    throw new ApiError(400, "This task has already been completed");
  }

  progress.status = status;
  await progress.save();

  if (status === TaskEnumStatus.COMPLETED) {
    const project = await Project.findById(task.projectId);
    if (!project) {
      throw new ApiError(404, "Project not found");
    }

    const userScoreEntry = project.scoreByUser.find(
      (entry) => entry.userID.toString() === req.user._id.toString()
    );

    if (userScoreEntry) {
      userScoreEntry.score += task.score;
    } else {
      project.scoreByUser.push({
        userID: req.user._id,
        score: task.score,
      });
    }

    await project.save();
  }

  return res
    .status(200)
    .json(new ApiResponse(200, progress, "Task progress updated successfully"));
});

export {
  createTasksForAProject,
  deleteTask,
  updateTask,
  getTask,
  updateTaskProgress,
};
