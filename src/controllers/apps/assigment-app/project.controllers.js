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
  const { _id: userId, role: userRole } = req.user;

  let projects;

  if (userRole === UserRolesEnum.ADMIN) {
    // Admin: Fetch all projects
    projects = await Project.find({})
      .populate({
        path: "assignedTo.user",
        select: "name email",
      })
      .populate({
        path: "tasks",
        select: "name description status",
      });
  } else {
    // Non-admin: Fetch projects assigned to the user
    projects = await Project.find({ "assignedTo.user": userId })
      .populate({
        path: "assignedTo.user",
        select: "name email",
      })
      .populate({
        path: "tasks",
        select: "name description status",
      });
  }

  if (!projects.length) {
    return res.status(404).json(new ApiResponse(404, [], "No projects found")); // Return an empty array if no projects are found
  }

  return res
    .status(200)
    .json(new ApiResponse(200, projects, "Projects retrieved successfully"));
});

const createProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    throw new ApiError(402, "Name of project is required");
  }

  const user = await User.findById(req.user._id);
  if (user.role !== UserRolesEnum.ADMIN) {
    throw new ApiError(
      402,
      "You are not authorised to perform this task as you are not an Admin"
    );
  }

  const new_project = await Project.create({
    name: name,
    description: description,
  });

  const project = await Project.findById(new_project._id);
  if (!project) {
    throw new ApiError(500, "Project not created internal server error");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, project, "Project created successfully"));
});

const assignProjectToAUser = asyncHandler(async (req, res) => {
  const { projectId } = req.params; // ID of the project to be assigned
  const { startDate, endDate, userid } = req.body;

  const user = await User.findById(userid);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const admin = await User.findById(req.user._id);
  if (admin.role !== UserRolesEnum.ADMIN) {
    throw new ApiError(
      401,
      "You are not authorized to perform this task as you are not an Admin"
    );
  }

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

  const isScoreAlreadyTracked = project.scoreByUser.some(
    (entry) => entry.userID.toString() === userid
  );

  if (!isScoreAlreadyTracked) {
    project.scoreByUser.push({
      userID: user._id,
      score: 0,
    });
  }

  project.assignedTo.push({
    user: { _id: user._id, username: user.username },
    userStartDate: parsedStartDate,
    userEndDate: parsedEndDate,
  });

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
    await task.save();
  }

  await project.save();

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
        from: "tasks",
        localField: "tasks",
        foreignField: "_id",
        as: "taskDetails",
      },
    },
  ]);

  if (projectWithTasks.length === 0) {
    throw new ApiError(404, "Project not found");
  }

  const projectData = projectWithTasks[0];

  if (user.role === UserRolesEnum.ADMIN) {
    return res
      .status(200)
      .json(new ApiResponse(200, projectData, "Project fetched successfully"));
  } else {
    const filteredData = {
      ...projectData,
      assignedTo: undefined,
      scoreByUser: projectData.scoreByUser.filter(
        (score) => score.userID.toString() === req.user._id.toString()
      ),
    };

    return res
      .status(200)
      .json(new ApiResponse(200, filteredData, "Project fetched successfully"));
  }
});

const deleteProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

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

  await Project.deleteOne({ _id: projectId });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Project deleted successfully"));
});

const updateProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const { name, description } = req.body;

  const user = await User.findById(req.user._id);

  if (user.role !== UserRolesEnum.ADMIN) {
    throw new ApiError(402, "You are not authorised to perform this action");
  }

  const project = await Project.findById(projectId);

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  if (name) project.name = name;
  if (description) project.description = description;

  await project.save();

  return res
    .status(200)
    .json(new ApiResponse(200, project, "Project updated successfully"));
});

const removeUserFromProject = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const { userId } = req.body;

  if (!userId) {
    throw new ApiError(404, "User not found");
  }

  const project = await Project.findById(projectId);

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  const userIndex = project.assignedTo.findIndex(
    (assignment) => assignment.user.toString() === userId
  );

  if (userIndex === -1) {
    return res
      .status(404)
      .json({ message: "User not assigned to this project" });
  }

  project.assignedTo.splice(userIndex, 1);

  await project.save();

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
