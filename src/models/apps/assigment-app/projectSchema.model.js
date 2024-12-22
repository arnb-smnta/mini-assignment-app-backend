import mongoose, { Schema } from "mongoose";
import {
  AvailableProjectStatus,
  ProjectStatusenum,
} from "../../../constants.js";

const projectSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    assignedTo: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        }, // User reference
        userStartDate: { type: Date, required: true }, // Start date for this user
        userEndDate: { type: Date, required: true }, // End date for this user
      },
    ],
    tasks: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Task" }, // Array of task references
    ],
    totalScore: {
      type: Number,
      default: 0,
    },
    scoreByUser: [
      {
        userID: { type: mongoose.Schema.Types.ObjectId },
        score: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true }
);

export const Project = mongoose.model("Project", projectSchema);
