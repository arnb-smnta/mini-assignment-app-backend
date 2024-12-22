import mongoose from "mongoose";
import {
  AvaialbleTaskStatus,
  AvailableProgressStatus,
  ProgessEnum,
  TaskEnumStatus,
} from "../../../constants.js";

//For every task assigned to a user a progress for that task has to be created

const progressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    status: {
      type: String,
      enum: AvaialbleTaskStatus,
      default: TaskEnumStatus.PENDING,
    },
  },
  { timestamps: true }
);
export const Progress = mongoose.model("Progress", progressSchema);
