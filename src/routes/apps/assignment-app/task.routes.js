import { Router } from "express";
import { verifyJWT } from "../../../middlewares/auth.middlewares.js";
import {
  createTasksForAProject,
  deleteTask,
  getTask,
  updateTask,
  updateTaskProgress,
} from "../../../controllers/apps/assigment-app/task.controllers.js";
import { mongoIdPathVariableValidator } from "../../../validators/common/mongodb.validators.js";
import { validate } from "../../../validators/validate.js";

const router = Router();
router.use(verifyJWT);

router
  .route("/:projectId")
  .post(
    mongoIdPathVariableValidator("projectId"),
    validate,
    createTasksForAProject
  );
router
  .route("/t/:taskId")
  .delete(mongoIdPathVariableValidator("taskId"), validate, deleteTask)
  .patch(mongoIdPathVariableValidator("taskId"), validate, updateTask)
  .get(mongoIdPathVariableValidator("taskId"), validate, getTask)
  .post(mongoIdPathVariableValidator("taskId"), validate, updateTaskProgress);

export default router;
