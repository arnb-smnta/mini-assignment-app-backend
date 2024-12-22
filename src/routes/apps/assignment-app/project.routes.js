import { Router } from "express";
import { verifyJWT } from "../../../middlewares/auth.middlewares.js";
import {
  assignProjectToAUser,
  createProject,
  deleteProject,
  getAllProjects,
  getProject,
  removeUserFromProject,
  updateProject,
} from "../../../controllers/apps/assigment-app/project.controllers.js";
import { validate } from "../../../validators/validate.js";
import { mongoIdPathVariableValidator } from "../../../validators/common/mongodb.validators.js";

const router = Router();
router.use(verifyJWT);

router.route("/").post(createProject).get(getAllProjects);
router
  .route("/:projectId")
  .get(mongoIdPathVariableValidator("projectId"), validate, getProject)
  .delete(mongoIdPathVariableValidator("projectId"), validate, deleteProject)
  .patch(mongoIdPathVariableValidator("projectId"), validate, updateProject);

router
  .route("/assign/:projectId")
  .post(
    mongoIdPathVariableValidator("projectId"),
    validate,
    assignProjectToAUser
  )
  .delete(
    mongoIdPathVariableValidator("projectId"),
    validate,
    removeUserFromProject
  );

export default router;
