require("dotenv").config();
import express from "express";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";

import * as middlewares from "./middlewares";
import api from "./api";

const app = express();

app.use(morgan("dev"));
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(middlewares.validateApiKey);

app.use("/", api);

app.use(middlewares.notFound);
app.use(middlewares.errorHandler);

export default app;
